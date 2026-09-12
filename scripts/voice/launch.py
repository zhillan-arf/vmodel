"""Start or stop the owned loopback voice service with a reduced environment."""
from __future__ import annotations
import argparse
import ctypes
from ctypes import wintypes
import json
import os
from pathlib import Path
import shutil
import subprocess
import time
import urllib.request

ROOT=Path(__file__).resolve().parents[2]
BASE='http://127.0.0.1:5082'
PYTHON=ROOT/'.tools/voice/venv/Scripts/python.exe'
SCRIPT=ROOT/'scripts/voice/studio_server.py'
CACHE=ROOT/'.cache/voice'

def identity(pid):
    kernel=ctypes.WinDLL('kernel32',use_last_error=True)
    kernel.OpenProcess.argtypes=[wintypes.DWORD,wintypes.BOOL,wintypes.DWORD];kernel.OpenProcess.restype=wintypes.HANDLE
    kernel.CloseHandle.argtypes=[wintypes.HANDLE]
    kernel.GetProcessTimes.argtypes=[wintypes.HANDLE,*([ctypes.POINTER(wintypes.FILETIME)]*4)]
    kernel.QueryFullProcessImageNameW.argtypes=[wintypes.HANDLE,wintypes.DWORD,wintypes.LPWSTR,ctypes.POINTER(wintypes.DWORD)]
    handle=kernel.OpenProcess(0x1000,False,pid)
    if not handle:return None
    try:
        created,exited,kernel_time,user_time=[wintypes.FILETIME() for _ in range(4)]
        if not kernel.GetProcessTimes(handle,*[ctypes.byref(x) for x in [created,exited,kernel_time,user_time]]):raise OSError('Process identity could not be read')
        name=ctypes.create_unicode_buffer(32768);length=wintypes.DWORD(len(name))
        if not kernel.QueryFullProcessImageNameW(handle,0,name,ctypes.byref(length)):raise OSError('Process executable could not be read')
        return {'created':created.dwHighDateTime*2**32+created.dwLowDateTime,'executable':name.value}
    finally:kernel.CloseHandle(handle)

def health():
    try:
        with urllib.request.urlopen(BASE+'/health',timeout=1) as response:return json.load(response)
    except Exception:return None

def stop():
    route=ROOT/'assets/voice/studio/route.json'
    if route.exists():
        try:
            request=urllib.request.Request(BASE+'/api/shutdown',data=json.dumps({'adminKey':json.loads(route.read_text())['adminKey']}).encode(),headers={'Content-Type':'application/json','Origin':BASE})
            with urllib.request.urlopen(request,timeout=2):pass
        except Exception:pass
    pidfile=CACHE/'server.json'
    if not pidfile.exists():
        print('No owned voice service process recorded.');return
    saved=json.loads(pidfile.read_text())
    current=identity(saved['pid'])
    if current:
        if current['created']!=saved['created'] or Path(current['executable']).resolve()!=PYTHON.resolve() or saved['script']!=str(SCRIPT):
            raise RuntimeError('Recorded PID no longer identifies the owned voice service')
        for _ in range(40):
            if identity(saved['pid']) is None:break
            time.sleep(.1)
        else:
            # Only the identity-verified owned tree; never a port-wide/process-name kill.
            if identity(saved['pid'])==current:
                subprocess.run([str(Path(os.environ['SYSTEMROOT'])/'System32/taskkill.exe'),'/PID',str(saved['pid']),'/T','/F'],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
    pidfile.unlink(missing_ok=True)
    print('Voice Studio stopped. OBS output is silent; the audition page and avatar service were left running.')

def refresh_receivers_best_effort():
    """Refresh only verified silent OBS receivers; optional one-shot helper."""
    helper=ROOT/'scripts/voice/refresh_obs_receivers.mjs'
    obs_config=ROOT/'.tools/obs/config/obs-studio/plugin_config/obs-websocket/config.json'
    node=shutil.which('node')
    if not node or not helper.is_file() or not obs_config.is_file():return
    try:
        CACHE.mkdir(parents=True,exist_ok=True)
        allowed=['SYSTEMROOT','WINDIR','TEMP','TMP','USERPROFILE','LOCALAPPDATA','APPDATA','PROGRAMDATA','COMSPEC']
        env={k:v for k,v in os.environ.items() if k.upper() in allowed}
        env['PATH']=str(Path(node).parent)+os.pathsep+str(Path(os.environ['SYSTEMROOT'])/'System32')
        # A detached, <=15-second helper cannot gate either service or the UI.
        with (CACHE/'receiver-refresh.log').open('ab') as out:
            subprocess.Popen([node,str(helper)],cwd=ROOT,env=env,stdin=subprocess.DEVNULL,
                             stdout=out,stderr=subprocess.DEVNULL,
                             creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
    except (OSError,ValueError):
        pass  # OBS is optional; its absence must not prevent local startup.


def start(open_browser=True):
    current=health()
    if current and current.get('application')!='vmodel-voice':raise RuntimeError('Port 5082 belongs to another application')
    if not current:
        if not PYTHON.exists():raise RuntimeError('Voice environment missing. Run scripts/voice/provision.py first; see docs/voice-setup.md.')
        CACHE.mkdir(parents=True,exist_ok=True)
        allowed=['SYSTEMROOT','WINDIR','TEMP','TMP','USERPROFILE','LOCALAPPDATA','APPDATA','PROGRAMDATA','COMSPEC']
        env={k:v for k,v in os.environ.items() if k.upper() in allowed}
        git=shutil.which('git')
        if not git:raise RuntimeError('Git is required to verify the pinned voice source')
        env.update({'PATH':str(PYTHON.parent)+os.pathsep+str(Path(git).parent)+os.pathsep+str(Path(os.environ['SYSTEMROOT'])/'System32'),
                    'VMODEL_VOICE_GIT':git,'HF_HUB_OFFLINE':'1','TRANSFORMERS_OFFLINE':'1','HF_HUB_DISABLE_TELEMETRY':'1',
                    'OMP_NUM_THREADS':'3','MKL_NUM_THREADS':'3','OPENBLAS_NUM_THREADS':'3'})
        with (CACHE/'server.log').open('ab') as out,(CACHE/'server-error.log').open('ab') as err:
            process=subprocess.Popen([str(PYTHON),'-I',str(SCRIPT)],cwd=ROOT,env=env,stdin=subprocess.DEVNULL,stdout=out,stderr=err,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
        (CACHE/'server.json').write_text(json.dumps({'pid':process.pid,**identity(process.pid),'script':str(SCRIPT)},indent=2))
        for _ in range(50):
            current=health()
            if current and current.get('application')=='vmodel-voice':break
            if process.poll() is not None:raise RuntimeError('Voice startup failed; see .cache/voice/server-error.log. Port or private catalog may be unavailable.')
            time.sleep(.1)
        else:raise RuntimeError('Voice startup timed out; see .cache/voice/server-error.log')
    refresh_receivers_best_effort()
    print('Voice Studio: '+BASE+' - starts muted; microphone requires its explicit Start button.')
    if open_browser:
        paths=[Path(os.environ.get(k,''))/'Google/Chrome/Application/chrome.exe' for k in ['PROGRAMFILES','PROGRAMFILES(X86)','LOCALAPPDATA']]
        chrome=next((p for p in paths if p.is_file()),None)
        if not chrome:raise RuntimeError('Chrome was not found. Open '+BASE+' in an AudioWorklet-capable browser.')
        subprocess.Popen([str(chrome),BASE],stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--stop',action='store_true');parser.add_argument('--no-browser',action='store_true');args=parser.parse_args()
    try:stop() if args.stop else start(not args.no_browser)
    except Exception as error:parser.exit(1,str(error)+'\n')
