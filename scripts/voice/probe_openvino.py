"""Bounded Intel CPU/GPU conversion probe on the verified fixed ONNX graphs.

This uses public-domain cached speech features only. No microphone, speaker,
network audio, model download, auto-selected fallback, or production gate.
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
OUT = ROOT / 'ops/reports/local/voice/openvino'


def sha(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for block in iter(lambda: f.read(1048576), b''):
            h.update(block)
    return h.hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--device', choices=['CPU', 'GPU'], required=True)
    parser.add_argument('--precision', choices=['f32', 'f16'], default='f32')
    parser.add_argument('--accuracy', action='store_true', help='GPU accuracy hint and documented Winograd-disable option')
    parser.add_argument('--worker', action='store_true')
    args = parser.parse_args()
    if args.device == 'CPU' and args.precision != 'f32':
        parser.error('Only FP32 CPU is part of this bounded experiment')
    if args.device == 'CPU' and args.accuracy:
        parser.error('Accuracy correction is only a GPU probe')
    args.preset = f'{args.device.lower()}-{args.precision}' + ('-accuracy' if args.accuracy else '')
    report_path = ROOT / f'ops/reports/voice-openvino-{args.preset}.json'
    if not args.worker:
        interpreter = ROOT / '.tools/voice/openvino-venv/Scripts/python.exe'
        local_data = ROOT / '.tools/voice/isolation/openvino-localappdata'
        notice_dir = local_data / 'Intel Corporation'
        notice_dir.mkdir(parents=True, exist_ok=True)
        (notice_dir / 'openvino_telemetry').write_text('0', encoding='ascii')
        env = {k: os.environ[k] for k in ['SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP'] if k in os.environ}
        env.update(PATH=str(interpreter.parent), PYTHONIOENCODING='utf-8', OMP_NUM_THREADS='3', LOCALAPPDATA=str(local_data))
        # OpenVINO's import initializes OVC telemetry. Its supported consent file
        # is explicitly declined in this worker-only directory before import.
        command = [str(interpreter), '-I', str(Path(__file__).resolve()), '--worker',
                   '--device', args.device, '--precision', args.precision]
        if args.accuracy:
            command.append('--accuracy')
        process = subprocess.Popen(command, cwd=ROOT / '.tools/voice/isolation', env=env)
        try:
            code = process.wait(timeout=180)
        except subprocess.TimeoutExpired:
            subprocess.run(['taskkill', '/PID', str(process.pid), '/T', '/F'], check=False,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            progress = OUT / f'{args.preset}-progress.json'
            data = json.loads(progress.read_text()) if progress.exists() else None
            report_path.write_text(json.dumps({'schemaVersion': 1, 'status': 'timeout', 'device': args.device,
                'precision': args.precision, 'budgetSeconds': 180, 'progress': data,
                'qualityAccepted': False, 'actualExecutionVerified': False}, indent=2), encoding='utf-8')
            raise RuntimeError('OpenVINO probe exceeded 180-second preparation/measurement budget')
        if code:
            raise subprocess.CalledProcessError(code, command)
        return
    worker(args, report_path)


def worker(args, report_path):
    import socket
    def deny(*args, **kwargs):
        raise RuntimeError('No networking in local OpenVINO probe')
    socket.socket.connect = socket.socket.connect_ex = socket.create_connection = socket.getaddrinfo = deny
    import numpy as np
    import openvino as ov
    import soundfile as sf
    manifest = json.loads((MODEL / 'manifest.json').read_text())
    cpu_evidence = json.loads((ROOT / 'ops/reports/voice-onnx-cpu.json').read_text())
    if not cpu_evidence['parityPassed'] or cpu_evidence['modelArtifacts'] != manifest['artifacts']:
        raise RuntimeError('Same-model CPU ONNX numerical validation required first')
    for artifact in manifest['artifacts']:
        if sha(ROOT / artifact['path']) != artifact['sha256']:
            raise RuntimeError('Changed exported model or fixture')
    OUT.mkdir(parents=True, exist_ok=True)
    started = time.perf_counter()
    def progress(stage):
        record = {'stage': stage, 'elapsedSeconds': time.perf_counter() - started}
        (OUT / f'{args.preset}-progress.json').write_text(json.dumps(record), encoding='utf-8')
        print(json.dumps(record), flush=True)
    progress('device-enumeration')
    core = ov.Core()
    devices = {dev: str(core.get_property(dev, 'FULL_DEVICE_NAME')) for dev in core.available_devices}
    if args.device not in core.available_devices and not any(d.startswith(args.device + '.') for d in core.available_devices):
        raise RuntimeError(f'Requested device unavailable: {devices}')
    # Explicit device selection avoids silently timing a different backend.
    settings = {'PERFORMANCE_HINT': 'LATENCY', 'NUM_STREAMS': '1', 'PERF_COUNT': True,
                'INFERENCE_PRECISION_HINT': args.precision}
    if args.device == 'CPU':
        settings['INFERENCE_NUM_THREADS'] = 3
    if args.accuracy:
        settings['GPU_DISABLE_WINOGRAD_CONVOLUTION'] = True
        settings['EXECUTION_MODE_HINT'] = 'ACCURACY'
    cache = MODEL / 'openvino-cache' / args.preset
    cache.mkdir(parents=True, exist_ok=True)
    settings['CACHE_DIR'] = str(cache)
    compiled, requests, graph_times, properties = {}, {}, {}, {}
    for name in ['encoder', 'generator']:
        progress(f'compile-{name}')
        t0 = time.perf_counter()
        graph = core.read_model(str(MODEL / f'{name}.onnx'))
        compiled[name] = core.compile_model(graph, args.device, settings)
        graph_times[name] = time.perf_counter() - t0
        requests[name] = compiled[name].create_infer_request()
        properties[name] = {key: str(compiled[name].get_property(key)) for key in
                            ['EXECUTION_DEVICES', 'INFERENCE_PRECISION_HINT', 'NUM_STREAMS', 'OPTIMAL_NUMBER_OF_INFER_REQUESTS']}
    load_seconds = time.perf_counter() - started
    fixture = np.load(MODEL / 'fixture.npz', allow_pickle=False)
    def infer(name, values):
        request = requests[name]
        result = request.infer(values, share_inputs=False, share_outputs=False)
        return np.asarray(result[compiled[name].output(0)]).copy()
    def convert():
        t0 = time.perf_counter()
        # Encoder has projected/unit9/unit12 outputs; choose the validated unit12.
        result = requests['encoder'].infer({'audio': fixture['audio']}, share_inputs=False, share_outputs=False)
        raw = np.asarray(result[compiled['encoder'].output('unit12')]).copy()
        feats = np.repeat(np.concatenate([raw, raw[:, -1:]], axis=1), 2, axis=1)[:, :181].copy()
        t1 = time.perf_counter()
        audio = infer('generator', {'feats': feats, 'noise': fixture['noise']})
        t2 = time.perf_counter()
        return audio, feats, {'encoderMs': (t1-t0)*1000, 'generatorMs': (t2-t1)*1000, 'computeMs': (t2-t0)*1000}
    progress('warmup')
    audio, features, warmup = convert()
    records = []
    progress('five-measured-conversions')
    for _ in range(5):
        audio, features, timing = convert()
        records.append(timing)
    isolated = infer('generator', {'feats': fixture['feats'], 'noise': fixture['noise']})
    if audio.shape != (8400,) or not np.isfinite(audio).all():
        raise RuntimeError('Invalid OpenVINO output shape or values')
    gen_error = float(np.max(np.abs(isolated - fixture['expected'])))
    pipeline_error = float(np.max(np.abs(audio - fixture['expected'])))
    parity = gen_error <= 0.003 and pipeline_error <= 0.01
    profiles = {}
    for name, request in requests.items():
        events = [{'name': p.node_name, 'nodeType': p.node_type, 'executionType': p.exec_type,
                   'status': str(p.status), 'realTimeUs': p.real_time.total_seconds()*1e6,
                   'cpuTimeUs': p.cpu_time.total_seconds()*1e6} for p in request.get_profiling_info()]
        path = OUT / f'{args.preset}-{name}-profile.json'
        path.write_text(json.dumps(events, indent=2), encoding='utf-8')
        types = Counter(e['executionType'] for e in events if 'EXECUTED' in e['status'])
        profiles[name] = {'executedTypes': dict(types), 'path': path.relative_to(ROOT).as_posix(), 'sha256': sha(path)}
    output = OUT / f'{args.preset}-converted-window.wav'
    sf.write(output, audio, 40000, subtype='PCM_16')
    def stats(key):
        return {f'p{p}': float(np.percentile([r[key] for r in records], p)) for p in [50, 95]}
    report = {'schemaVersion': 1, 'status': 'completed', 'preset': args.preset, 'openvino': ov.__version__,
              'python': sys.version.split()[0], 'device': args.device, 'precision': args.precision,
              'availableDevices': devices, 'settings': {k:v for k,v in settings.items() if k != 'CACHE_DIR'},
              'properties': properties, 'modelArtifacts': manifest['artifacts'],
              'loadSeconds': load_seconds, 'compileSeconds': graph_times, 'warmup': warmup,
              'records': records, 'computeMs': stats('computeMs'), 'encoderMs': stats('encoderMs'), 'generatorMs': stats('generatorMs'),
              'computeRealTimeFactor': sum(r['computeMs'] for r in records)/(160*len(records)),
              'generatorVsEagerMaxAbsError': gen_error, 'pipelineVsEagerMaxAbsError': pipeline_error,
              'encoderMaxAbsError': float(np.max(np.abs(features-fixture['feats']))), 'parityPassed': parity,
              'profiles': profiles, 'actualExecutionVerified': all(p['executedTypes'] for p in profiles.values()),
              'allFinite': True, 'output': output.relative_to(ROOT).as_posix(), 'outputSha256': sha(output),
              'outputSeconds': len(audio)/40000, 'outputRms': float(np.sqrt(np.mean(audio**2))),
              'outputPeak': float(np.abs(audio).max()), 'microphoneCaptured': False,
              'telemetry': 'Explicit supported opt-out file in isolated LOCALAPPDATA before import; Python socket connections denied',
              'qualityAccepted': False, 'physicalLatencyMeasured': False,
              'boundary': 'One warmup/five repeated real-speech windows with profiling. Explicit compiled CPU/GPU; no resampling/SOLA/scheduling/device buffers/combined workload. Numerical gate is not listening or sustained live acceptance.'}
    report_path.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps({k:report[k] for k in ['device','precision','availableDevices','loadSeconds','computeMs','encoderMs','generatorMs','computeRealTimeFactor','generatorVsEagerMaxAbsError','pipelineVsEagerMaxAbsError','parityPassed','properties','actualExecutionVerified']}, indent=2), flush=True)
    if not parity:
        raise RuntimeError('Numerical parity gate failed; output remains diagnostic only')


if __name__ == '__main__':
    main()
