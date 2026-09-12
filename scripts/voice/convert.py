"""Local licensed-file RVC smoke/audition conversion; no microphone or server.

Uses the pinned deiteris RVC v2 no-F0 generator and ContentVec ONNX encoder.
The supported catalog deliberately excludes pitch estimation/retrieval assets.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import shutil

ROOT = Path(__file__).resolve().parents[2]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--voice', choices=['bright', 'soft', 'cool'], default='bright')
    parser.add_argument('--input', type=Path, default=ROOT / 'assets/voice/samples/LJ025-0076.wav')
    parser.add_argument('--output', type=Path)
    parser.add_argument('--threads', type=int, default=4)
    parser.add_argument('--worker', action='store_true', help=argparse.SUPPRESS)
    args = parser.parse_args()
    args.input = args.input.resolve()
    args.output = (args.output or ROOT / f'ops/reports/local/voice/converted-{args.voice}.wav').resolve()
    if not 1 <= args.threads <= 12:
        parser.error('--threads must be between 1 and 12')
    if not args.worker:
        # Do not pass tokens, cloud configuration, or arbitrary user variables to
        # the checkpoint-loading process. weights_only=True remains mandatory.
        isolated = ROOT / '.tools/voice/isolation'
        isolated.mkdir(parents=True, exist_ok=True)
        interpreter = ROOT / '.tools/voice/venv/Scripts/python.exe'
        git = shutil.which('git')
        if git is None:
            raise RuntimeError('Git is required to verify the pinned engine source')
        environment = {key: os.environ[key] for key in ('SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP') if key in os.environ}
        environment.update(PATH=str(interpreter.parent), PYTHONNOUSERSITE='1', PYTHONIOENCODING='utf-8',
                           TORCH_FORCE_WEIGHTS_ONLY_LOAD='1', CUDA_VISIBLE_DEVICES='-1',
                           OMP_NUM_THREADS=str(args.threads), MKL_NUM_THREADS=str(args.threads),
                           HF_HUB_OFFLINE='1', HF_HUB_DISABLE_TELEMETRY='1', VMODEL_VOICE_GIT=git)
        subprocess.run([str(interpreter), '-I', str(Path(__file__).resolve()), '--worker', '--voice', args.voice,
                        '--input', str(args.input), '--output', str(args.output), '--threads', str(args.threads)],
                       cwd=isolated, env=environment, check=True)
        return
    worker(args)


def worker(args: argparse.Namespace) -> None:
    # This is a guard against accidental Python networking, not an OS sandbox.
    # Neither model format requires downloaded code, and loading is weights-only.
    import socket
    def denied(*_args, **_kwargs):
        raise RuntimeError('Network is disabled in the local file-conversion worker')
    socket.socket.connect = denied
    socket.socket.connect_ex = denied
    socket.create_connection = denied
    socket.getaddrinfo = denied
    manifest = json.loads((ROOT / 'config/voice/assets.json').read_text(encoding='utf-8'))
    by_id = {asset['id']: asset for asset in manifest['assets']}
    voice = by_id['chihaya-' + args.voice]
    encoder = by_id['contentvec-onnx']
    for asset in (voice, encoder):
        if sha256(ROOT / asset['path']) != asset['sha256']:
            raise RuntimeError(f"Unrecognized {asset['id']} bytes; run provision.py")
    source = ROOT / manifest['engine']['path']
    git = os.environ.get('VMODEL_VOICE_GIT') or shutil.which('git')
    if not git:
        raise RuntimeError('Missing source verifier')
    current = subprocess.run([git, '-C', str(source), 'rev-parse', 'HEAD'],
                             capture_output=True, text=True, check=True).stdout.strip()
    if current != manifest['engine']['revision']:
        raise RuntimeError('Inference source revision differs from the manifest')
    dirty = subprocess.run([git, '-C', str(source), 'diff', '--name-only', 'HEAD'],
                           capture_output=True, text=True, check=True).stdout.strip()
    if dirty:
        raise RuntimeError('Inference source has unrecorded edits')
    sys.path.insert(0, str(source / 'server'))
    started = time.perf_counter()
    import numpy as np
    import torch
    import torch.nn.functional as functional
    import onnxruntime as ort
    import soundfile as sf
    from scipy.signal import resample_poly
    from math import gcd
    from safetensors.torch import save_file, load_file
    from safetensors import safe_open
    from voice_changer.common.deviceManager.DeviceManager import DeviceManager
    from voice_changer.RVC.inferencer.RVCInferencerv2Nono import RVCInferencerv2Nono

    torch.set_num_threads(args.threads)
    torch.set_num_interop_threads(1)
    torch.manual_seed(224)
    checkpoint = torch.load(ROOT / voice['path'], map_location='cpu', weights_only=True)
    if checkpoint.get('version') != 'v2' or checkpoint.get('f0') != 0:
        raise RuntimeError('Expected an audited RVC v2 no-F0 checkpoint')
    config = checkpoint['config']
    if not isinstance(config, list) or config[-1] != 40000:
        raise RuntimeError('Unexpected target sampling configuration')
    tensors = checkpoint['weight']
    if not tensors or not all(isinstance(v, torch.Tensor) and torch.isfinite(v).all() for v in tensors.values()):
        raise RuntimeError('Invalid/nonfinite target tensors')
    safe_model = (ROOT / voice['path']).with_suffix('.safetensors')
    clean_tensors = {key: value.contiguous() for key, value in tensors.items()}
    metadata = {'format': 'pt', 'config': json.dumps(config), 'version': 'v2', 'f0': '0', 'source_sha256': voice['sha256']}
    # Safetensors header ordering may vary between writes. Reuse and verify an
    # existing derivative, preserving its recorded hash across later auditions.
    if not safe_model.exists():
        save_file(clean_tensors, str(safe_model), metadata=metadata)
    with safe_open(str(safe_model), framework='pt') as safe_header:
        if safe_header.metadata() != metadata:
            raise RuntimeError('Safe derivative metadata differs from the audited target')
    safe_tensors = load_file(str(safe_model))
    if safe_tensors.keys() != clean_tensors.keys() or any(not torch.equal(safe_tensors[k], v) for k, v in clean_tensors.items()):
        raise RuntimeError('Safe derivative does not preserve all target tensors')
    del safe_tensors, clean_tensors, tensors, checkpoint
    manager = DeviceManager.get_instance()
    manager.initialize(-1, True, True)  # CPU FP32, eager; no JIT cold-start claims.
    generator = RVCInferencerv2Nono().load_model(str(safe_model))
    # The pinned no-F0 wrapper reads `use_jit`, while load_model initializes
    # `use_jit_eager`. Bind the intended switch without editing upstream source.
    generator.use_jit = generator.use_jit_eager
    options = ort.SessionOptions()
    options.intra_op_num_threads = args.threads
    options.inter_op_num_threads = 1
    options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
    options.log_severity_level = 3
    content = ort.InferenceSession(str(ROOT / encoder['path']), sess_options=options, providers=['CPUExecutionProvider'])
    model_ready = time.perf_counter()
    audio, sample_rate = sf.read(args.input, dtype='float32', always_2d=True)
    if len(audio) == 0 or len(audio) / sample_rate > 120 or not np.isfinite(audio).all():
        raise RuntimeError('Input must be finite audio between 0 and 120 seconds')
    mono = audio.mean(axis=1)
    divisor = gcd(sample_rate, 16000)
    audio16 = resample_poly(mono, 16000 // divisor, sample_rate // divisor).astype(np.float32)
    # One second of reflected context at both edges reduces encoder/generator
    # boundary loss. This is file conversion, not the live buffering preset.
    padding = 16000
    padded = np.pad(audio16, (padding, padding), mode='reflect')
    frame_count = len(padded) // 160
    started_inference = time.perf_counter()
    with torch.inference_mode():
        features = content.run(['unit12'], {'audio': padded.reshape(1, -1)})[0]
        features = torch.from_numpy(features)
        features = torch.cat((features, features[:, -1:, :]), dim=1)
        features = functional.interpolate(features.permute(0, 2, 1), scale_factor=2, mode='nearest').permute(0, 2, 1)
        features = features[:, :frame_count, :].contiguous()
        converted = generator.infer(features, torch.tensor([frame_count]), None, None, torch.tensor([0]),
                                    0, frame_count, frame_count).cpu().numpy()
    ended_inference = time.perf_counter()
    expected_samples = round(len(audio16) * 2.5)
    converted = converted[40000:40000 + expected_samples]
    if len(converted) < expected_samples - 400:
        raise RuntimeError('Conversion returned truncated output')
    rms = float(np.sqrt(np.mean(converted ** 2)))
    if not np.isfinite(converted).all() or rms < 0.0001:
        raise RuntimeError('Conversion produced nonfinite or silent output')
    args.output.parent.mkdir(parents=True, exist_ok=True)
    sf.write(args.output, converted, 40000, subtype='PCM_16')
    report = {
        'schemaVersion': 1, 'voice': args.voice, 'engineRevision': current,
        'python': sys.version.split()[0], 'torch': torch.__version__, 'onnxruntime': ort.__version__,
        'provider': content.get_providers(), 'threads': args.threads, 'f0': False, 'indexRatio': 0,
        'input': str(args.input.relative_to(ROOT)), 'inputSha256': sha256(args.input),
        'inputSampleRate': sample_rate, 'inputSeconds': len(audio) / sample_rate,
        'output': str(args.output.relative_to(ROOT)), 'outputSha256': sha256(args.output),
        'outputSampleRate': 40000, 'outputSeconds': len(converted) / 40000,
        'outputRms': rms, 'outputPeak': float(np.abs(converted).max()),
        'clippedFraction': float(np.mean(np.abs(converted) >= 0.999)), 'allFinite': True,
        'modelSha256': voice['sha256'], 'safeModelSha256': sha256(safe_model),
        'encoderSha256': encoder['sha256'], 'targetTensorCount': len(load_file(str(safe_model))),
        'loadSeconds': model_ready - started, 'inferenceSeconds': ended_inference - started_inference,
        'realTimeFactor': (ended_inference - started_inference) / (len(audio) / sample_rate),
        'networkGuard': 'Python socket calls denied; no OS firewall sandbox',
        'audioDevicesOpened': False, 'microphoneCaptured': False,
        'verificationBoundary': 'File conversion only; no listening, live-latency, user-voice, or OBS acceptance',
    }
    args.output.with_suffix('.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report, indent=2), flush=True)


if __name__ == '__main__':
    main()
