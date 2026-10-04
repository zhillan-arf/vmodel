"""Isolated file-only LLVC framing/parity probe with retained failure evidence."""
from __future__ import annotations
import argparse, ast, hashlib, json, math, os, re, subprocess, sys, time, traceback
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
BASE=ROOT/'.tools/voice/llvc'
def sha(file):return hashlib.sha256(Path(file).read_bytes()).hexdigest()
def utc():return time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())
def paths(label):
    name='llvc-stream-adapter-'+label
    folder=ROOT/'ops/001-zhil/sprint-001/reports/local/voice/llvc'
    return {'report':ROOT/'ops/001-zhil/sprint-001/reports'/(name+'.json'),'log':folder/(name+'.log'),'audio':folder/(name+'.wav'),'reference':folder/(name+'-upstream.wav')}
def update(file,**fields):
    value=json.loads(file.read_text(encoding='utf-8'));value.update(fields)
    temporary=file.with_suffix('.pending.json');temporary.write_text(json.dumps(value,indent=2),encoding='utf-8');temporary.replace(file)
    return value
def checkpoint(report,stage,**fields):
    update(report,stage=stage,**fields);print(json.dumps({'stage':stage}),flush=True)
def process_snapshot(torch):
    # Outside timing. Process affinity is distinct from individual thread pins.
    result={'pid':os.getpid(),'torchIntraopThreads':torch.get_num_threads(),'torchInteropThreads':torch.get_num_interop_threads()}
    if os.name=='nt':
        import ctypes
        from ctypes import wintypes
        class PowerStatus(ctypes.Structure):
            _fields_=[('ACLineStatus',wintypes.BYTE),('BatteryFlag',wintypes.BYTE),('BatteryLifePercent',wintypes.BYTE),
                      ('SystemStatusFlag',wintypes.BYTE),('BatteryLifeTime',wintypes.DWORD),('BatteryFullLifeTime',wintypes.DWORD)]
        kernel=ctypes.WinDLL('kernel32',use_last_error=True)
        kernel.GetSystemPowerStatus.argtypes=[ctypes.POINTER(PowerStatus)];kernel.GetSystemPowerStatus.restype=wintypes.BOOL
        power=PowerStatus()
        if not kernel.GetSystemPowerStatus(ctypes.byref(power)):raise OSError('GetSystemPowerStatus failed')
        result['powerStatus']={name:getattr(power,name) for name,_ in PowerStatus._fields_}
        powershell=Path(os.environ['SYSTEMROOT'])/'System32/WindowsPowerShell/v1.0/powershell.exe'
        command=(f'$p=Get-Process -Id {os.getpid()}; '
                 '[pscustomobject]@{threadCount=$p.Threads.Count;priorityClass=$p.PriorityClass.ToString();'
                 'processAffinityMask=$p.ProcessorAffinity.ToInt64().ToString("X")} | ConvertTo-Json -Compress')
        raw=subprocess.check_output([str(powershell),'-NoProfile','-NonInteractive','-Command',command],text=True,timeout=5,creationflags=subprocess.CREATE_NO_WINDOW)
        result.update(json.loads(raw))
    return result

def worker(args):
    files=paths(args.run_label);report=files['report']
    if not report.exists() or not files['log'].exists():raise ValueError('Worker requires a parent-reserved report/log')
    checkpoint(report,'imports',workerPid=os.getpid(),status='running')
    import socket
    def deny(*args,**kwargs):raise RuntimeError('The isolated LLVC file probe cannot use networking')
    socket.socket.connect=socket.socket.connect_ex=socket.create_connection=socket.getaddrinfo=deny
    import numpy as np
    import soundfile as sf
    import torch
    from scipy.signal import resample_poly
    from array import array
    import types
    torch.set_num_threads(1);torch.set_num_interop_threads(1);torch.manual_seed(224)
    sys.path.insert(0,str(Path(__file__).parent))
    from llvc_stream_adapter import LLVCStreamAdapter
    checkpoint(report,'load',torchVersion=torch.__version__)
    timings=[];adapter=LLVCStreamAdapter(on_timing=timings.append);adapter.load()
    catalog=json.loads((ROOT/'config/voice/assets.json').read_text(encoding='utf-8'))
    source=next(item for item in catalog['assets'] if item['id']=='ljspeech-sample')
    if sha(ROOT/source['path'])!=source['sha256']:raise ValueError('Changed licensed reference input')
    speech,rate=sf.read(ROOT/source['path'],dtype='float32')
    if speech.ndim!=1 or not np.isfinite(speech).all():raise ValueError('Invalid mono reference')
    divisor=math.gcd(rate,16000);speech=resample_poly(speech,16000//divisor,rate//divisor).astype(np.float32)
    expected=math.ceil(len(speech)/832)
    checkpoint(report,'warmup',sourceSamples=len(speech),sourceSha256=source['sha256'],expectedNeuralCalls=expected)
    for start in range(0,min(16000,len(speech)),256):adapter.push(speech[start:min(start+256,16000)])
    adapter.finish();adapter.reset();timings.clear()
    original=(BASE/'source/infer.py').read_text(encoding='utf-8')
    functions=[node for node in ast.parse(original).body if isinstance(node,ast.FunctionDef) and node.name=='infer_stream']
    if len(functions)!=1:raise ValueError('Expected one pinned upstream infer_stream')
    namespace={'torch':torch,'np':np,'time':types.SimpleNamespace(time=time.perf_counter)}
    exec(compile(ast.Module(body=functions,type_ignores=[]),str(BASE/'source/infer.py'),'exec'),namespace)
    class CountedModel:
        def __init__(self,model):self.model=model;self.calls=0
        def __getattr__(self,name):return getattr(self.model,name)
        def __call__(self,*values,**kwargs):self.calls+=1;return self.model(*values,**kwargs)
    checkpoint(report,'upstream-reference');counted=CountedModel(adapter.model)
    with torch.inference_mode():reference,_,_=namespace['infer_stream'](counted,torch.from_numpy(speech),4,16000)
    reference=reference.detach().cpu().numpy().reshape(-1)
    sf.write(files['reference'],reference,16000,subtype='FLOAT')
    if counted.calls!=expected:raise AssertionError('Upstream neural call count differs from exact EOF accounting')
    adapter.reset();timings.clear();before=process_snapshot(torch)
    checkpoint(report,'streaming-adapter',beforeProcess=before,upstreamNeuralCalls=counted.calls,
               upstreamAudio={'path':files['reference'].relative_to(ROOT).as_posix(),'sha256':sha(files['reference'])})
    result=array('f');started=time.perf_counter_ns();cpu_started=time.process_time_ns()
    for start in range(0,len(speech),256):result.extend(adapter.push(speech[start:start+256]))
    result.extend(adapter.finish())
    cpu_elapsed=time.process_time_ns()-cpu_started;elapsed=time.perf_counter_ns()-started
    measured=list(timings);after=process_snapshot(torch)
    output=np.frombuffer(result,dtype=np.float32).copy()
    sf.write(files['audio'],output,16000,subtype='FLOAT')
    exact=output.shape==reference.shape and output.tobytes()==reference.tobytes()
    error=float(np.max(np.abs(output-reference))) if output.shape==reference.shape else None
    timing={'forwardCallCount':len(measured),'expectedNeuralCalls':expected,'countMatches':len(measured)==expected,
            'forwardWallTotalMs':sum(item['wallMs'] for item in measured),'forwardProcessCpuTotalMs':sum(item['processCpuMs'] for item in measured),
            'wholeAdapterWallMs':elapsed/1e6,'wholeAdapterProcessCpuMs':cpu_elapsed/1e6,
            'wholeAdapterCpuToWallRatio':cpu_elapsed/elapsed,'zeroPerCallCpuReadings':sum(item['processCpuMs']==0 for item in measured)}
    checkpoint(report,'parity-check',outputSamples=len(output),upstreamBitExact=exact,maxAbsError=error,
               timingTotals=timing,timingSamples=measured,afterProcess=after,
               audio={'path':files['audio'].relative_to(ROOT).as_posix(),'sha256':sha(files['audio'])})
    if len(measured)!=expected:raise AssertionError('Adapter timing count differs from exact neural call count')
    if not exact:raise AssertionError('Adapter/EOF differs from pinned eager reference; mismatch WAVs are retained')
    first=output[:min(3328,len(output))].copy();adapter.reset();timings.clear();reset_output=array('f')
    check_input=speech[:min(3344,len(speech))]
    for start in range(0,len(check_input),256):reset_output.extend(adapter.push(check_input[start:start+256]))
    reset=np.frombuffer(reset_output,dtype=np.float32);expected_reset=max(0,(len(check_input)-16)//832)
    reset_exact=len(timings)==expected_reset and len(reset)==expected_reset*832 and reset.tobytes()==first[:len(reset)].tobytes()
    checkpoint(report,'reset-check',freshResetBitExact=reset_exact,resetNeuralCalls=len(timings),expectedResetCalls=expected_reset,resetOutputSamples=len(reset))
    if not reset_exact:raise AssertionError('Reset retained prior history or changed exact chunk count')
    checkpoint(report,'complete',passed=True,status='passed',completed=utc())

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--quiet-window',action='store_true');parser.add_argument('--worker',action='store_true');parser.add_argument('--run-label',required=True)
    args=parser.parse_args()
    if not args.quiet_window or not re.fullmatch(r'[a-z0-9][a-z0-9-]{0,31}',args.run_label):parser.error('Coordinate the quiet window and supply a fresh simple run label')
    files=paths(args.run_label)
    if args.worker:
        try:worker(args);return 0
        except BaseException as error:
            if files['report'].exists():update(files['report'],passed=False,status='failed',completed=utc(),errorType=type(error).__name__,error=str(error))
            traceback.print_exc();return 1
    if any(file.exists() for file in files.values()):parser.error('Choose a fresh run label; existing evidence will not be overwritten')
    files['report'].parent.mkdir(parents=True,exist_ok=True);files['log'].parent.mkdir(parents=True,exist_ok=True)
    initial={'date':utc(),'runLabel':args.run_label,'passed':False,'status':'reserved','stage':'before-worker','paced':False,
             'inputPacketSamples':256,'internalChunkSamples':832,'timeoutSeconds':120,
             'workerThreadEnvironment':{'OMP_NUM_THREADS':'1','MKL_NUM_THREADS':'1','OPENBLAS_NUM_THREADS':'1'},
             'probeSha256':sha(Path(__file__).resolve()),'adapterSha256':sha(Path(__file__).with_name('llvc_stream_adapter.py')),
             'log':{'path':files['log'].relative_to(ROOT).as_posix()},'physicalMedia':False,'networkInference':False,'liveAccepted':False,
             'limits':['File-only framing/EOF parity, not paced arrival/queue/output or physical latency proof.',
                       'Windows per-call process CPU readings can be coarse or zero: interpret aggregate CPU/wall totals, not individual-call ratios.',
                       'Process CPU includes all threads in this owned process; priority/thread/process-affinity snapshots are outside timing.',
                       'One research target voice; no English preference/quality acceptance.']}
    with files['report'].open('x',encoding='utf-8') as stream:json.dump(initial,stream,indent=2)
    child=None;timed_out=False;code=None
    with files['log'].open('x',encoding='utf-8') as log:
        try:
            python=ROOT/'.tools/voice/venv/Scripts/python.exe'
            env={key:os.environ[key] for key in ['SYSTEMROOT','WINDIR','TEMP','TMP'] if key in os.environ}
            env.update(PATH=str(python.parent),OMP_NUM_THREADS='1',MKL_NUM_THREADS='1',OPENBLAS_NUM_THREADS='1',PYTHONIOENCODING='utf-8')
            child=subprocess.Popen([str(python),'-u','-I',str(Path(__file__).resolve()),'--worker','--quiet-window','--run-label',args.run_label],cwd=BASE,env=env,stdout=log,stderr=subprocess.STDOUT,creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0)
            try:code=child.wait(timeout=120)
            except subprocess.TimeoutExpired:
                timed_out=True
                if child.poll() is None:
                    if os.name=='nt':subprocess.run([str(Path(os.environ['SYSTEMROOT'])/'System32/taskkill.exe'),'/PID',str(child.pid),'/T','/F'],stdout=log,stderr=subprocess.STDOUT,timeout=5,creationflags=subprocess.CREATE_NO_WINDOW)
                    else:child.kill()
                code=child.wait(timeout=5)
        except BaseException as error:
            traceback.print_exc(file=log);log.flush()
            update(files['report'],passed=False,status='failed',errorType=type(error).__name__,error=str(error),completed=utc())
            if child is not None and child.poll() is None:child.kill();code=child.wait(timeout=5)
    fields={'workerExitCode':code,'timedOut':timed_out,'completed':utc(),'log':{'path':files['log'].relative_to(ROOT).as_posix(),'sha256':sha(files['log']),'bytes':files['log'].stat().st_size}}
    current=json.loads(files['report'].read_text(encoding='utf-8'))
    if timed_out:fields.update(passed=False,status='timed-out',error='Owned LLVC parity probe exceeded120 seconds; partial report/log retained')
    elif code!=0 or not current.get('passed'):fields.update(passed=False,status='failed')
    final=update(files['report'],**fields)
    print(json.dumps({key:value for key,value in final.items() if key!='timingSamples'},indent=2))
    return 0 if final['passed'] else 1

if __name__=='__main__':raise SystemExit(main())
