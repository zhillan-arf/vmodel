"""Prepare and validate one fixed factor-4 LLVC ONNX graph after quiet release.

No source/checkpoint edits, dependency installation, audio devices or active
Voice Studio integration. The worker is bounded to 180 seconds.
"""
from __future__ import annotations

import argparse
import ast
import hashlib
import json
import math
from pathlib import Path
import sys
import time
import types

sys.path.insert(0, str(Path(__file__).resolve().parent))
from llvc_onnx_common import (ROOT, BASE, EXPORT, RATE, L, FACTOR, CHUNK, INPUT_NAMES,
    OUTPUT_NAMES, INPUT_SHAPES, OUTPUT_SHAPES, WAVE_LIMIT, STATE_LIMIT, RunReport,
    artifact, chunks_from_audio, compare_array, deny_network, hardware,
    parity_sequence, rooted, sha, supervise, verify_provision, worker_guard, write_json)

LABEL = 'voice-llvc-onnx-export'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--quiet-window', action='store_true')
    parser.add_argument('--worker', action='store_true')
    parser.add_argument('--run-id')
    args = parser.parse_args()
    if not args.quiet_window:
        parser.error('Wait for the coordinated laptop release, then use --quiet-window')
    if args.worker:
        if not args.run_id:
            parser.error('Owned worker requires its run ID')
        report = RunReport(args.run_id, LABEL)
        return worker_guard(report, worker)
    supervise(Path(__file__).resolve(), ROOT / '.tools/voice/venv/Scripts/python.exe', LABEL, 1, [])


def worker(report):
    deny_network()
    provision, provenance = verify_provision()
    report.save('import-existing-cpu-runtime')
    import numpy as np
    import onnx
    import onnxruntime as ort
    import soundfile as sf
    import torch
    from scipy.signal import resample_poly

    torch.set_num_threads(1)
    torch.set_num_interop_threads(1)
    torch.manual_seed(224)
    sys.path.insert(0, str(BASE / 'runtime'))
    from model import Net

    config = json.loads((BASE / 'source/experiments/llvc/config.json').read_text(encoding='utf-8'))
    if config['data']['sr'] != RATE:
        raise ValueError('Wrong source sample rate')
    report.save('load-strict-checkpoint')
    model = Net(**config['model_params']).eval()
    checkpoint = torch.load(rooted(provision['model']), weights_only=True, mmap=True, map_location='cpu')
    keys = model.load_state_dict(checkpoint['model'], strict=True)
    del checkpoint
    if keys.missing_keys or keys.unexpected_keys or any(module.training for module in model.modules()):
        raise ValueError('Checkpoint/evaluation mode mismatch')
    if model.L != L or model.dec_chunk_size * L * FACTOR != CHUNK or not model.lookahead or not hasattr(model, 'convnet_pre'):
        raise ValueError('Different streaming architecture; no automatic shape adaptation')

    def weight_fingerprint():
        digest = hashlib.sha256()
        for name, value in sorted(model.state_dict().items()):
            array = value.detach().cpu().numpy()
            if not np.isfinite(array).all():
                raise ValueError('Non-finite learned weight or model buffer')
            digest.update(json.dumps([name, str(array.dtype), list(array.shape)]).encode('utf-8'))
            digest.update(array.tobytes(order='C'))
        return digest.hexdigest()

    original_weights = weight_fingerprint()

    class FixedStreaming(torch.nn.Module):
        def __init__(self, original):
            super().__init__()
            self.original = original

        def forward(self, waveform, encoder_state, decoder_state, output_state, prenet_state):
            # Upstream mutates encoder/decoder/prenet caches in-place. Clone the
            # caller's state so the exported signature has functional value IO.
            # All learned submodules and arithmetic remain the original Net.
            return self.original(waveform.clone(), encoder_state.clone(), decoder_state.clone(),
                                 output_state.clone(), prenet_state.clone(), pad=False)

    wrapper = FixedStreaming(model).eval()
    with torch.inference_mode():
        zero_states = [*model.init_buffers(1, torch.device('cpu')),
                       model.convnet_pre.init_ctx_buf(1, torch.device('cpu'))]
        initial = [value.cpu().numpy().copy() for value in zero_states]
    if [list(value.shape) for value in initial] != INPUT_SHAPES[1:]:
        raise ValueError('Source state dimensions differ from reviewed fixed contract')

    catalog = json.loads((ROOT / 'config/voice/assets.json').read_text(encoding='utf-8'))
    source = next(item for item in catalog['assets'] if item['id'] == 'ljspeech-sample')
    if sha(rooted(source['path'])) != source['sha256']:
        raise ValueError('Changed licensed English reference')
    speech, source_rate = sf.read(rooted(source['path']), dtype='float32')
    if speech.ndim != 1 or not np.isfinite(speech).all():
        raise ValueError('Wrong reference audio')
    divisor = math.gcd(source_rate, RATE)
    speech = resample_poly(speech, RATE // divisor, source_rate // divisor).astype(np.float32)
    if len(speech) < 64 * CHUNK:
        raise ValueError('Reference cannot supply the planned speech parity sequence')
    # The final partial silence block also exercises upstream's EOF padding.
    parity_audio = np.concatenate([speech[:64 * CHUNK], np.zeros(16 * CHUNK - 17, dtype=np.float32)])
    parity_chunks = chunks_from_audio(parity_audio)
    unit = np.concatenate([speech, np.zeros(4000, dtype=np.float32)])
    measured_audio = np.tile(unit, math.ceil(30 * RATE / len(unit)))[:30 * RATE].copy()
    measured_chunks = chunks_from_audio(measured_audio)
    fixture = {'parity_audio': parity_audio, 'parity_chunks': parity_chunks,
               'measured_audio': measured_audio, 'measured_chunks': measured_chunks}
    fixture.update({'initial_' + name: value for name, value in zip(INPUT_NAMES[1:], initial)})

    report.save('eager-waveform-and-recurrent-fixture')
    expected = [[] for _ in OUTPUT_NAMES]
    adapter_worst = {name: 0.0 for name in OUTPUT_NAMES}
    eager_states = [value.copy() for value in initial]
    wrapped_states = [value.copy() for value in initial]
    trace_inputs = None
    with torch.inference_mode():
        for index, chunk in enumerate(parity_chunks):
            direct = model(torch.from_numpy(chunk.copy()),
                           *[torch.from_numpy(value.copy()) for value in eager_states], pad=False)
            inputs = [torch.from_numpy(chunk.copy()), *[torch.from_numpy(value.copy()) for value in wrapped_states]]
            before = [value.numpy().copy() for value in inputs]
            actual = wrapper(*inputs)
            if any(not np.array_equal(value.numpy(), saved) for value, saved in zip(inputs, before)):
                raise ValueError('Functional wrapper mutated caller-owned input/state')
            for slot, (name, value, other, shape) in enumerate(zip(OUTPUT_NAMES, direct, actual, OUTPUT_SHAPES)):
                array, comparison = value.numpy().copy(), other.numpy().copy()
                if list(array.shape) != shape:
                    raise ValueError(f'Unexpected eager {name} shape')
                metric = compare_array(comparison, array, {'maxAbs': 1e-6, 'rmse': 1e-7})
                adapter_worst[name] = max(adapter_worst[name], metric['maxAbs'])
                if not metric['passed']:
                    raise ValueError(f'Functional wrapper differs from upstream Net: {name}, block {index}')
                expected[slot].append(array)
            # Snapshot nonzero speech state before tracing; no borrowed cache is
            # allowed to be reused after an upstream in-place update.
            if index == 31:
                trace_inputs = tuple(torch.from_numpy(value.copy()) for value in before)
            eager_states = [value.numpy().copy() for value in direct[1:]]
            wrapped_states = [value.numpy().copy() for value in actual[1:]]
    fixture.update({'expected_' + name: np.stack(values) for name, values in zip(OUTPUT_NAMES, expected)})

    original = (BASE / 'source/infer.py').read_text(encoding='utf-8')
    functions = [node for node in ast.parse(original).body if isinstance(node, ast.FunctionDef) and node.name == 'infer_stream']
    if len(functions) != 1:
        raise ValueError('Expected the reviewed upstream streaming function')
    namespace = {'torch': torch, 'np': np, 'time': types.SimpleNamespace(time=time.perf_counter)}
    exec(compile(ast.Module(body=functions, type_ignores=[]), str(BASE / 'source/infer.py'), 'exec'), namespace)
    infer_stream = namespace['infer_stream']
    upstream, _, _ = infer_stream(model, torch.from_numpy(parity_audio.copy()), FACTOR, RATE)
    eager_flat = fixture['expected_converted_waveform'].reshape(-1)[:len(parity_audio)]
    prep_metric = compare_array(eager_flat, upstream.numpy().reshape(-1), {'maxAbs': 1e-6, 'rmse': 1e-7})
    if not prep_metric['passed']:
        raise ValueError('NumPy pad/shift/context preparation differs from actual upstream infer_stream')
    report.save('full-30-second-upstream-eager-reference')
    upstream_full, _, _ = infer_stream(model, torch.from_numpy(measured_audio.copy()), FACTOR, RATE)
    fixture['measured_expected_waveform'] = upstream_full.numpy().reshape(-1).copy()
    if fixture['measured_expected_waveform'].shape != measured_audio.shape or not np.isfinite(fixture['measured_expected_waveform']).all():
        raise ValueError('Invalid full eager reference')

    run_dir = EXPORT / 'runs' / report.data['runId']
    run_dir.mkdir(parents=True, exist_ok=True)
    graph_path, fixture_path = run_dir / 'model.onnx', run_dir / 'fixture.npz'
    np.savez(fixture_path, **fixture)
    report.data.update(hardware=hardware(), torch=torch.__version__, onnx=onnx.__version__,
                       onnxruntime=ort.__version__, provisionManifest=provenance, sourceRevision=provision['sourceRevision'],
                       modelRevision=provision['modelRevision'], checkpointSha256=sha(rooted(provision['model'])),
                       waveformLimit=WAVE_LIMIT, recurrentStateLimit=STATE_LIMIT,
                       upstreamPreparationParity=prep_metric, functionalWrapperMaxAbsErrors=adapter_worst,
                       source=source, sourceResampledSamples=len(speech), sourceResampledRate=RATE,
                       inputNames=INPUT_NAMES, inputShapes=INPUT_SHAPES, outputNames=OUTPUT_NAMES, outputShapes=OUTPUT_SHAPES,
                       chunkFactor=FACTOR, chunkSamples=CHUNK, chunkMs=52, sampleRate=RATE,
                       learnedStateFingerprint=original_weights, evaluationMode=True, threads=1, interopThreads=1,
                       parityFixture={'speechBlocks': 64, 'silenceBlocksIncludingPartial': 16, 'finalBlockPaddingSamples': 17,
                                      'parityInputSamples': len(parity_audio), 'fullReferenceSeconds': 30,
                                      'fullReferenceBlocks': len(measured_chunks), 'originalSamples': len(measured_audio)},
                       scripts=[artifact(Path(__file__).resolve()), artifact(ROOT / 'scripts/voice/llvc_onnx_common.py')])
    report.save('export-fixed-functional-graph')
    export_start = time.perf_counter()
    with torch.inference_mode():
        cloned_inputs = tuple(value.clone() for value in trace_inputs)
        trace_before = [value.numpy().copy() for value in cloned_inputs]
        torch.onnx.export(wrapper, cloned_inputs, str(graph_path), dynamo=False, opset_version=17,
                          input_names=INPUT_NAMES, output_names=OUTPUT_NAMES, do_constant_folding=True, verbose=False)
        if any(not np.array_equal(value.numpy(), saved) for value, saved in zip(cloned_inputs, trace_before)):
            raise ValueError('Export mutated the cloned trace input state')
    graph = onnx.shape_inference.infer_shapes(onnx.load(graph_path), strict_mode=True, data_prop=True)
    onnx.checker.check_model(graph, full_check=True)
    for values, names, shapes in [(graph.graph.input, INPUT_NAMES, INPUT_SHAPES), (graph.graph.output, OUTPUT_NAMES, OUTPUT_SHAPES)]:
        if [value.name for value in values] != names:
            raise ValueError('Export lost/reordered explicit waveform or recurrent IO')
        for value, shape in zip(values, shapes):
            tensor_type = value.type.tensor_type
            if tensor_type.elem_type != onnx.TensorProto.FLOAT or [dim.dim_value for dim in tensor_type.shape.dim] != shape:
                raise ValueError(f'Exported {value.name} is not the reviewed fixed FP32 shape')
    onnx.helper.set_model_props(graph, {'vmodel': json.dumps({'scope': 'Fixed 52ms LLVC research CPU probe',
        'sourceRevision': provision['sourceRevision'], 'checkpointSha256': report.data['checkpointSha256'],
        'learnedWeightsChanged': False, 'liveAccepted': False})})
    onnx.save(graph, graph_path)
    report.data['exportSeconds'] = time.perf_counter() - export_start
    if weight_fingerprint() != original_weights:
        raise ValueError('Export/fixture generation changed learned state')
    options = ort.SessionOptions()
    options.intra_op_num_threads, options.inter_op_num_threads = 1, 1
    options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
    options.log_severity_level = 3
    report.save('onnx-cpu-free-running-state-parity')
    session = ort.InferenceSession(str(graph_path), sess_options=options, providers=['CPUExecutionProvider'])
    if session.get_providers() != ['CPUExecutionProvider']:
        raise ValueError('Unexpected ONNX validation provider')

    def step(chunk, states):
        values = {name: value for name, value in zip(INPUT_NAMES, [chunk, *states])}
        return [np.asarray(value).copy() for value in session.run(OUTPUT_NAMES, values)]

    report.data['onnxParity'] = parity_sequence(step, fixture)
    report.save('onnx-cpu-reset-repeat-parity')
    report.data['onnxResetParity'] = parity_sequence(step, fixture)
    if not report.data['onnxParity']['passed'] or not report.data['onnxResetParity']['passed']:
        raise ValueError('ONNX waveform/recurrent-state parity failed; no OpenVINO measurement allowed')
    report.data.update(state='passed', artifacts=[artifact(graph_path), artifact(fixture_path)],
        limits=['Fixed factor-4 graph only; no dynamic shape or general live adapter.',
                'Original Net submodules/weights retained; only functional input clones and a fixed ONNX trace are added.',
                'FP32 waveform and recurrent-state numerical parity is not perceptual voice acceptance.',
                'Reference chunks are prepared from complete files; no physical input/output or paced stream.'])
    report.save('passed')
    write_json(run_dir / 'manifest.json', report.data)
    write_json(EXPORT / 'manifest.json', report.data)


if __name__ == '__main__':
    main()
