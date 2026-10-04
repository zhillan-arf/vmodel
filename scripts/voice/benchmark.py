"""Bounded paced CPU RVC spike. Hardware audio and production acceptance are separate.

Runs immutable preset IDs in isolated children. A one-slot input mailbox drops
old queued blocks; late output is measured and muted in the deadline WAV.
"""
from __future__ import annotations

import argparse
import ctypes
from ctypes import wintypes
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / 'ops/001-zhil/sprint-001/reports/local/voice/benchmarks'


def digest(path):
    checksum = hashlib.sha256()
    with open(path, 'rb') as file:
        for block in iter(lambda: file.read(1024 * 1024), b''):
            checksum.update(block)
    return checksum.hexdigest()


def system_times():
    values = [wintypes.FILETIME() for _ in range(3)]
    if not ctypes.windll.kernel32.GetSystemTimes(*(ctypes.byref(v) for v in values)):
        raise ctypes.WinError()
    return [v.dwHighDateTime * 2 ** 32 + v.dwLowDateTime for v in values]


def system_load(before, after):
    idle, kernel, user = [b - a for a, b in zip(before, after)]
    return 100 * (1 - idle / max(kernel + user, 1))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--preset', choices=['cpu-fp32-eager-4t', 'cpu-q8-eager-3t', 'cpu-q8-eager-1t'], required=True)
    parser.add_argument('--worker', action='store_true')
    parser.add_argument('--prepare-only', action='store_true')
    options = parser.parse_args()
    if not options.worker:
        interpreter = ROOT / '.tools/voice/venv/Scripts/python.exe'
        environment = {k: os.environ[k] for k in ['SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP'] if k in os.environ}
        environment.update(PATH=str(interpreter.parent), PYTHONNOUSERSITE='1', PYTHONIOENCODING='utf-8',
                           TORCH_FORCE_WEIGHTS_ONLY_LOAD='1', CUDA_VISIBLE_DEVICES='-1',
                           HF_HUB_OFFLINE='1', VMODEL_VOICE_GIT=shutil.which('git') or '')
        command = [str(interpreter), '-I', str(Path(__file__).resolve()), '--worker', '--preset', options.preset]
        if options.prepare_only:
            command.append('--prepare-only')
        subprocess.run(command, cwd=ROOT / '.tools/voice/isolation', env=environment, check=True)
        return
    worker(options)


def worker(options):
    import socket
    def denied(*args, **kwargs):
        raise RuntimeError('Networking disabled during local CPU benchmark')
    socket.socket.connect = denied
    socket.socket.connect_ex = denied
    socket.create_connection = denied
    socket.getaddrinfo = denied
    plan = json.loads((ROOT / 'config/voice/benchmark-presets.json').read_text())
    preset = next(p for p in plan['presets'] if p['id'] == options.preset)
    assets = json.loads((ROOT / 'config/voice/assets.json').read_text())
    by_id = {p['id']: p for p in assets['assets']}
    source = ROOT / assets['engine']['path']
    git = os.environ['VMODEL_VOICE_GIT']
    revision = subprocess.check_output([git, '-C', str(source), 'rev-parse', 'HEAD'], text=True).strip()
    if revision != assets['engine']['revision'] or subprocess.check_output([git, '-C', str(source), 'diff', '--name-only', 'HEAD'], text=True).strip():
        raise RuntimeError('Changed upstream source')
    for name in [plan['voice'], 'contentvec-onnx', 'ljspeech-sample']:
        if digest(ROOT / by_id[name]['path']) != by_id[name]['sha256']:
            raise RuntimeError('Changed benchmark asset')
    sys.path.insert(0, str(source / 'server'))
    import numpy as np
    import torch
    import torch.nn.functional as F
    from torchaudio.transforms import Resample
    import onnxruntime as ort
    import soundfile as sf
    from voice_changer.common.deviceManager.DeviceManager import DeviceManager
    from voice_changer.RVC.inferencer.RVCInferencerv2Nono import RVCInferencerv2Nono
    from voice_changer.common.OnnxLoader import load_cached_quantized_model
    torch.set_num_threads(preset['threads'])
    torch.set_num_interop_threads(1)
    torch.manual_seed(224)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    loaded = time.perf_counter()
    encoder_path = ROOT / by_id['contentvec-onnx']['path']
    if preset['encoder'] == 'q8':
        # This is exactly the pinned fork's CPU quantization: MatMul/Attention,
        # signed int8 weights, per-channel and reduced range.
        prepared = load_cached_quantized_model(str(encoder_path))
        del prepared
        encoder_path = encoder_path.with_name(encoder_path.stem + '.q8.onnx')
    if options.prepare_only:
        print(json.dumps({'preparedEncoder': str(encoder_path), 'sha256': digest(encoder_path), 'seconds': time.perf_counter() - loaded}), flush=True)
        return
    print(f"Loading {preset['id']}", flush=True)
    manager = DeviceManager.get_instance()
    manager.initialize(-1, True, True)
    target = (ROOT / by_id[plan['voice']]['path']).with_suffix('.safetensors')
    original = torch.load(ROOT / by_id[plan['voice']]['path'], map_location='cpu', weights_only=True)
    from safetensors.torch import load_file
    safe = load_file(str(target))
    if safe.keys() != original['weight'].keys() or any(not torch.equal(value, safe[k]) for k, value in original['weight'].items()):
        raise RuntimeError('Changed safe target tensors')
    del safe, original
    generator = RVCInferencerv2Nono().load_model(str(target))
    generator.use_jit = generator.use_jit_eager
    jit_validation = None
    settings = ort.SessionOptions()
    settings.intra_op_num_threads = preset['threads']
    settings.inter_op_num_threads = 1
    settings.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
    settings.log_severity_level = 3
    encoder = ort.InferenceSession(str(encoder_path), sess_options=settings, providers=['CPUExecutionProvider'])
    rate = plan['sampleRate']
    block = round(rate * plan['chunkMs'] / 1000)
    block16 = round(16000 * plan['chunkMs'] / 1000)
    cross = round(rate * plan['crossfadeMs'] / 1000)
    search = round(rate * plan['solaSearchMs'] / 1000)
    context16 = round(16000 * plan['contextMs'] / 1000)
    size16 = block16 + context16 + round(16000 * (plan['crossfadeMs'] + plan['solaSearchMs']) / 1000)
    size16 = int(np.ceil(size16 / 160)) * 160
    feature_count = size16 // 160
    skip_head = context16 // 160
    return_length = feature_count - skip_head
    buffer = torch.zeros(size16)
    sola = torch.zeros(cross)
    fade = torch.sin(0.5 * torch.pi * torch.linspace(0, 1, cross)) ** 2
    resample_in = Resample(rate, 16000)
    resample_out = Resample(40000, rate)
    speech, source_rate = sf.read(ROOT / by_id['ljspeech-sample']['path'], dtype='float32')
    speech = Resample(source_rate, rate)(torch.from_numpy(speech)).numpy()
    speech = np.concatenate([speech, np.zeros(rate // 4, dtype=np.float32)])
    source_audio = np.tile(speech, int(np.ceil((plan['measurementSeconds'] + 10) * rate / len(speech))))
    def input_block(sequence):
        start = (sequence * block) % (len(source_audio) - block)
        return source_audio[start:start + block]

    @torch.inference_mode()
    def process(audio):
        nonlocal buffer, sola
        audio16 = resample_in(torch.from_numpy(audio))
        buffer = torch.cat((buffer[len(audio16):], audio16))
        stage_start = time.perf_counter()
        feats = torch.from_numpy(encoder.run(['unit12'], {'audio': buffer.numpy().reshape(1, -1)})[0])
        stage_encoded = time.perf_counter()
        feats = torch.cat((feats, feats[:, -1:, :]), dim=1)
        feats = F.interpolate(feats.permute(0, 2, 1), scale_factor=2, mode='nearest').permute(0, 2, 1)[:, :feature_count].contiguous()
        output = generator.infer(feats, torch.tensor([feature_count]), None, None, torch.tensor([0]), skip_head, return_length, return_length)
        output = resample_out(output)
        stage_generated = time.perf_counter()
        segment = output[None, None, :cross + search]
        numerator = F.conv1d(segment, sola[None, None])
        denominator = torch.sqrt(F.conv1d(segment ** 2, torch.ones(1, 1, cross)) + 1e-8)
        offset = int(torch.argmax(numerator[0, 0] / denominator[0, 0]))
        output = output[offset:]
        output[:cross] = output[:cross] * fade + sola * (1 - fade)
        sola = output[block:block + cross].clone()
        answer = output[:block].numpy().copy()
        if len(answer) != block or not np.isfinite(answer).all():
            raise RuntimeError('Invalid streaming output')
        return answer, (stage_encoded - stage_start) * 1000, (stage_generated - stage_encoded) * 1000

    for index in range(plan['warmupChunks']):
        process(input_block(index))
    load_warmup_seconds = time.perf_counter() - loaded
    buffer = torch.zeros(size16)
    sola = torch.zeros(cross)
    idle_before = system_times()
    time.sleep(2)
    baseline_cpu = system_load(idle_before, system_times())
    print(f"Measuring {preset['id']} for {plan['measurementSeconds']} paced seconds", flush=True)
    duration = plan['chunkMs'] / 1000
    count = int(plan['measurementSeconds'] / duration)
    deadline_audio = np.zeros(count * block, dtype=np.float32)
    full_audio = np.zeros_like(deadline_audio)
    records = []
    sequence = 0
    dropped = 0
    before_system = system_times()
    before_cpu = time.process_time()
    start = time.perf_counter()
    while sequence < count:
        due = start + (sequence + 1) * duration
        remaining = due - time.perf_counter()
        if remaining > 0:
            time.sleep(remaining)
        # Keep at most the most recently completed capture block in the mailbox.
        latest = min(count - 1, max(sequence, int((time.perf_counter() - start) / duration) - 1))
        skipped = latest - sequence
        if skipped:
            dropped += skipped
            buffer = torch.zeros(size16)
            sola = torch.zeros(cross)  # Flush discontinuous context; never replay stale speech.
        sequence = latest
        due = start + (sequence + 1) * duration
        began = time.perf_counter()
        output, encode_ms, generate_ms = process(input_block(sequence))
        finished = time.perf_counter()
        ready_ms = (finished - due) * 1000
        late = finished > due + duration
        full_audio[sequence * block:(sequence + 1) * block] = output
        if not late:
            deadline_audio[sequence * block:(sequence + 1) * block] = output
        records.append({'sequence': sequence, 'computeMs': (finished - began) * 1000,
                        'encoderMs': encode_ms, 'generatorMs': generate_ms,
                        'queueWaitMs': max(0, (began - due) * 1000), 'readyAfterCaptureBlockMs': ready_ms,
                        'firstInputSampleToReadyMs': plan['chunkMs'] + ready_ms,
                        'deadlineMiss': late, 'skippedBefore': skipped})
        sequence += 1
    elapsed = time.perf_counter() - start
    after_cpu = time.process_time()
    after_system = system_times()
    def stats(key):
        values = [r[key] for r in records]
        return {'p50': float(np.percentile(values, 50)), 'p95': float(np.percentile(values, 95)), 'max': max(values)}
    deadline_path = OUTPUT / (preset['id'] + '-deadline.wav')
    full_path = OUTPUT / (preset['id'] + '-computed.wav')
    sf.write(deadline_path, deadline_audio, rate, subtype='PCM_16')
    sf.write(full_path, full_audio, rate, subtype='PCM_16')
    report = {'schemaVersion': 1, 'preset': preset, 'settings': {k: v for k, v in plan.items() if k != 'presets'},
              'engineRevision': revision, 'targetSha256': by_id[plan['voice']]['sha256'], 'safeTargetSha256': digest(target),
              'sourceSha256': by_id['ljspeech-sample']['sha256'], 'encoderSha256': digest(encoder_path),
              'torch': torch.__version__, 'onnxruntime': ort.__version__, 'providers': encoder.get_providers(),
              'loadAndWarmupSeconds': load_warmup_seconds, 'elapsedSeconds': elapsed, 'jitValidation': jit_validation,
              'scheduledBlocks': count, 'processedBlocks': len(records), 'droppedInputBlocks': dropped,
              'deadlineMisses': sum(r['deadlineMiss'] for r in records),
              'computeMs': stats('computeMs'), 'encoderMs': stats('encoderMs'), 'generatorMs': stats('generatorMs'),
              'readyAfterCaptureBlockMs': stats('readyAfterCaptureBlockMs'),
              'firstInputSampleToReadyMs': stats('firstInputSampleToReadyMs'),
              'computeRealTimeFactor': sum(r['computeMs'] for r in records) / (len(records) * plan['chunkMs']),
              'processCpuSeconds': after_cpu - before_cpu, 'baselineSystemCpuAveragePercent': baseline_cpu,
              'systemCpuAveragePercent': system_load(before_system, after_system),
              'computedRms': float(np.sqrt(np.mean(full_audio ** 2))), 'deadlineRms': float(np.sqrt(np.mean(deadline_audio ** 2))),
              'allFinite': bool(np.isfinite(full_audio).all()), 'computedPeak': float(np.abs(full_audio).max()),
              'computedClippedFraction': float(np.mean(np.abs(full_audio) >= 1)),
              'outputs': [{'path': p.relative_to(ROOT).as_posix(), 'sha256': digest(p)} for p in [full_path, deadline_path]],
              'records': records,
              'physicalAudioMeasured': False, 'microphoneCaptured': False, 'audibleQualityAccepted': False,
              'boundary': 'Synthetic file replay/CPU compute and bounded scheduling only. Input-sample-to-ready timestamps exclude actual device buffers, playback/routing and acoustic/phonetic alignment. No live gate accepted.'}
    (OUTPUT / (preset['id'] + '.json')).write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps({k: report[k] for k in ['preset', 'scheduledBlocks', 'processedBlocks', 'droppedInputBlocks', 'deadlineMisses', 'computeMs', 'firstInputSampleToReadyMs', 'computeRealTimeFactor', 'systemCpuAveragePercent']}, indent=2), flush=True)


if __name__ == '__main__':
    main()
