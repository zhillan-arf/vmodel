"""Convert the same complete English sample with experimental past contexts.

160 ms chunks, no-F0 target, full past-window re-encoding, identical latent noise
sequence, and SOLA are held constant. This is unpaced file conversion for sound
review and compute timing, not accepted microphone-to-output latency.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets/voice/auditions/context-v1'


def sha(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for block in iter(lambda: f.read(1048576), b''):
            h.update(block)
    return h.hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--context-ms', choices=[400, 800, 1600], type=int, required=True)
    parser.add_argument('--worker', action='store_true')
    args = parser.parse_args()
    if not args.worker:
        python = ROOT / '.tools/voice/openvino-venv/Scripts/python.exe'
        local_data = ROOT / '.tools/voice/isolation/openvino-localappdata'
        consent = local_data / 'Intel Corporation/openvino_telemetry'
        consent.parent.mkdir(parents=True, exist_ok=True)
        consent.write_text('0', encoding='ascii')
        env = {k: os.environ[k] for k in ['SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP'] if k in os.environ}
        env.update(PATH=str(python.parent), PYTHONIOENCODING='utf-8', OMP_NUM_THREADS='3', LOCALAPPDATA=str(local_data))
        command = [str(python), '-I', str(Path(__file__).resolve()), '--worker', '--context-ms', str(args.context_ms)]
        process = subprocess.Popen(command, cwd=ROOT / '.tools/voice/isolation', env=env)
        try:
            code = process.wait(timeout=180)
        except subprocess.TimeoutExpired:
            subprocess.run(['taskkill', '/PID', str(process.pid), '/T', '/F'], check=False,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            raise RuntimeError('Bounded context comparison exceeded 180 seconds')
        if code:
            raise subprocess.CalledProcessError(code, command)
        return
    worker(args)


def worker(args):
    import socket
    def deny(*args, **kwargs):
        raise RuntimeError('No networking in local context comparison')
    socket.socket.connect = socket.socket.connect_ex = socket.create_connection = socket.getaddrinfo = deny
    import numpy as np
    import openvino as ov
    import soundfile as sf
    from scipy.signal import resample_poly, correlate, convolve
    folder = 'bright-160ms-v1' if args.context_ms == 1600 else f'bright-160ms-context{args.context_ms}-v1'
    model_dir = ROOT / 'assets/voice/onnx' / folder
    manifest = json.loads((model_dir / 'manifest.json').read_text())
    if manifest['contextMs'] != args.context_ms or manifest['eagerAdapterMaxAbsError'] > 1e-6:
        raise RuntimeError('Wrong context graph or failed eager-adapter parity')
    for artifact in manifest['artifacts']:
        if sha(ROOT / artifact['path']) != artifact['sha256']:
            raise RuntimeError('Changed experimental graph/fixture')
    assets = json.loads((ROOT / 'config/voice/assets.json').read_text())
    sample = next(a for a in assets['assets'] if a['id'] == 'ljspeech-sample')
    if sha(ROOT / sample['path']) != sample['sha256']:
        raise RuntimeError('Changed licensed input')
    core = ov.Core()
    settings = {'PERFORMANCE_HINT': 'LATENCY', 'NUM_STREAMS': '1', 'INFERENCE_PRECISION_HINT': 'f32',
                'INFERENCE_NUM_THREADS': 3, 'PERF_COUNT': False,
                'CACHE_DIR': str(model_dir / 'openvino-cache/cpu-f32')}
    Path(settings['CACHE_DIR']).mkdir(parents=True, exist_ok=True)
    started = time.perf_counter()
    encoder = core.compile_model(core.read_model(str(model_dir / 'encoder.onnx')), 'CPU', settings)
    generator = core.compile_model(core.read_model(str(model_dir / 'generator.onnx')), 'CPU', settings)
    enc_request, gen_request = encoder.create_infer_request(), generator.create_infer_request()
    fixture = np.load(model_dir / 'fixture.npz', allow_pickle=False)
    result = gen_request.infer({'feats': fixture['feats'], 'noise': fixture['noise']}, share_outputs=False)
    parity_error = float(np.max(np.abs(result[generator.output('audio')] - fixture['expected'])))
    if parity_error > 0.003:
        raise RuntimeError(f'CPU context graph failed original-inference parity: {parity_error}')
    speech, rate = sf.read(ROOT / sample['path'], dtype='float32')
    divisor = math.gcd(rate, 16000)
    speech = resample_poly(speech, 16000 // divisor, rate // divisor).astype(np.float32)
    block_in, block_out, cross, search = 2560, 6400, 1600, 400
    feature_count = manifest['features'][1]
    source_samples = len(speech)
    count = math.ceil(source_samples / block_in)
    trailing_pad = count * block_in - source_samples
    speech = np.pad(speech, (0, trailing_pad))
    buffer = np.zeros(feature_count * 160, dtype=np.float32)
    overlap = np.zeros(cross, dtype=np.float32)
    fade = (np.sin(0.5 * np.pi * np.linspace(0, 1, cross)) ** 2).astype(np.float32)
    random = np.random.default_rng(224)
    def process(block):
        nonlocal buffer, overlap
        buffer = np.concatenate([buffer[block_in:], block])
        noise = random.standard_normal(tuple(manifest['noise']), dtype=np.float32)
        t0 = time.perf_counter()
        result = enc_request.infer({'audio': buffer.reshape(1, -1)}, share_outputs=False)
        raw = np.asarray(result[encoder.output('unit12')]).copy()
        features = np.repeat(np.concatenate([raw, raw[:, -1:]], axis=1), 2, axis=1)[:, :feature_count].copy()
        t1 = time.perf_counter()
        result = gen_request.infer({'feats': features, 'noise': noise}, share_outputs=False)
        generated = np.asarray(result[generator.output('audio')]).copy()
        t2 = time.perf_counter()
        segment = generated[:cross + search]
        numerator = correlate(segment, overlap, mode='valid', method='direct')
        denominator = np.sqrt(convolve(segment ** 2, np.ones(cross, dtype=np.float32), mode='valid', method='direct') + 1e-8)
        offset = int(np.argmax(numerator / denominator))
        generated = generated[offset:]
        generated[:cross] = generated[:cross] * fade + overlap * (1 - fade)
        overlap = generated[block_out:block_out + cross].copy()
        output = generated[:block_out].copy()
        return output, {'encoderMs': (t1-t0)*1000, 'generatorMs': (t2-t1)*1000,
                        'computeMs': (time.perf_counter()-t0)*1000, 'solaOffsetSamples': offset}
    for i in range(10):
        process(speech[(i % count)*block_in:(i % count+1)*block_in])
    warmup_seconds = time.perf_counter() - started
    buffer = np.zeros_like(buffer)
    overlap = np.zeros_like(overlap)
    random = np.random.default_rng(224)
    outputs, records = [], []
    print(f'Converting {count} complete English blocks with {args.context_ms} ms past context', flush=True)
    for i in range(count):
        output, timing = process(speech[i*block_in:(i+1)*block_in])
        if len(output) != block_out or not np.isfinite(output).all():
            raise RuntimeError('Invalid context-comparison output')
        outputs.append(output)
        records.append(timing)
    combined = np.concatenate(outputs)
    jumps, normalized, boundaries = [], [], []
    for position in range(block_out, len(combined), block_out):
        jump = float(abs(combined[position] - combined[position-1]))
        nearby = combined[position-200:position+200]
        differences = np.delete(np.diff(nearby), 199)
        local_difference_rms = float(np.sqrt(np.mean(differences ** 2)))
        ratio = jump / max(local_difference_rms, 1e-6)
        jumps.append(jump)
        normalized.append(ratio)
        boundaries.append({'sample': position, 'jump': jump, 'localDifferenceRms': local_difference_rms, 'normalizedJump': ratio})
    OUT.mkdir(parents=True, exist_ok=True)
    output_path = OUT / f'context{args.context_ms}.wav'
    sf.write(output_path, combined, 40000, subtype='PCM_16')
    # Identical source excerpt for every candidate, at the target playback rate.
    source_path = OUT / 'source.wav'
    if not source_path.exists():
        sf.write(source_path, resample_poly(speech, 5, 2), 40000, subtype='PCM_16')
    def stats(values):
        return {'p50': float(np.percentile(values, 50)), 'p95': float(np.percentile(values, 95)), 'max': float(max(values))}
    report = {'schemaVersion': 1, 'contextMs': args.context_ms, 'chunkMs': 160, 'crossfadeMs': 40, 'solaSearchMs': 10,
              'modelArtifacts': manifest['artifacts'], 'sourceOriginalSha256': sample['sha256'],
              'backend': 'OpenVINO CPU FP32 / 3 threads / 1 stream', 'openvino': ov.__version__,
              'executionDevices': {'encoder': str(encoder.get_property('EXECUTION_DEVICES')), 'generator': str(generator.get_property('EXECUTION_DEVICES'))},
              'generatorFixtureVsOriginalMaxAbsError': parity_error, 'warmupChunks': 10, 'loadAndWarmupSeconds': warmup_seconds,
              'blocks': count, 'sourceSecondsBeforeTrailingPad': source_samples/16000,
              'trailingSilencePaddingSeconds': trailing_pad/16000,
              'inputSeconds': len(speech)/16000, 'outputSeconds': len(combined)/40000,
              'encoderMs': stats([r['encoderMs'] for r in records]), 'generatorMs': stats([r['generatorMs'] for r in records]),
              'computeMs': stats([r['computeMs'] for r in records]),
              'computeRealTimeFactor': sum(r['computeMs'] for r in records)/(count*160),
              'blocksSlowerThan160Ms': sum(r['computeMs'] > 160 for r in records),
              'boundaryJump': stats(jumps), 'normalizedBoundaryJump': stats(normalized),
              'boundaryMetricDefinition': 'Adjacent-sample jump at each 160 ms join divided by RMS adjacent differences in the surrounding 10 ms, excluding the join. Diagnostic only; not an audibility or word-intelligibility threshold.',
              'rms': float(np.sqrt(np.mean(combined**2))), 'peak': float(np.max(np.abs(combined))),
              'clippedFraction': float(np.mean(np.abs(combined) >= 0.999)), 'allFinite': True,
              'output': output_path.relative_to(ROOT).as_posix(), 'outputSha256': sha(output_path),
              'sourceReference': source_path.relative_to(ROOT).as_posix(), 'sourceReferenceSha256': sha(source_path),
              'records': records, 'boundaries': boundaries, 'qualityAccepted': False, 'microphoneCaptured': False,
              'physicalLatencyMeasured': False,
              'boundary': 'Unpaced complete English file with startup silence context; no blocks skipped/muted, so slow configurations remain listenable for comparison. Ten-block warmup outside measurements. No real capture/output devices, physical latency, combined workload or five-minute acceptance.'}
    (ROOT / f'ops/reports/voice-context{args.context_ms}.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps({k:report[k] for k in ['contextMs','generatorFixtureVsOriginalMaxAbsError','blocks','computeMs','computeRealTimeFactor','blocksSlowerThan160Ms','normalizedBoundaryJump','rms','output']}, indent=2), flush=True)


if __name__ == '__main__':
    main()
