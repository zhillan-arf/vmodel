"""Isolated hybrid-core LLVC timing diagnostic; never opens media or networking.

Tests whether the unexplained slow/fast LLVC per-call discrepancy is explained by
this laptop's hybrid topology. The i7-1255U exposes P-cores and E-cores through one
affinity mask, so a single-thread worker at mask FFF may execute on either kind.
Each condition runs the same pinned eager model over the same licensed samples.

This is a diagnostic, not an acceptance probe. It changes only its own child
process affinity, restores nothing globally, and closes no acceptance box.
"""
from __future__ import annotations
import argparse
import json
import math
import os
from pathlib import Path
import re
import subprocess
import sys
import traceback

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / '.tools/voice/llvc'
sys.path.insert(0, str(ROOT / 'scripts/voice'))
sys.path.insert(0, str(Path(__file__).parent))
from probe_llvc_stream_adapter import checkpoint, process_snapshot, sha, update, utc

# Measured on this host: logical CPUs 0-3 report 100% of maximum frequency and
# 4-11 report 50-70%. The masks below follow that measured split, and each
# condition re-reads per-CPU frequency so the labels stay checkable.
CONDITIONS = [
    {'name': 'default-fff', 'mask': 0xFFF, 'intent': 'Current worker setting: every logical CPU, P-core or E-core.'},
    {'name': 'p-cores-00f', 'mask': 0x00F, 'intent': 'Only the two measured 100%-frequency physical cores and their threads.'},
    {'name': 'e-cores-ff0', 'mask': 0xFF0, 'intent': 'Only the eight measured 50-70%-frequency efficiency cores.'},
]
CALLS = 200


def paths(label):
    name = 'llvc-affinity-' + label
    folder = ROOT / 'ops/reports/local/voice/llvc'
    return {'report': ROOT / 'ops/reports' / (name + '.json'), 'log': folder / (name + '.log')}


def core_frequencies():
    """Per-logical-CPU percentage of maximum frequency, sampled outside timing."""
    powershell = Path(os.environ['SYSTEMROOT']) / 'System32/WindowsPowerShell/v1.0/powershell.exe'
    command = ("(Get-Counter -Counter '\\Processor Information(*)\\% of Maximum Frequency' -MaxSamples 1)"
               '.CounterSamples | ForEach-Object { [pscustomobject]@{ instance=$_.InstanceName; percent=$_.CookedValue } }'
               ' | ConvertTo-Json -Compress')
    raw = subprocess.check_output([str(powershell), '-NoProfile', '-NonInteractive', '-Command', command],
                                  text=True, timeout=30, creationflags=subprocess.CREATE_NO_WINDOW)
    return {item['instance']: item['percent'] for item in json.loads(raw)}


def apply_affinity(mask):
    """Pin this child process before Torch starts any thread pool."""
    import ctypes
    from ctypes import wintypes
    kernel = ctypes.WinDLL('kernel32', use_last_error=True)
    # Declare handle-sized types: the default c_int return truncates HANDLE on win64.
    kernel.GetCurrentProcess.argtypes = []
    kernel.GetCurrentProcess.restype = wintypes.HANDLE
    kernel.SetProcessAffinityMask.argtypes = [wintypes.HANDLE, ctypes.c_size_t]
    kernel.SetProcessAffinityMask.restype = wintypes.BOOL
    if not kernel.SetProcessAffinityMask(kernel.GetCurrentProcess(), ctypes.c_size_t(mask)):
        raise OSError('SetProcessAffinityMask failed for mask %X (error %d)'
                      % (mask, ctypes.get_last_error()))


def pin_current_thread(mask):
    """Pin only the calling thread, leaving other owned threads schedulable.

    Process-wide pinning also confines light pacing threads to the same few
    cores, so they contend with the neural call they were meant to feed.
    """
    import ctypes
    from ctypes import wintypes
    kernel = ctypes.WinDLL('kernel32', use_last_error=True)
    kernel.GetCurrentThread.argtypes = []
    kernel.GetCurrentThread.restype = wintypes.HANDLE
    kernel.SetThreadAffinityMask.argtypes = [wintypes.HANDLE, ctypes.c_size_t]
    kernel.SetThreadAffinityMask.restype = ctypes.c_size_t
    previous = kernel.SetThreadAffinityMask(kernel.GetCurrentThread(), ctypes.c_size_t(mask))
    if not previous:
        raise OSError('SetThreadAffinityMask failed for mask %X (error %d)'
                      % (mask, ctypes.get_last_error()))
    return '%X' % previous


def timer_resolution(milliseconds):
    """Raise the process timer resolution; sleep-based pacing is otherwise ~15.6ms.

    Returns a callable that restores the previous period. Real microphone input
    is paced by the audio device clock, so this affects the harness, not the
    contract under test.
    """
    import ctypes
    winmm = ctypes.WinDLL('winmm')
    if winmm.timeBeginPeriod(int(milliseconds)) != 0:
        raise OSError('timeBeginPeriod(%d) failed' % milliseconds)
    return lambda: winmm.timeEndPeriod(int(milliseconds))


def current_cpu():
    import ctypes
    from ctypes import wintypes
    kernel = ctypes.WinDLL('kernel32', use_last_error=True)
    kernel.GetCurrentProcessorNumber.argtypes = []
    kernel.GetCurrentProcessorNumber.restype = wintypes.DWORD
    return int(kernel.GetCurrentProcessorNumber())


def worker(args):
    files = paths(args.run_label)
    report = files['report']
    if not report.exists() or not files['log'].exists():
        raise ValueError('Parent must reserve report and log first')
    condition = next(item for item in CONDITIONS if item['name'] == args.condition)
    apply_affinity(condition['mask'])
    checkpoint(report, 'condition-' + condition['name'], workerPid=os.getpid())

    import socket
    def deny(*a, **k):
        raise RuntimeError('The isolated LLVC affinity diagnostic cannot use networking')
    socket.socket.connect = socket.socket.connect_ex = socket.create_connection = socket.getaddrinfo = deny

    import numpy as np
    import soundfile as sf
    import torch
    from scipy.signal import resample_poly
    from llvc_stream_adapter import LLVCStreamAdapter

    torch.set_num_threads(1)
    torch.set_num_interop_threads(1)
    torch.manual_seed(224)

    timings = []
    adapter = LLVCStreamAdapter(on_timing=timings.append)
    adapter.load()

    catalog = json.loads((ROOT / 'config/voice/assets.json').read_text(encoding='utf-8'))
    source = next(item for item in catalog['assets'] if item['id'] == 'ljspeech-sample')
    if sha(ROOT / source['path']) != source['sha256']:
        raise ValueError('Changed licensed reference input')
    speech, rate = sf.read(ROOT / source['path'], dtype='float32')
    if speech.ndim != 1 or not np.isfinite(speech).all():
        raise ValueError('Invalid mono reference')
    divisor = math.gcd(rate, 16000)
    speech = resample_poly(speech, 16000 // divisor, rate // divisor).astype(np.float32)
    needed = (CALLS + 40) * 832
    fixture = np.tile(speech, math.ceil(needed / len(speech)))[:needed].copy()

    # Warm the model, then discard warm-up timings so only steady-state calls count.
    for start in range(0, 32 * 832, 256):
        adapter.push(fixture[start:start + 256])
    adapter.finish()
    adapter.reset()
    timings.clear()

    before_cpu, before_freq = current_cpu(), core_frequencies()
    before_process = process_snapshot(torch)
    observed = []
    cursor = 0
    while len(timings) < CALLS and cursor < len(fixture):
        adapter.push(fixture[cursor:cursor + 256])
        cursor += 256
        if len(timings) % 25 == 0:
            observed.append(current_cpu())
    after_cpu, after_freq = current_cpu(), core_frequencies()
    after_process = process_snapshot(torch)

    walls = np.asarray([item['wallMs'] for item in timings[:CALLS]], dtype=np.float64)
    cpus = np.asarray([item['processCpuMs'] for item in timings[:CALLS]], dtype=np.float64)
    if len(walls) < CALLS:
        raise ValueError('Fixture exhausted before %d calls' % CALLS)
    result = {
        'condition': condition['name'],
        'intent': condition['intent'],
        'requestedAffinityMask': '%X' % condition['mask'],
        'observedAffinityMask': before_process.get('processAffinityMask'),
        'affinityApplied': before_process.get('processAffinityMask') == '%X' % condition['mask'],
        'calls': CALLS,
        'chunkAudioMs': 52,
        'medianMs': float(np.median(walls)),
        'p95Ms': float(np.percentile(walls, 95)),
        'maxMs': float(np.max(walls)),
        'minMs': float(np.min(walls)),
        'meanMs': float(np.mean(walls)),
        'computeRtf': float(np.mean(walls)) / 52,
        'deadlineMisses': int((walls > 52).sum()),
        'forwardWallTotalMs': float(walls.sum()),
        'forwardProcessCpuTotalMs': float(cpus.sum()),
        'forwardCpuToWallRatio': float(cpus.sum() / walls.sum()) if walls.sum() else None,
        'executingCpuSamples': observed,
        'currentCpuBefore': before_cpu,
        'currentCpuAfter': after_cpu,
        'coreFrequencyPercentBefore': before_freq,
        'coreFrequencyPercentAfter': after_freq,
        'beforeProcess': before_process,
        'afterProcess': after_process,
    }
    current = json.loads(report.read_text(encoding='utf-8'))
    results = current.get('results', [])
    results = [item for item in results if item['condition'] != condition['name']] + [result]
    update(report, results=results, stage='condition-' + condition['name'] + '-complete')
    print(json.dumps({'condition': condition['name'], 'medianMs': result['medianMs'],
                      'p95Ms': result['p95Ms'], 'computeRtf': result['computeRtf'],
                      'deadlineMisses': result['deadlineMisses'],
                      'affinityApplied': result['affinityApplied']}), flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--quiet-window', action='store_true')
    parser.add_argument('--worker', action='store_true')
    parser.add_argument('--condition')
    parser.add_argument('--run-label', required=True)
    args = parser.parse_args()
    if not args.quiet_window or not re.fullmatch(r'[a-z0-9][a-z0-9-]{0,31}', args.run_label):
        parser.error('Coordinate the quiet window and supply a fresh simple run label')
    files = paths(args.run_label)
    if args.worker:
        try:
            worker(args)
            return 0
        except BaseException as error:
            if files['report'].exists():
                update(files['report'], passed=False, status='failed', completed=utc(),
                       errorType=type(error).__name__, error=str(error))
            traceback.print_exc()
            return 1

    if any(file.exists() for file in files.values()):
        parser.error('Choose a fresh label; previous evidence will not be overwritten')
    files['report'].parent.mkdir(parents=True, exist_ok=True)
    files['log'].parent.mkdir(parents=True, exist_ok=True)
    initial = {
        'date': utc(), 'runLabel': args.run_label, 'passed': False, 'status': 'reserved',
        'stage': 'before-worker', 'diagnostic': True, 'paced': False,
        'question': 'Does hybrid P-core/E-core scheduling explain the unexplained LLVC per-call timing discrepancy?',
        'callsPerCondition': CALLS, 'internalChunkSamples': 832, 'internalChunkMs': 52,
        'conditions': [{k: (('%X' % v) if k == 'mask' else v) for k, v in item.items()} for item in CONDITIONS],
        'codeSha256': {'probe_llvc_affinity.py': sha(Path(__file__))},
        'baselineSha256': {name: sha(ROOT / 'scripts/voice' / name)
                           for name in ['llvc_stream_adapter.py', 'probe_llvc_stream_adapter.py']},
        'llvcManifestSha256': sha(BASE / 'manifest.json'),
        'log': {'path': files['log'].relative_to(ROOT).as_posix()},
        'physicalMedia': False, 'networkInference': False, 'liveAccepted': False,
        'limits': [
            'A timing diagnostic only: no microphone, speaker, OBS, paced pipeline or listening acceptance.',
            'Each condition sets only its own child process affinity; no global power, priority or scheduler setting changes.',
            'Ambient system load is recorded, not controlled; conditions run sequentially and can see different contention.',
            'Per-call Windows CPU readings are coarse; use aggregate CPU/wall totals rather than single-call ratios.',
            'GetCurrentProcessorNumber samples are taken outside timed regions and can change between samples.',
            'Core-kind labels come from measured percentage-of-maximum-frequency counters on this host, not a vendor topology API.',
        ],
        'results': [],
    }
    with files['report'].open('x', encoding='utf-8') as stream:
        json.dump(initial, stream, indent=2)

    failures = []
    with files['log'].open('x', encoding='utf-8') as log:
        python = ROOT / '.tools/voice/venv/Scripts/python.exe'
        env = {key: os.environ[key] for key in ['SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP'] if key in os.environ}
        env.update(PATH=str(python.parent), OMP_NUM_THREADS='1', MKL_NUM_THREADS='1',
                   OPENBLAS_NUM_THREADS='1', PYTHONIOENCODING='utf-8')
        for condition in CONDITIONS:
            log.write('\n=== condition %s (mask %X) ===\n' % (condition['name'], condition['mask']))
            log.flush()
            child = subprocess.Popen(
                [str(python), '-u', '-I', str(Path(__file__).resolve()), '--worker', '--quiet-window',
                 '--run-label', args.run_label, '--condition', condition['name']],
                cwd=BASE, env=env, stdout=log, stderr=subprocess.STDOUT,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
            try:
                code = child.wait(timeout=300)
            except subprocess.TimeoutExpired:
                child.kill()
                code = child.wait(timeout=5)
                failures.append({'condition': condition['name'], 'reason': 'timed-out'})
                continue
            if code != 0:
                failures.append({'condition': condition['name'], 'reason': 'exit-%d' % code})

    current = json.loads(files['report'].read_text(encoding='utf-8'))
    results = {item['condition']: item for item in current.get('results', [])}
    complete = len(results) == len(CONDITIONS) and not failures
    comparison = None
    if complete and all(item['affinityApplied'] for item in results.values()):
        fast, slow = results['p-cores-00f']['medianMs'], results['e-cores-ff0']['medianMs']
        comparison = {
            'pCoreMedianMs': fast, 'eCoreMedianMs': slow, 'defaultMedianMs': results['default-fff']['medianMs'],
            'eToPMedianRatio': slow / fast if fast else None,
            'pCoreMeetsChunkDeadline': results['p-cores-00f']['p95Ms'] <= 52,
            'eCoreMeetsChunkDeadline': results['e-cores-ff0']['p95Ms'] <= 52,
        }
    final = update(files['report'],
                   passed=complete, status='complete' if complete else 'failed',
                   stage='diagnostic-evidence', failures=failures, comparison=comparison,
                   completed=utc(),
                   log={'path': files['log'].relative_to(ROOT).as_posix(), 'sha256': sha(files['log']),
                        'bytes': files['log'].stat().st_size})
    print(json.dumps({'report': files['report'].relative_to(ROOT).as_posix(), 'status': final['status'],
                      'passed': final['passed'], 'comparison': comparison, 'failures': failures}, indent=2))
    return 0 if complete else 1


if __name__ == '__main__':
    raise SystemExit(main())
