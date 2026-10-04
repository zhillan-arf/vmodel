"""Bounded, file-only LLVC streaming compute probe. Not physical audio latency."""
from __future__ import annotations

import argparse
import ast
import hashlib
import json
import math
import os
import platform
from pathlib import Path
import re
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / '.tools/voice/llvc'


def sha(file):
    value = hashlib.sha256()
    with Path(file).open('rb') as stream:
        for chunk in iter(lambda: stream.read(1048576), b''):
            value.update(chunk)
    return value.hexdigest()


def distribution(values):
    ordered = sorted(values)
    if not ordered or any(not math.isfinite(value) for value in ordered):
        raise ValueError('Missing or non-finite compute samples')
    return {'count': len(ordered), 'min': ordered[0], 'median': ordered[math.ceil(len(ordered) * .5) - 1],
            'p95': ordered[math.ceil(len(ordered) * .95) - 1], 'p99': ordered[math.ceil(len(ordered) * .99) - 1],
            'max': ordered[-1], 'mean': sum(ordered) / len(ordered)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--threads', type=int, choices=[1, 3], required=True)
    parser.add_argument('--chunk-factor', type=int, choices=[1, 4, 8], required=True)
    parser.add_argument('--quiet-window', action='store_true')
    parser.add_argument('--worker', action='store_true')
    parser.add_argument('--run-label', default='', help='Optional distinct artifact suffix; preserves earlier benchmark files')
    args = parser.parse_args()
    if args.run_label and not re.fullmatch(r'[a-z0-9][a-z0-9-]{0,31}', args.run_label):
        parser.error('Run label must contain 1-32 lowercase letters/digits/hyphens and start with a letter or digit')
    if not args.quiet_window:
        parser.error('Coordinate the laptop measurement window, then use --quiet-window')
    if args.worker:
        return worker(args)
    python = ROOT / '.tools/voice/venv/Scripts/python.exe'
    isolation = BASE / 'isolation'
    isolation.mkdir(parents=True, exist_ok=True)
    environment = {key: os.environ[key] for key in ['SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP'] if key in os.environ}
    environment.update(PATH=str(python.parent), PYTHONIOENCODING='utf-8', OMP_NUM_THREADS=str(args.threads),
                       MKL_NUM_THREADS=str(args.threads), LOCALAPPDATA=str(isolation))
    command = [str(python), '-I', str(Path(__file__).resolve()), '--worker', '--quiet-window',
               '--threads', str(args.threads), '--chunk-factor', str(args.chunk_factor)]
    if args.run_label:
        command.extend(['--run-label', args.run_label])
    process = subprocess.Popen(command, cwd=isolation, env=environment, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                               text=True, encoding='utf-8', errors='replace',
                               creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
    try:
        output, _ = process.communicate(timeout=180)
        code = process.returncode
    except subprocess.TimeoutExpired:
        if process.poll() is None:
            if os.name == 'nt':
                subprocess.run(['taskkill', '/PID', str(process.pid), '/T', '/F'], check=False,
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                               creationflags=subprocess.CREATE_NO_WINDOW)
            else:
                process.kill()
        output, _ = process.communicate(timeout=10)
        if output:
            print(output[-10000:], end='', flush=True)
        raise RuntimeError('Owned LLVC probe exceeded its 180-second bound')
    if output:
        print(output[-10000:], end='', flush=True)
    if code:
        raise subprocess.CalledProcessError(code, command)


def worker(args):
    import socket
    def deny(*arguments, **keywords):
        raise RuntimeError('No networking is permitted in the LLVC file probe')
    socket.socket.connect = socket.socket.connect_ex = socket.create_connection = socket.getaddrinfo = deny
    import numpy as np
    import soundfile as sf
    import torch
    from scipy.signal import resample_poly

    manifest = json.loads((BASE / 'manifest.json').read_text(encoding='utf-8'))
    for artifact in manifest['artifacts']:
        file = ROOT / artifact['path']
        if sha(file) != artifact['sha256']:
            raise ValueError(f'Changed provisioned LLVC artifact: {file.name}')
    torch.set_num_threads(args.threads)
    torch.set_num_interop_threads(1)
    torch.manual_seed(224)
    sys.path.insert(0, str(BASE / 'runtime'))
    from model import Net
    config = json.loads((BASE / 'source/experiments/llvc/config.json').read_text(encoding='utf-8'))
    assert config['data']['sr'] == 16000
    started = time.perf_counter()
    model = Net(**config['model_params'])
    checkpoint = torch.load(ROOT / manifest['model'], weights_only=True, mmap=True, map_location='cpu')
    loaded = model.load_state_dict(checkpoint['model'], strict=True)
    assert not loaded.missing_keys and not loaded.unexpected_keys
    del checkpoint
    # Upstream's command-line loader omits eval(); disable training dropout for
    # this inference experiment. Architecture and checkpoint tensors are unchanged.
    model.eval()
    assert all(not module.training for module in model.modules())
    parameter_count = sum(parameter.numel() for parameter in model.parameters())
    if not all(torch.isfinite(parameter).all().item() for parameter in model.parameters()):
        raise ValueError('Non-finite checkpoint weights')
    load_seconds = time.perf_counter() - started

    # Execute only the inspected upstream streaming function. Its original
    # pad/shift/context behavior stays intact; device/file CLI imports do not run.
    original = (BASE / 'source/infer.py').read_text(encoding='utf-8')
    functions = [item for item in ast.parse(original).body if isinstance(item, ast.FunctionDef) and item.name == 'infer_stream']
    if len(functions) != 1:
        raise ValueError('Expected one reviewed upstream streaming function')
    import types
    namespace = {'torch': torch, 'np': np, 'time': types.SimpleNamespace(time=time.perf_counter)}
    exec(compile(ast.Module(body=functions, type_ignores=[]), str(BASE / 'source/infer.py'), 'exec'), namespace)
    infer_stream = namespace['infer_stream']
    catalog = json.loads((ROOT / 'config/voice/assets.json').read_text(encoding='utf-8'))
    source = next(asset for asset in catalog['assets'] if asset['id'] == 'ljspeech-sample')
    if sha(ROOT / source['path']) != source['sha256']:
        raise ValueError('Changed licensed English reference input')
    speech, rate = sf.read(ROOT / source['path'], dtype='float32')
    if speech.ndim != 1 or not np.isfinite(speech).all():
        raise ValueError('Expected the finite mono reference')
    divisor = math.gcd(rate, 16000)
    speech = resample_poly(speech, 16000 // divisor, rate // divisor).astype(np.float32)
    source_samples = len(speech)
    unit = np.concatenate([speech, np.zeros(4000, dtype=np.float32)])
    measured_input = np.tile(unit, math.ceil(30 * 16000 / len(unit)))[:30 * 16000]
    tensor = torch.from_numpy(measured_input)
    chunk_samples = model.L * model.dec_chunk_size * args.chunk_factor
    chunk_ms = chunk_samples / 16
    with torch.inference_mode():
        infer_stream(model, torch.from_numpy(speech[:16000]), args.chunk_factor, 16000)

    class TracedModel:
        def __init__(self, target):
            self.target = target
            self.timings = []
            self.last_progress = time.perf_counter()
        def __getattr__(self, name):
            return getattr(self.target, name)
        def __call__(self, *values, **keywords):
            start = time.perf_counter()
            result = self.target(*values, **keywords)
            self.timings.append((time.perf_counter() - start) * 1000)
            if time.perf_counter() - self.last_progress >= 20:
                print(json.dumps({'probe': 'LLVC', 'blocks': len(self.timings), 'inputSecondsCovered': len(self.timings) * chunk_samples / 16000}), flush=True)
                self.last_progress = time.perf_counter()
            return result

    traced = TracedModel(model)
    started = time.perf_counter()
    output, upstream_speed_ratio, upstream_estimate_ms = infer_stream(traced, tensor, args.chunk_factor, 16000)
    elapsed_seconds = time.perf_counter() - started
    samples = output.detach().cpu().numpy().reshape(-1)
    assert samples.shape == measured_input.shape and np.isfinite(samples).all()
    assert len(traced.timings) == math.ceil(len(measured_input) / chunk_samples)
    result_dir = ROOT / 'ops/001-zhil/sprint-001/reports/local/voice/llvc'
    result_dir.mkdir(parents=True, exist_ok=True)
    name = f'llvc-cpu-{args.threads}t-factor{args.chunk_factor}'
    if args.run_label:
        name += '-' + args.run_label
    audio_file = result_dir / (name + '.wav')
    reference_file = result_dir / (name + '-english-reference.wav')
    sf.write(audio_file, samples, 16000, subtype='FLOAT')
    sf.write(reference_file, samples[:source_samples], 16000, subtype='FLOAT')
    compute = distribution(traced.timings)
    # Restore fresh buffers through upstream infer_stream and confirm deterministic
    # output on the same first input segment, including complete chunk boundaries.
    check_length = math.ceil(source_samples / chunk_samples) * chunk_samples
    repeated, _, _ = infer_stream(model, tensor[:check_length], args.chunk_factor, 16000)
    repeat_error = float(np.max(np.abs(repeated.detach().cpu().numpy().reshape(-1) - samples[:check_length])))
    assert repeat_error <= 1e-6, 'Reset/repeated streaming conversion changed its output'
    cpu_name = platform.processor()
    if os.name == 'nt':
        import winreg
        with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r'HARDWARE\DESCRIPTION\System\CentralProcessor\0') as key:
            cpu_name = winreg.QueryValueEx(key, 'ProcessorNameString')[0].strip()
    report = {'date': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'engine': 'LLVC', 'sourceRevision': manifest['sourceRevision'],
              'modelRevision': manifest['modelRevision'], 'checkpointSha256': sha(ROOT / manifest['model']),
              'hardware': {'os': platform.platform(), 'python': platform.python_version(), 'architecture': platform.machine() or 'unavailable in isolated environment',
                           'cpu': cpu_name, 'logicalProcessors': os.cpu_count()},
              'source': {'path': source['path'], 'sha256': source['sha256'], 'resampledRate': 16000, 'sourceSamples': source_samples},
              'torch': torch.__version__, 'threads': args.threads, 'interopThreads': 1, 'delegate': 'CPU', 'parameterCount': parameter_count,
              'evaluationMode': True, 'weightLoading': 'weights_only=True; mmap=True; strict state dictionary', 'loadSeconds': load_seconds,
              'runLabel': args.run_label or None, 'probeScriptSha256': sha(Path(__file__).resolve()),
              'warmupInputSeconds': 1, 'measuredInputSeconds': 30, 'conversionWallSeconds': elapsed_seconds,
              'paced': False, 'chunkFactor': args.chunk_factor, 'chunkSamples': chunk_samples, 'chunkMs': chunk_ms,
              'computeMs': compute, 'computeRealTimeFactor': sum(traced.timings) / 30000,
              'blocksOverComputeDeadline': sum(value > chunk_ms for value in traced.timings),
              'upstreamSpeedRatio': float(upstream_speed_ratio),
              'upstreamBufferPlusMeanComputeEstimateMs': float(upstream_estimate_ms),
              'p95BufferPlusComputeEstimateMs': 2 * model.L / 16 + chunk_ms + compute['p95'],
              'deterministicResetMaxAbsError': repeat_error, 'outputSamples': len(samples),
              'outputPeak': float(np.max(np.abs(samples))), 'outputRms': float(np.sqrt(np.mean(samples ** 2))),
              'files': [{'path': str(file.relative_to(ROOT)).replace('\\', '/'), 'sha256': sha(file), 'bytes': file.stat().st_size} for file in [audio_file, reference_file]],
              'timingSamplesMs': traced.timings,
              'physicalMicrophone': False, 'physicalPlayback': False, 'networkInference': False, 'liveAccepted': False,
              'limits': ['Unpaced reference-file inference, without Ene, tracking, OBS or physical audio.',
                         'Upstream constructs all file chunks before the timed model loop; this does not measure live input arrival, device buffers or packet scheduling.',
                         'Reported buffer-plus-compute estimates exclude capture/output devices, queues, routing and acoustic alignment; they are not measured end-to-end latency.',
                         'The original upstream input shift/padding behavior is retained; no physical sync claim.',
                         'One research target voice only; English character fit and user preference are unaccepted.',
                         'Training dropout is disabled explicitly; upstream CLI omission of eval is not reproduced.']}
    destination = ROOT / 'ops/001-zhil/sprint-001/reports' / (name + '.json')
    destination.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'report': str(destination.relative_to(ROOT)), 'computeMs': compute,
                      'computeRealTimeFactor': report['computeRealTimeFactor'], 'deadlineMisses': report['blocksOverComputeDeadline'],
                      'resetMaxAbsError': repeat_error, 'liveAccepted': False}), flush=True)


if __name__ == '__main__':
    main()
