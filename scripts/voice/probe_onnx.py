"""Tiny fixed-shape ONNX conversion/parity/provider probe; no hardware audio.

Runs CPU first with the baseline runtime, then DirectML in its separate venv.
Each mode performs one warmup and five measured real-speech-window conversions.
These windows are not a paced stream or a sustained quality/latency acceptance.
"""
from __future__ import annotations
import argparse
from collections import Counter
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[2]
MODEL = ROOT / 'assets/voice/onnx/bright-160ms-v1'
OUT = ROOT / 'ops/001-zhil/sprint-001/reports/local/voice/onnx'


def digest(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for block in iter(lambda: f.read(1048576), b''):
            h.update(block)
    return h.hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--provider', choices=['cpu', 'directml'], required=True)
    parser.add_argument('--worker', action='store_true')
    args = parser.parse_args()
    if not args.worker:
        venv = 'venv' if args.provider == 'cpu' else 'onnx-venv'
        interpreter = ROOT / f'.tools/voice/{venv}/Scripts/python.exe'
        env = {k: os.environ[k] for k in ['SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP'] if k in os.environ}
        env.update(PATH=str(interpreter.parent), PYTHONIOENCODING='utf-8', OMP_NUM_THREADS='3', MKL_NUM_THREADS='3')
        process = subprocess.Popen([str(interpreter), '-I', str(Path(__file__).resolve()), '--worker', '--provider', args.provider],
                                   cwd=ROOT / '.tools/voice/isolation', env=env)
        try:
            code = process.wait(timeout=240)
        except subprocess.TimeoutExpired:
            # uv's Windows venv may create an interpreter child. Terminate only
            # this owned probe tree, leaving the audition server untouched.
            subprocess.run(['taskkill', '/PID', str(process.pid), '/T', '/F'], check=False,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            progress = OUT / f'{args.provider}-progress.json'
            report = {'schemaVersion': 1, 'provider': args.provider, 'status': 'probe-timeout',
                      'budgetSeconds': 240, 'parityPassed': False, 'qualityAccepted': False,
                      'actualDirectMLExecution': None, 'microphoneCaptured': False,
                      'progress': json.loads(progress.read_text()) if progress.exists() else None,
                      'boundary': 'No successful completed probe within the bounded preparation/measurement budget. Availability alone is not execution evidence.'}
            (ROOT / f'ops/001-zhil/sprint-001/reports/voice-onnx-{args.provider}.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
            raise RuntimeError('ONNX probe exceeded its four-minute preparation/measurement budget')
        if code:
            raise subprocess.CalledProcessError(code, process.args)
        return
    worker(args)


def worker(args):
    import socket
    def deny(*args, **kwargs):
        raise RuntimeError('No networking in local ONNX probe')
    socket.socket.connect = socket.socket.connect_ex = socket.create_connection = socket.getaddrinfo = deny
    import numpy as np
    import onnxruntime as ort
    import soundfile as sf
    manifest = json.loads((MODEL / 'manifest.json').read_text())
    for artifact in manifest['artifacts']:
        if digest(ROOT / artifact['path']) != artifact['sha256']:
            raise RuntimeError('Changed exported model/fixture')
    if args.provider == 'directml':
        cpu = json.loads((ROOT / 'ops/001-zhil/sprint-001/reports/voice-onnx-cpu.json').read_text())
        if not cpu['parityPassed'] or cpu['modelArtifacts'] != manifest['artifacts']:
            raise RuntimeError('Same-model CPU parity must pass first')
    OUT.mkdir(parents=True, exist_ok=True)
    started = time.perf_counter()
    def progress(stage):
        (OUT / f'{args.provider}-progress.json').write_text(json.dumps({'stage': stage,
            'elapsedSeconds': time.perf_counter() - started}), encoding='utf-8')
    provider = 'CPUExecutionProvider' if args.provider == 'cpu' else 'DmlExecutionProvider'
    if provider not in ort.get_available_providers():
        raise RuntimeError(f'{provider} unavailable: {ort.get_available_providers()}')
    def session(name):
        progress(f'creating-{name}-session')
        print(f'Creating {name} session', flush=True)
        options = ort.SessionOptions()
        options.intra_op_num_threads, options.inter_op_num_threads = 3, 1
        options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
        options.enable_mem_pattern = False
        options.log_severity_level = 3
        options.enable_profiling = True
        options.profile_file_prefix = str(OUT / f'{args.provider}-{name}')
        providers = [provider] if args.provider == 'cpu' else [(provider, {'device_id': '0'}), 'CPUExecutionProvider']
        return ort.InferenceSession(str(MODEL / f'{name}.onnx'), sess_options=options, providers=providers)
    began = time.perf_counter()
    print(f'Loading fixed encoder + generator for {provider}', flush=True)
    encoder = session('encoder')
    print('Encoder session ready', flush=True)
    generator = session('generator')
    progress('sessions-ready')
    print('Generator session ready; converting the speech fixture', flush=True)
    load_seconds = time.perf_counter() - began
    fixture = np.load(MODEL / 'fixture.npz', allow_pickle=False)
    def convert():
        started = time.perf_counter()
        raw = encoder.run(['unit12'], {'audio': fixture['audio']})[0]
        features = np.repeat(np.concatenate([raw, raw[:, -1:]], axis=1), 2, axis=1)[:, :181].copy()
        encoded = time.perf_counter()
        audio = generator.run(['audio'], {'feats': features, 'noise': fixture['noise']})[0]
        ended = time.perf_counter()
        return audio, features, {'encoderMs': (encoded - started) * 1000,
                                  'generatorMs': (ended - encoded) * 1000,
                                  'computeMs': (ended - started) * 1000}
    audio, feats, warmup = convert()
    progress('warmup-completed')
    records = []
    for _ in range(5):
        audio, feats, timing = convert()
        records.append(timing)
    progress('five-conversions-completed')
    if audio.shape != (8400,) or not np.isfinite(audio).all():
        raise RuntimeError('Invalid ONNX output shape/values')
    # Compare each generator on identical cached features separately from any
    # provider-related encoder differences, and compare the complete pipeline.
    generator_only = generator.run(['audio'], {'feats': fixture['feats'], 'noise': fixture['noise']})[0]
    expected = fixture['expected']
    gen_error = float(np.max(np.abs(generator_only - expected)))
    pipeline_error = float(np.max(np.abs(audio - expected)))
    feature_error = float(np.max(np.abs(feats - fixture['feats'])))
    gen_rmse = float(np.sqrt(np.mean((generator_only - expected) ** 2)))
    pipeline_rmse = float(np.sqrt(np.mean((audio - expected) ** 2)))
    # Explicit numerical gate; passing is not a subjective quality judgement.
    parity_passed = gen_error <= 0.003 and pipeline_error <= 0.01
    profiles = {}
    for name, runtime in [('encoder', encoder), ('generator', generator)]:
        path = Path(runtime.end_profiling())
        events = json.loads(path.read_text())
        counts = Counter(e.get('args', {}).get('provider') for e in events
                         if e.get('cat') == 'Node' and e.get('args', {}).get('provider'))
        durations = Counter()
        for e in events:
            p = e.get('args', {}).get('provider')
            if e.get('cat') == 'Node' and p:
                durations[p] += e.get('dur', 0)
        profiles[name] = {'configuredProviders': runtime.get_providers(),
                          'executedNodeEventsByProvider': dict(counts),
                          'nodeEventDurationUsByProvider': dict(durations),
                          'profilePath': path.relative_to(ROOT).as_posix(), 'profileSha256': digest(path)}
    # One actual 210 ms model output containing the 160 ms block + overlaps.
    output = OUT / f'{args.provider}-converted-window.wav'
    sf.write(output, audio, 40000, subtype='PCM_16')
    def stats(key):
        return {f'p{p}': float(np.percentile([r[key] for r in records], p)) for p in [50, 95]}
    report = {'schemaVersion': 1, 'status': 'completed', 'provider': args.provider, 'onnxruntime': ort.__version__,
              'python': sys.version.split()[0], 'availableProviders': ort.get_available_providers(),
              'deviceId': 0 if args.provider == 'directml' else None, 'cpuThreads': 3,
              'modelArtifacts': manifest['artifacts'], 'loadSeconds': load_seconds,
              'warmup': warmup, 'measuredConversions': len(records), 'records': records,
              'computeMs': stats('computeMs'), 'encoderMs': stats('encoderMs'), 'generatorMs': stats('generatorMs'),
              'computeRealTimeFactor': sum(r['computeMs'] for r in records) / (160 * len(records)),
              'generatorVsEagerMaxAbsError': gen_error, 'generatorVsEagerRmse': gen_rmse,
              'pipelineVsEagerMaxAbsError': pipeline_error, 'pipelineVsEagerRmse': pipeline_rmse,
              'encoderMaxAbsError': feature_error, 'parityPassed': parity_passed,
              'allFinite': True, 'outputRms': float(np.sqrt(np.mean(audio ** 2))),
              'outputPeak': float(np.abs(audio).max()), 'outputSeconds': len(audio) / 40000,
              'output': output.relative_to(ROOT).as_posix(), 'outputSha256': digest(output),
              'profiles': profiles,
              'actualDirectMLExecution': all(p['executedNodeEventsByProvider'].get('DmlExecutionProvider', 0) > 0 for p in profiles.values()),
              'microphoneCaptured': False, 'physicalLatencyMeasured': False, 'qualityAccepted': False,
              'boundary': 'Five repeated real-speech windows after one warmup, profiling enabled. No paced stream, device IO, SOLA, resampling, avatar/OBS combined workload or sustained quality gate. Fixed model shape and explicit seeded noise only.'}
    (ROOT / f'ops/001-zhil/sprint-001/reports/voice-onnx-{args.provider}.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps({k: report[k] for k in ['provider', 'loadSeconds', 'computeMs', 'encoderMs', 'generatorMs', 'computeRealTimeFactor', 'generatorVsEagerMaxAbsError', 'pipelineVsEagerMaxAbsError', 'parityPassed', 'actualDirectMLExecution', 'profiles']}, indent=2), flush=True)
    if not parity_passed:
        raise RuntimeError('Numerical parity gate failed; output is diagnostic only')


if __name__ == '__main__':
    main()
