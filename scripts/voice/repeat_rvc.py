"""One optional repeat of the unchanged best historical paced RVC CPU worker.

Preparation only until explicitly released. All new reports/audio/logs live in
a unique private report directory; the production benchmark source and old outputs remain
unchanged. No backend/context/thread sweep or automatic provisioning exists.
"""
from __future__ import annotations
import argparse
import ctypes
from ctypes import wintypes
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import platform
import re
import shutil
import subprocess
import sys
import time
import traceback
import types
import uuid

ROOT = Path(__file__).resolve().parents[2]
REVIEW_MANIFEST = ROOT / 'config/voice/rvc-repeat-review.json'
OUTPUT = ROOT / 'ops/001-zhil/sprint-001/reports/local/voice/rvc-repeat'
PRESET = 'cpu-q8-eager-3t'


def sha(path):
    value = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(1048576), b''):
            value.update(block)
    return value.hexdigest()


def utc():
    return time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())


def rooted(relative):
    path = (ROOT / relative).resolve()
    if not path.is_relative_to(ROOT.resolve()):
        raise ValueError('Reference path leaves workspace')
    return path


def update(folder, **fields):
    file = folder / 'run-report.json'
    data = json.loads(file.read_text(encoding='utf-8')) if file.exists() else {}
    data.update(fields)
    temporary = folder / 'run-report.pending.json'
    temporary.write_text(json.dumps(data, indent=2, allow_nan=False) + '\n', encoding='utf-8')
    temporary.replace(file)
    return data


def snapshot():
    """Read current worker power/process state; never change policy/priority."""
    result = {'observedAtUTC': utc(), 'pid': os.getpid(), 'python': platform.python_version(),
              'os': platform.platform(), 'logicalProcessors': os.cpu_count(),
              'scope': 'Point sample outside the unchanged benchmark interval; no clock/thermal measurement'}
    if os.name != 'nt':
        result['error'] = 'This reviewed repeat requires Windows'
        return result
    kernel = ctypes.WinDLL('kernel32', use_last_error=True)
    class PowerStatus(ctypes.Structure):
        _fields_ = [('ACLineStatus', wintypes.BYTE), ('BatteryFlag', wintypes.BYTE),
                    ('BatteryLifePercent', wintypes.BYTE), ('SystemStatusFlag', wintypes.BYTE),
                    ('BatteryLifeTime', wintypes.DWORD), ('BatteryFullLifeTime', wintypes.DWORD)]
    try:
        kernel.GetSystemPowerStatus.argtypes = [ctypes.POINTER(PowerStatus)]
        kernel.GetSystemPowerStatus.restype = wintypes.BOOL
        power = PowerStatus()
        if not kernel.GetSystemPowerStatus(ctypes.byref(power)):
            raise ctypes.WinError(ctypes.get_last_error())
        result['power'] = {name: getattr(power, name) for name, _ in PowerStatus._fields_}
        result['power']['ACMeaning'] = {0: 'offline', 1: 'online', 255: 'unknown'}.get(power.ACLineStatus, 'unknown')
    except OSError as error:
        result['powerError'] = str(error)
    try:
        kernel.GetCurrentProcess.restype = wintypes.HANDLE
        handle = kernel.GetCurrentProcess()
        kernel.GetPriorityClass.argtypes = [wintypes.HANDLE]
        kernel.GetPriorityClass.restype = wintypes.DWORD
        priority = kernel.GetPriorityClass(handle)
        if priority == 0:
            raise ctypes.WinError(ctypes.get_last_error())
        kernel.GetProcessAffinityMask.argtypes = [wintypes.HANDLE, ctypes.POINTER(ctypes.c_size_t), ctypes.POINTER(ctypes.c_size_t)]
        kernel.GetProcessAffinityMask.restype = wintypes.BOOL
        process_mask, system_mask = ctypes.c_size_t(), ctypes.c_size_t()
        if not kernel.GetProcessAffinityMask(handle, ctypes.byref(process_mask), ctypes.byref(system_mask)):
            raise ctypes.WinError(ctypes.get_last_error())
        kernel.GetProcessTimes.argtypes = [wintypes.HANDLE, *([ctypes.POINTER(wintypes.FILETIME)] * 4)]
        kernel.GetProcessTimes.restype = wintypes.BOOL
        times = [wintypes.FILETIME() for _ in range(4)]
        if not kernel.GetProcessTimes(handle, *(ctypes.byref(value) for value in times)):
            raise ctypes.WinError(ctypes.get_last_error())
        seconds = lambda value: (value.dwHighDateTime * 2**32 + value.dwLowDateTime) / 10000000
        result['process'] = {'priorityClass': priority, 'affinityMaskHex': hex(process_mask.value),
                             'systemAffinityMaskHex': hex(system_mask.value),
                             'kernelCpuSeconds': seconds(times[2]), 'userCpuSeconds': seconds(times[3])}
        kernel.GetSystemTimes.argtypes = [ctypes.POINTER(wintypes.FILETIME)] * 3
        kernel.GetSystemTimes.restype = wintypes.BOOL
        system = [wintypes.FILETIME() for _ in range(3)]
        if not kernel.GetSystemTimes(*(ctypes.byref(value) for value in system)):
            raise ctypes.WinError(ctypes.get_last_error())
        result['systemCpuCumulativeSeconds'] = dict(zip(['idle', 'kernelIncludingIdle', 'user'], [seconds(value) for value in system]))
    except OSError as error:
        result['processError'] = str(error)
    try:
        import winreg
        with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r'HARDWARE\DESCRIPTION\System\CentralProcessor\0') as key:
            result['cpu'] = winreg.QueryValueEx(key, 'ProcessorNameString')[0].strip()
        # The active base scheme is distinct from the effective overlay/mode.
        power_api = ctypes.WinDLL('powrprof', use_last_error=True)
        power_api.PowerGetActiveScheme.argtypes = [wintypes.HANDLE, ctypes.POINTER(ctypes.c_void_p)]
        power_api.PowerGetActiveScheme.restype = wintypes.DWORD
        address = ctypes.c_void_p()
        code = power_api.PowerGetActiveScheme(None, ctypes.byref(address))
        if code:
            raise OSError(f'PowerGetActiveScheme returned {code}')
        try:
            result['activeBaseSchemeGuid'] = str(uuid.UUID(bytes_le=ctypes.string_at(address, 16)))
        finally:
            kernel.LocalFree.argtypes = [ctypes.c_void_p]
            kernel.LocalFree.restype = ctypes.c_void_p
            kernel.LocalFree(address)
    except OSError as error:
        result['schemeOrCpuError'] = str(error)
    torch = sys.modules.get('torch')
    if torch is not None and hasattr(torch, 'get_num_threads') and hasattr(torch, 'get_num_interop_threads'):
        result['torchThreads'] = {'intraop': torch.get_num_threads(), 'interop': torch.get_num_interop_threads()}
    return result


def verify_pins():
    pins = json.loads(REVIEW_MANIFEST.read_text(encoding='utf-8'))
    for item in pins['files']:
        if sha(rooted(item['path'])) != item['sha256']:
            raise ValueError(f"Changed reviewed input: {item['path']}")
    plan = json.loads(rooted(pins['presetFile']).read_text(encoding='utf-8'))
    preset = next(item for item in plan['presets'] if item['id'] == PRESET)
    if preset != pins['expectedPreset']:
        raise ValueError('Different requested model/thread/encoder preset')
    for key, value in pins['expectedSettings'].items():
        if plan.get(key) != value:
            raise ValueError(f'Different benchmark setting: {key}')
    # Refuse a cache miss before the original loader can write a derivative.
    # xxhash is already an upstream dependency; this import occurs only in the
    # explicitly released worker, never during preparation or parent launch.
    import xxhash
    encoder = rooted(pins['originalEncoder'])
    value = xxhash.xxh128()
    with encoder.open('rb') as stream:
        for block in iter(lambda: stream.read(4194304), b''):
            value.update(block)
    cached = rooted(pins['encoderCacheMetadata']).read_text(encoding='utf-8')
    if value.hexdigest() != cached or cached != pins['expectedEncoderXxh128']:
        raise ValueError('Existing quantized cache is not valid; repeat will not regenerate it')
    return pins


def worker(options, folder):
    if not (folder / 'run-report.json').is_file() or not (folder / 'worker.log').is_file():
        raise ValueError('Worker requires parent-reserved report/log')
    import socket
    def denied(*args, **kwargs):
        raise RuntimeError('No networking in the staged exact RVC repeat')
    socket.socket.connect = socket.socket.connect_ex = socket.create_connection = socket.getaddrinfo = denied
    before = snapshot()
    update(folder, status='running', stage='verify-readonly-inputs', workerPid=os.getpid(), workerBefore=before)
    try:
        pins = verify_pins()
        source = rooted(pins['benchmarkSource'])
        spec = importlib.util.spec_from_file_location('vmodel_exact_rvc_benchmark', source)
        baseline = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(baseline)
        # The only mutation is this isolated module's OUTPUT destination.
        # Its worker/process/model/SOLA/scheduler code is executed unchanged.
        baseline.OUTPUT = folder
        update(folder, stage='unchanged-benchmark-worker', reviewedPins=pins)
        baseline.worker(types.SimpleNamespace(preset=PRESET, prepare_only=False))
        outcome = json.loads((folder / (PRESET + '.json')).read_text(encoding='utf-8'))
        if outcome['preset'] != pins['expectedPreset']:
            raise ValueError('Unexpected returned benchmark preset')
        for field, value in pins['expectedResultHashes'].items():
            if outcome[field] != value:
                raise ValueError(f'Returned source/model differs from original result: {field}')
        if outcome['torch'] != pins['torch'] or outcome['onnxruntime'] != pins['onnxruntime'] or outcome['providers'] != ['CPUExecutionProvider']:
            raise ValueError('Different compute runtime/provider')
        # Outside all benchmark timers: verify sources, cached models and the
        # old report/audio still match, including the cache's read-only branch.
        verify_pins()
        update(folder, status='completed', stage='completed', endedAtUTC=utc(),
               benchmarkReport=(folder / (PRESET + '.json')).relative_to(ROOT).as_posix(),
               benchmarkReportSha256=sha(folder / (PRESET + '.json')),
               resultScope='Repeated paced file benchmark; original deadline/drop/CPU/wall metrics retained. No live or power-causality gate accepted.')
    except Exception as error:
        update(folder, status='failed', stage='failed', endedAtUTC=utc(), errorType=type(error).__name__,
               error=str(error), traceback=traceback.format_exc())
        raise
    finally:
        update(folder, workerAfter=snapshot())


def stop_owned(process):
    if process is None or process.poll() is not None:
        return
    if os.name == 'nt':
        taskkill = Path(os.environ['SYSTEMROOT']) / 'System32/taskkill.exe'
        try:
            subprocess.run([str(taskkill), '/PID', str(process.pid), '/T', '/F'], check=False,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=10,
                           creationflags=subprocess.CREATE_NO_WINDOW)
        except (OSError, subprocess.TimeoutExpired):
            # Fallback remains limited to the exact child handle we created.
            process.kill()
    else:
        process.kill()
    try:
        process.wait(timeout=10)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=5)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--preset', choices=[PRESET], default=PRESET)
    parser.add_argument('--run-label', help='Unique artifact directory; defaults to UTC timestamp plus launcher PID')
    parser.add_argument('--quiet-window', action='store_true')
    parser.add_argument('--worker', action='store_true')
    options = parser.parse_args()
    if not options.quiet_window:
        parser.error('Root must release the measurement window first; then use --quiet-window')
    label = options.run_label or (time.strftime('%Y%m%dT%H%M%SZ', time.gmtime()).lower() + '-' + str(os.getpid()))
    if not re.fullmatch(r'[a-z0-9][a-z0-9-]{0,63}', label):
        parser.error('Run label must be 1-64 lowercase letters/digits/hyphens')
    folder = OUTPUT / label
    if options.worker:
        return worker(options, folder)
    folder.mkdir(parents=True, exist_ok=False)
    update(folder, schemaVersion=1, status='starting', startedAtUTC=utc(), runLabel=label,
           preset=PRESET, stagedScriptSha256=sha(Path(__file__).resolve()),
           oldRunPowerState='Unknown: not recorded in original RVC runs; available event evidence is later',
           liveAccepted=False, physicalAudioMeasured=False, powerSettingsChanged=False)
    interpreter = ROOT / '.tools/voice/venv/Scripts/python.exe'
    environment = {key: os.environ[key] for key in ['SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP'] if key in os.environ}
    environment.update(PATH=str(interpreter.parent), PYTHONNOUSERSITE='1', PYTHONIOENCODING='utf-8',
                       TORCH_FORCE_WEIGHTS_ONLY_LOAD='1', CUDA_VISIBLE_DEVICES='-1',
                       HF_HUB_OFFLINE='1', VMODEL_VOICE_GIT=shutil.which('git') or '')
    command = [str(interpreter), '-I', '-B', str(Path(__file__).resolve()), '--worker', '--preset', PRESET,
               '--run-label', label, '--quiet-window']
    log = folder / 'worker.log'
    process = None
    try:
        update(folder, command=command, timeoutSeconds=180)
        with log.open('x', encoding='utf-8') as output:
            process = subprocess.Popen(command, cwd=ROOT / '.tools/voice/isolation', env=environment,
                                       stdout=output, stderr=subprocess.STDOUT,
                                       creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
            # Separate one-writer launch metadata avoids a read/modify/write
            # race with the child's run-report checkpoints immediately at boot.
            (folder / 'launch.json').write_text(json.dumps({'ownedWorkerPid': process.pid,
                'command': command, 'timeoutSeconds': 180}, indent=2) + '\n', encoding='utf-8')
            try:
                code = process.wait(timeout=180)
            except subprocess.TimeoutExpired:
                stop_owned(process)
                update(folder, status='timeout', stage='timeout', endedAtUTC=utc(),
                       parentAfterCleanup=snapshot(), error='Owned worker exceeded the unchanged-benchmark 180-second budget')
                raise RuntimeError('RVC repeat timed out; retained its private report/log')
        update(folder, workerExitCode=code, workerLogSha256=sha(log))
        if code:
            update(folder, status='failed')
            raise RuntimeError('RVC repeat failed; retained its private report/log')
    except BaseException as error:
        current = json.loads((folder / 'run-report.json').read_text(encoding='utf-8'))
        if current['status'] not in ['failed', 'timeout']:
            update(folder, status='failed', stage='launcher-failed', error=str(error), endedAtUTC=utc())
        raise
    finally:
        stop_owned(process)
        if log.exists():
            print(log.read_text(encoding='utf-8', errors='replace')[-8000:], end='', flush=True)
        print(json.dumps({'report': (folder / 'run-report.json').relative_to(ROOT).as_posix()}), flush=True)


if __name__ == '__main__':
    main()
