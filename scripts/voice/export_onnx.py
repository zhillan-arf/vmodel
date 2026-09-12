"""Export the audited no-F0 generator at the fixed 160 ms streaming shape.

This bounded adapter uses original eager submodules and explicit random noise.
The pinned generic upstream ONNX exporter incorrectly chooses an F0 decoder for
this target. No upstream checkout or checkpoint is edited by this exporter.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets/voice/onnx/bright-160ms-v1'


def sha(path):
    return _sha(path)


def _sha(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for block in iter(lambda: f.read(1048576), b''):
            h.update(block)
    return h.hexdigest()


def main():
    global OUT
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--worker', action='store_true')
    parser.add_argument('--context-ms', choices=[400, 800, 1600], type=int, default=1600)
    args = parser.parse_args()
    if args.context_ms != 1600:
        OUT = ROOT / f'assets/voice/onnx/bright-160ms-context{args.context_ms}-v1'
    if not args.worker:
        interpreter = ROOT / '.tools/voice/venv/Scripts/python.exe'
        env = {k: os.environ[k] for k in ['SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP'] if k in os.environ}
        env.update(PATH=str(interpreter.parent), PYTHONIOENCODING='utf-8',
                   TORCH_FORCE_WEIGHTS_ONLY_LOAD='1', CUDA_VISIBLE_DEVICES='-1',
                   OMP_NUM_THREADS='3', MKL_NUM_THREADS='3', VMODEL_VOICE_GIT=shutil.which('git') or '')
        subprocess.run([str(interpreter), '-I', str(Path(__file__).resolve()), '--worker', '--context-ms', str(args.context_ms)],
                       cwd=ROOT / '.tools/voice/isolation', env=env, check=True)
        return
    worker(args.context_ms)


def worker(context_ms):
    import socket
    def deny(*args, **kwargs):
        raise RuntimeError('No networking in local ONNX export')
    socket.socket.connect = socket.socket.connect_ex = socket.create_connection = socket.getaddrinfo = deny
    assets = json.loads((ROOT / 'config/voice/assets.json').read_text())
    catalog = {a['id']: a for a in assets['assets']}
    source = ROOT / assets['engine']['path']
    git = os.environ['VMODEL_VOICE_GIT']
    if subprocess.check_output([git, '-C', str(source), 'rev-parse', 'HEAD'], text=True).strip() != assets['engine']['revision']:
        raise RuntimeError('Wrong source revision')
    if subprocess.check_output([git, '-C', str(source), 'diff', '--name-only', 'HEAD'], text=True).strip():
        raise RuntimeError('Changed upstream source')
    for name in ['chihaya-bright', 'contentvec-onnx', 'ljspeech-sample']:
        if sha(ROOT / catalog[name]['path']) != catalog[name]['sha256']:
            raise RuntimeError('Changed source/model asset')
    sys.path.insert(0, str(source / 'server'))
    import numpy as np
    import torch
    import onnx
    import onnxruntime as ort
    import soundfile as sf
    from scipy.signal import resample_poly
    from voice_changer.RVC.inferencer.rvc_models.infer_pack.models import SynthesizerTrnMs768NSFsid_nono
    torch.set_num_threads(3)
    torch.set_num_interop_threads(1)
    torch.manual_seed(224)
    OUT.mkdir(parents=True, exist_ok=True)
    started = time.perf_counter()
    cp = torch.load(ROOT / catalog['chihaya-bright']['path'], weights_only=True, map_location='cpu')
    if cp['version'] != 'v2' or cp['f0'] != 0 or cp['config'][-1] != 40000:
        raise RuntimeError('Unexpected model architecture')
    model = SynthesizerTrnMs768NSFsid_nono(*cp['config'], is_half=False).eval()
    keys = model.load_state_dict(cp['weight'], strict=False)
    if keys.unexpected_keys or any(not k.startswith('enc_q.') for k in keys.missing_keys):
        raise RuntimeError(f'Inference weight mismatch: {keys}')
    model.remove_weight_norm()
    # enc_q is the training posterior and is not used by model.infer.
    del model.enc_q, cp
    feature_count, skip, returned = context_ms // 10 + 21, context_ms // 10, 21
    flow_head = max(skip - 24, 0)
    noise_shape = (1, model.inter_channels, feature_count - flow_head)

    class FixedGenerator(torch.nn.Module):
        def __init__(self):
            super().__init__()
            self.model = model
            self.register_buffer('p_len', torch.tensor([feature_count]))
            self.register_buffer('sid', torch.tensor([0]))

        def forward(self, feats, noise):
            # Exact no-F0 infer arithmetic, with randn_like promoted to an input
            # to make cross-runtime verification meaningful and reproducible.
            g = self.model.emb_g(self.sid).unsqueeze(-1)
            m, logs, mask = self.model.enc_p(feats, None, self.p_len, flow_head)
            latent = (m + torch.exp(logs) * noise * 0.66666) * mask
            z = self.model.flow(latent, mask, g=g, reverse=True)
            head = skip - flow_head
            z = z[:, :, head:head + returned]
            mask = mask[:, :, head:head + returned]
            out = self.model.dec(z * mask, g=g, n_res=returned)
            return torch.clip(out[0, 0], -1.0, 1.0)

    wrapper = FixedGenerator().eval()
    so = ort.SessionOptions()
    so.intra_op_num_threads, so.inter_op_num_threads = 3, 1
    so.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
    so.log_severity_level = 3
    encoder = ort.InferenceSession(str(ROOT / catalog['contentvec-onnx']['path']), sess_options=so, providers=['CPUExecutionProvider'])
    speech, rate = sf.read(ROOT / catalog['ljspeech-sample']['path'], dtype='float32')
    from math import gcd
    d = gcd(rate, 16000)
    speech = resample_poly(speech, 16000 // d, rate // d).astype(np.float32)
    # A real speech window with full past context, selected from the same source.
    window = speech[16000:16000 + feature_count * 160].copy()
    raw_feats = encoder.run(['unit12'], {'audio': window.reshape(1, -1)})[0]
    feats_np = np.repeat(np.concatenate([raw_feats, raw_feats[:, -1:]], axis=1), 2, axis=1)[:, :feature_count].copy()
    feats = torch.from_numpy(feats_np)
    torch.manual_seed(224)
    noise = torch.randn(noise_shape)
    with torch.inference_mode():
        expected = wrapper(feats, noise).numpy()
        torch.manual_seed(224)
        original = torch.clip(model.infer(feats, torch.tensor([feature_count]), torch.tensor([0]),
                                        skip, returned, returned)[0][0, 0], -1, 1).numpy()
    eager_error = float(np.max(np.abs(expected - original)))
    if eager_error > 1e-6:
        raise RuntimeError(f'Adapter differs from original eager inference: {eager_error}')
    np.savez(OUT / 'fixture.npz', audio=window.reshape(1, -1), feats=feats_np,
             noise=noise.numpy(), expected=expected)
    export_start = time.perf_counter()
    print('Exporting fixed no-F0 generator with exact eager parity', flush=True)
    # Upstream uses torch.tanh(x, out=x). The legacy symbolic accepts no out
    # argument; ONNX is functional, so its Tanh output represents that value.
    # Runtime numerical parity below/inside probe_onnx guards this translation.
    def tanh_with_out(graph, value, out=None):
        return graph.op('Tanh', value)
    torch.onnx.register_custom_op_symbolic('aten::tanh', tanh_with_out, 17)
    with torch.inference_mode():
        torch.onnx.export(wrapper, (feats, noise), str(OUT / 'generator.onnx'), dynamo=False,
                          opset_version=17, input_names=['feats', 'noise'], output_names=['audio'],
                          do_constant_folding=True, verbose=False)
    graph = onnx.load(OUT / 'generator.onnx')
    onnx.checker.check_model(graph)
    metadata = {'application': 'VMODEL_FIXED_RVC_PROBE', 'version': '1', 'f0': False,
                'target': 'chihaya-bright', 'features': [1, feature_count, 768], 'noise': list(noise_shape),
                'chunkMs': 160, 'contextMs': context_ms, 'crossfadeMs': 40, 'searchMs': 10,
                'skipHead': skip, 'returnLength': returned, 'outputSamples': 8400, 'outputRate': 40000,
                'sourceRevision': assets['engine']['revision'], 'modelSha256': catalog['chihaya-bright']['sha256'],
                'license': 'MIT target derivative; code notices retained separately',
                'boundary': 'Fixed shape experimental backend. Not generic upstream VC_CLIENT interchange or accepted voice quality.'}
    onnx.helper.set_model_props(graph, {'vmodel': json.dumps(metadata)})
    onnx.save(graph, OUT / 'generator.onnx')
    # Freeze encoder input dimensions for DirectML graph planning. Arithmetic,
    # initializers and weights are unchanged; this retains the GPL-3.0 terms.
    content = onnx.load(ROOT / catalog['contentvec-onnx']['path'])
    dims = content.graph.input[0].type.tensor_type.shape.dim
    for dim, value in zip(dims, [1, feature_count * 160]):
        dim.ClearField('dim_param')
        dim.dim_value = value
    onnx.checker.check_model(content)
    onnx.save(content, OUT / 'encoder.onnx')
    report = {'schemaVersion': 1, **metadata, 'eagerAdapterMaxAbsError': eager_error,
              'unloadedTrainingKeys': keys.missing_keys, 'unexpectedKeys': keys.unexpected_keys,
              'exportSeconds': time.perf_counter() - export_start,
              'totalPreparationSeconds': time.perf_counter() - started,
              'torch': torch.__version__, 'onnx': onnx.__version__,
              'exportCompatibility': 'Functional ONNX Tanh symbolic for upstream torch.tanh(x, out=x); fixed-shape trace warnings are expected and graph input dimensions enforce the selected shape.',
              'artifacts': [{'path': p.relative_to(ROOT).as_posix(), 'sha256': sha(p), 'bytes': p.stat().st_size}
                            for p in [OUT / 'generator.onnx', OUT / 'encoder.onnx', OUT / 'fixture.npz']],
              'upstreamExporterLimit': 'Generic export selects F0 class for no-F0; alternative ONNX no-F0 class also instantiates GeneratorNSF. Adapter uses verified original eager no-F0 submodules instead.',
              'microphoneCaptured': False, 'audioDevicesOpened': False}
    (OUT / 'manifest.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    suffix = '' if context_ms == 1600 else f'-context{context_ms}'
    (ROOT / f'ops/reports/voice-onnx-export{suffix}.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps({k: report[k] for k in ['eagerAdapterMaxAbsError', 'exportSeconds', 'totalPreparationSeconds', 'artifacts']}, indent=2), flush=True)


if __name__ == '__main__':
    main()
