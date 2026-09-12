"""Shared, lazily imported helpers for the isolated fixed-shape LLVC experiment.

Importing this module uses the standard library only. Runtime libraries are
loaded only by explicitly launched, bounded workers after a quiet release.
"""
from __future__ import annotations

import hashlib
import json
import math
import os
from pathlib import Path
import platform
import re
import subprocess
import time

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / '.tools/voice/llvc'
EXPORT = ROOT / 'assets/voice/llvc/onnx-factor4-v1'
LOCAL = ROOT / 'ops/reports/local/voice/llvc-onnx'
SOURCE_REVISION = '1627c5d358cf9bb2b92b0ccc513d8b36807c923d'
MODEL_REVISION = 'ebfe8c0fdeb974a7eeb463b3abbc8ce42a0e3851'
MODEL_SHA = 'cceb7ab9621f84d62d283725ae3281cacb04f762d6a088fe3e97c1a29d4b8c0e'
INPUT_NAMES = ['waveform', 'encoder_state', 'decoder_state', 'output_state', 'prenet_state']
OUTPUT_NAMES = ['converted_waveform', 'encoder_state_out', 'decoder_state_out', 'output_state_out', 'prenet_state_out']
INPUT_SHAPES = [[1, 1, 864], [1, 512, 510], [1, 2, 13, 256], [1, 512, 4], [1, 1, 24]]
OUTPUT_SHAPES = [[1, 1, 832], *INPUT_SHAPES[1:]]
RATE, L, FACTOR, CHUNK = 16000, 16, 4, 832
# Predetermined FP32 numerical gates, not perceptual voice-quality thresholds.
WAVE_LIMIT = {'maxAbs': 1e-4, 'rmse': 1e-5}
STATE_LIMIT = {'maxAbs': 5e-4, 'rmse': 5e-5}


def sha(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(1048576), b''):
            h.update(block)
    return h.hexdigest()


def rooted(relative):
    path = (ROOT / relative).resolve()
    if not path.is_relative_to(ROOT.resolve()):
        raise ValueError('Experimental artifact leaves the workspace')
    return path


def artifact(path):
    return {'path': Path(path).relative_to(ROOT).as_posix(), 'sha256': sha(path), 'bytes': Path(path).stat().st_size}


def write_json(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + '.tmp')
    temporary.write_text(json.dumps(data, indent=2, allow_nan=False) + '\n', encoding='utf-8')
    temporary.replace(path)


def verify_provision():
    manifest_path = BASE / 'manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    if manifest['sourceRevision'] != SOURCE_REVISION or manifest['modelRevision'] != MODEL_REVISION:
        raise ValueError('Different LLVC source or model revision')
    for item in manifest['artifacts']:
        if sha(rooted(item['path'])) != item['sha256']:
            raise ValueError(f"Changed LLVC artifact: {item['path']}")
    if sha(rooted(manifest['model'])) != MODEL_SHA:
        raise ValueError('Different LLVC checkpoint')
    return manifest, artifact(manifest_path)


def hardware():
    cpu = platform.processor()
    if os.name == 'nt':
        import winreg
        with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r'HARDWARE\DESCRIPTION\System\CentralProcessor\0') as key:
            cpu = winreg.QueryValueEx(key, 'ProcessorNameString')[0].strip()
    return {'os': platform.platform(), 'python': platform.python_version(), 'cpu': cpu,
            'logicalProcessors': os.cpu_count(), 'architecture': platform.machine() or 'unavailable'}


def deny_network():
    import socket
    def deny(*args, **kwargs):
        raise RuntimeError('No networking in the local LLVC export/probe worker')
    socket.socket.connect = socket.socket.connect_ex = socket.create_connection = socket.getaddrinfo = deny


def distribution(values):
    ordered = sorted(values)
    if not ordered or any(not math.isfinite(v) or v < 0 for v in ordered):
        raise ValueError('Missing/invalid timing samples')
    return {'count': len(ordered), 'min': ordered[0], 'median': ordered[math.ceil(len(ordered) * .5) - 1],
            'p95': ordered[math.ceil(len(ordered) * .95) - 1], 'p99': ordered[math.ceil(len(ordered) * .99) - 1],
            'max': ordered[-1], 'mean': sum(ordered) / len(ordered)}


def chunks_from_audio(audio):
    """The pinned infer_stream pad, L-shift and previous-2L context, in NumPy.

    Export validation also compares concatenated eager outputs with the actual
    upstream function; this helper is not assumed equivalent without that gate.
    """
    import numpy as np
    if audio.ndim != 1 or audio.dtype != np.float32 or not np.isfinite(audio).all() or len(audio) == 0:
        raise ValueError('Expected finite mono float32 audio')
    padded = np.pad(audio, (0, (-len(audio)) % CHUNK))
    shifted = np.concatenate([padded[L:], np.zeros(L, dtype=np.float32)])
    blocks = shifted.reshape(-1, CHUNK)
    context = np.zeros((len(blocks), 2 * L), dtype=np.float32)
    context[1:] = blocks[:-1, -2 * L:]
    return np.concatenate([context, blocks], axis=1)[:, None, None, :].copy()


def compare_array(actual, expected, limit):
    import numpy as np
    if actual.shape != expected.shape or actual.dtype != np.float32 or not np.isfinite(actual).all():
        raise ValueError('Wrong output shape/type or non-finite values')
    delta = actual.astype(np.float64) - expected.astype(np.float64)
    if not np.isfinite(delta).all():
        raise ValueError('Non-finite numerical reference/difference')
    metrics = {'maxAbs': float(np.max(np.abs(delta))), 'rmse': float(np.sqrt(np.mean(delta * delta)))}
    metrics['passed'] = all(metrics[key] <= value for key, value in limit.items())
    return metrics


def parity_sequence(step, fixture):
    """Feed back this runtime's own recurrent states, never eager states."""
    import numpy as np
    states = [fixture['initial_' + name].copy() for name in INPUT_NAMES[1:]]
    worst = {name: {'maxAbs': 0.0, 'worstBlockRmse': 0.0} for name in OUTPUT_NAMES}
    failures = []
    for index, chunk in enumerate(fixture['parity_chunks']):
        outputs = step(chunk.copy(), states)
        if len(outputs) != 5:
            raise ValueError('Missing waveform/recurrent output')
        for name, shape, actual in zip(OUTPUT_NAMES, OUTPUT_SHAPES, outputs):
            if list(actual.shape) != shape:
                raise ValueError(f'Wrong {name} shape')
            metrics = compare_array(actual, fixture['expected_' + name][index], WAVE_LIMIT if name == OUTPUT_NAMES[0] else STATE_LIMIT)
            worst[name]['maxAbs'] = max(worst[name]['maxAbs'], metrics['maxAbs'])
            worst[name]['worstBlockRmse'] = max(worst[name]['worstBlockRmse'], metrics['rmse'])
            if not metrics['passed'] and len(failures) < 10:
                failures.append({'block': index, 'output': name, **metrics})
        states = [np.ascontiguousarray(value).copy() for value in outputs[1:]]
    return {'passed': not failures, 'blocks': len(fixture['parity_chunks']),
            'recurrentFeedback': 'Own previous outputs; zero states at reset', 'worst': worst, 'firstFailures': failures}


class RunReport:
    def __init__(self, run_id, label):
        if not re.fullmatch(r'[0-9TZ-]+', run_id):
            raise ValueError('Invalid owned run ID')
        self.directory = LOCAL / run_id
        self.latest = ROOT / f'ops/reports/{label}.json'
        self.started = time.perf_counter()
        self.data = {'schemaVersion': 1, 'runId': run_id, 'state': 'running',
                     'date': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                     'liveAccepted': False, 'qualityAccepted': False, 'physicalAudio': False, 'networkInference': False}

    def save(self, stage=None):
        if stage:
            self.data['stage'] = stage
            print(json.dumps({'stage': stage, 'elapsedSeconds': time.perf_counter() - self.started}), flush=True)
        self.data['elapsedSeconds'] = time.perf_counter() - self.started
        write_json(self.directory / 'report.json', self.data)
        write_json(self.latest, self.data)


def supervise(script, interpreter, label, threads, worker_arguments, timeout=180):
    """Launch only the owned worker; retain failed/timeout evidence per run."""
    if not interpreter.is_file():
        raise ValueError('The already provisioned interpreter is missing; no automatic setup')
    run_id = time.strftime('%Y%m%dT%H%M%SZ', time.gmtime()) + '-' + str(os.getpid())
    report = RunReport(run_id, label)
    report.save('worker-launch')
    isolation = BASE / 'isolation' / run_id
    isolation.mkdir(parents=True, exist_ok=True)
    local_data = isolation / 'localappdata'
    notice = local_data / 'Intel Corporation/openvino_telemetry'
    notice.parent.mkdir(parents=True, exist_ok=True)
    notice.write_text('0', encoding='ascii')
    environment = {key: os.environ[key] for key in ['SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP'] if key in os.environ}
    environment.update(PATH=str(interpreter.parent), PYTHONIOENCODING='utf-8', OMP_NUM_THREADS=str(threads),
                       MKL_NUM_THREADS=str(threads), LOCALAPPDATA=str(local_data), CUDA_VISIBLE_DEVICES='-1',
                       TORCH_FORCE_WEIGHTS_ONLY_LOAD='1')
    command = [str(interpreter), '-I', str(script), '--worker', '--quiet-window', '--run-id', run_id, *worker_arguments]
    process = subprocess.Popen(command, cwd=isolation, env=environment, stdout=subprocess.PIPE,
                               stderr=subprocess.STDOUT, text=True, encoding='utf-8', errors='replace',
                               creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
    timed_out = False
    try:
        output, _ = process.communicate(timeout=timeout)
    except subprocess.TimeoutExpired:
        timed_out = True
        if process.poll() is None:
            if os.name == 'nt':
                subprocess.run(['taskkill', '/PID', str(process.pid), '/T', '/F'], check=False,
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                               creationflags=subprocess.CREATE_NO_WINDOW)
            else:
                process.kill()
        output, _ = process.communicate(timeout=10)
    (report.directory / 'worker.log').write_text(output or '', encoding='utf-8')
    if output:
        print(output[-12000:], end='', flush=True)
    if timed_out or process.returncode:
        current = report.directory / 'report.json'
        if current.exists():
            report.data = json.loads(current.read_text(encoding='utf-8'))
        report.data.update(state='timeout' if timed_out else 'failed', workerExitCode=process.returncode, budgetSeconds=timeout)
        report.save('worker-failed')
        raise RuntimeError('Owned LLVC worker did not complete; retained its report/log')


def worker_guard(report, function):
    try:
        function(report)
    except Exception as error:
        report.data.update(state='failed', errorType=type(error).__name__, error=str(error))
        report.save('failed')
        raise
