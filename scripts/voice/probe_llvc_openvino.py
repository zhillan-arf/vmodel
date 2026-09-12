"""Bounded factor-4 LLVC OpenVINO CPU FP32 comparison, only after quiet release.

Requires the same successful immutable ONNX export and full eager reference.
No Torch import, GPU fallback, setup, device audio or active voice changes.
"""
from __future__ import annotations

import argparse
from collections import Counter
import json
from pathlib import Path
import sys
import time

sys.path.insert(0, str(Path(__file__).resolve().parent))
from llvc_onnx_common import (ROOT, EXPORT, RATE, L, FACTOR, CHUNK, INPUT_NAMES,
    OUTPUT_NAMES, INPUT_SHAPES, OUTPUT_SHAPES, WAVE_LIMIT, STATE_LIMIT, RunReport,
    artifact, compare_array, deny_network, distribution, hardware, parity_sequence,
    rooted, sha, supervise, verify_provision, worker_guard)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--threads', type=int, choices=[1, 3], required=True)
    parser.add_argument('--quiet-window', action='store_true')
    parser.add_argument('--worker', action='store_true')
    parser.add_argument('--run-id')
    args = parser.parse_args()
    if not args.quiet_window:
        parser.error('Wait for the coordinated laptop release, then use --quiet-window')
    label = f'voice-llvc-openvino-cpu-{args.threads}t-factor4'
    if args.worker:
        if not args.run_id:
            parser.error('Owned worker requires its run ID')
        report = RunReport(args.run_id, label)
        return worker_guard(report, lambda item: worker(args, item))
    supervise(Path(__file__).resolve(), ROOT / '.tools/voice/openvino-venv/Scripts/python.exe',
              label, args.threads, ['--threads', str(args.threads)])


def worker(args, report):
    deny_network()
    _, provision = verify_provision()
    manifest_path = EXPORT / 'manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    latest_export = json.loads((ROOT / 'ops/reports/voice-llvc-onnx-export.json').read_text(encoding='utf-8'))
    if manifest['state'] != 'passed' or latest_export['state'] != 'passed' or latest_export['runId'] != manifest['runId']:
        raise ValueError('Current successful export required; an older manifest cannot hide a failed/latest attempt')
    if manifest['provisionManifest'] != provision or not manifest['onnxParity']['passed'] or not manifest['onnxResetParity']['passed']:
        raise ValueError('Unchanged source/checkpoint and strict ONNX state parity required first')
    for item in [*manifest['artifacts'], *manifest['scripts']]:
        if sha(rooted(item['path'])) != item['sha256']:
            raise ValueError(f"Changed export input/artifact: {item['path']}")
    if (manifest['inputShapes'] != INPUT_SHAPES or manifest['outputShapes'] != OUTPUT_SHAPES
            or manifest['waveformLimit'] != WAVE_LIMIT or manifest['recurrentStateLimit'] != STATE_LIMIT):
        raise ValueError('Changed fixed shape or numerical acceptance thresholds')
    artifacts = {Path(item['path']).name: rooted(item['path']) for item in manifest['artifacts']}
    graph_path, fixture_path = artifacts['model.onnx'], artifacts['fixture.npz']
    report.data.update(exportManifest=artifact(manifest_path), modelArtifacts=manifest['artifacts'],
                       checkpointSha256=manifest['checkpointSha256'], sourceRevision=manifest['sourceRevision'],
                       modelRevision=manifest['modelRevision'], source=manifest['source'], hardware=hardware(),
                       probeScript=artifact(Path(__file__).resolve()), waveformLimit=WAVE_LIMIT, recurrentStateLimit=STATE_LIMIT,
                       delegate='CPU', precision='FP32', threads=args.threads, numStreams=1,
                       chunkFactor=FACTOR, chunkMs=52, chunkSamples=CHUNK, sampleRate=RATE, paced=False)
    report.save('import-existing-openvino-cpu-runtime')
    import numpy as np
    import openvino as ov
    import soundfile as sf

    report.data['openvino'] = ov.__version__
    report.data['numpy'] = np.__version__
    # This private fixture contains only explicitly named numeric arrays, never
    # pickle objects. Loaded once outside the measurement interval.
    with np.load(fixture_path, allow_pickle=False) as archive:
        fixture = {name: archive[name].copy() for name in archive.files}
    if len(fixture['measured_audio']) != 30 * RATE or len(fixture['measured_chunks']) != 577:
        raise ValueError('Different full 30-second input fixture')
    for key in ['measured_chunks', 'parity_chunks']:
        value = fixture[key]
        if list(value.shape[1:]) != INPUT_SHAPES[0] or value.dtype != np.float32 or not np.isfinite(value).all():
            raise ValueError('Invalid fixed waveform chunks')
    report.save('compile-explicit-cpu-fp32')
    core = ov.Core()
    if 'CPU' not in core.available_devices:
        raise ValueError('CPU plugin unavailable; no alternate device selected')
    settings = {'PERFORMANCE_HINT': 'LATENCY', 'EXECUTION_MODE_HINT': 'ACCURACY',
                'INFERENCE_PRECISION_HINT': 'f32', 'INFERENCE_NUM_THREADS': args.threads,
                'NUM_STREAMS': '1', 'PERF_COUNT': True}
    compile_start = time.perf_counter()
    graph = core.read_model(str(graph_path))
    compiled = core.compile_model(graph, 'CPU', settings)
    report.data['compileSeconds'] = time.perf_counter() - compile_start
    devices = [str(value) for value in compiled.get_property('EXECUTION_DEVICES')]
    if devices != ['CPU'] or compiled.get_property('INFERENCE_PRECISION_HINT') != ov.Type.f32:
        raise ValueError('Requested CPU/FP32 configuration was not honored')
    input_ports = [compiled.input(name) for name in INPUT_NAMES]
    output_ports = [compiled.output(name) for name in OUTPUT_NAMES]
    if len(compiled.inputs) != 5 or len(compiled.outputs) != 5:
        raise ValueError('Compiled graph lost explicit waveform/state IO')
    for ports, shapes in [(input_ports, INPUT_SHAPES), (output_ports, OUTPUT_SHAPES)]:
        for port, shape in zip(ports, shapes):
            if list(port.shape) != shape or port.element_type != ov.Type.f32:
                raise ValueError('Compiled IO differs from fixed FP32 contract')
    report.data.update(settings=settings, executionDevices=devices,
                       cpuPluginName=str(core.get_property('CPU', 'FULL_DEVICE_NAME')),
                       compiledProperties={key: str(compiled.get_property(key)) for key in
                           ['INFERENCE_PRECISION_HINT', 'INFERENCE_NUM_THREADS', 'NUM_STREAMS', 'EXECUTION_MODE_HINT']})
    request = compiled.create_infer_request()

    def step(chunk, states):
        values = {name: value for name, value in zip(INPUT_NAMES, [chunk, *states])}
        result = request.infer(values, share_inputs=False, share_outputs=False)
        # Explicit copies own every output before the request is reused. The
        # measured call includes these host-state/output copies.
        return [np.asarray(result[port]).copy() for port in output_ports]

    report.save('cpu-waveform-and-own-recurrent-state-parity')
    report.data['parity'] = parity_sequence(step, fixture)
    report.save('parity-result')
    if not report.data['parity']['passed']:
        raise ValueError('OpenVINO waveform/recurrent state differs from eager; timing gate not entered')

    # Warm up a full second rounded to complete 52 ms chunks, then explicitly
    # restore all four zero states before the timed sequence.
    warmup_blocks = (RATE + CHUNK - 1) // CHUNK
    states = [fixture['initial_' + name].copy() for name in INPUT_NAMES[1:]]
    report.save('warmup-complete-chunks')
    for chunk in fixture['measured_chunks'][:warmup_blocks]:
        outputs = step(chunk, states)
        states = outputs[1:]
    states = [fixture['initial_' + name].copy() for name in INPUT_NAMES[1:]]
    timings, audio_blocks = [], []
    report.data.update(warmupBlocks=warmup_blocks, warmupInputSeconds=warmup_blocks * CHUNK / RATE,
                       measuredInputSeconds=30, measuredBlocks=len(fixture['measured_chunks']),
                       finalBlockPaddingSamples=len(fixture['measured_chunks']) * CHUNK - 30 * RATE)
    report.save('30-second-unpaced-cpu-sequence')
    started, last_progress = time.perf_counter(), time.perf_counter()
    for index, chunk in enumerate(fixture['measured_chunks']):
        tick = time.perf_counter()
        outputs = step(chunk, states)
        timings.append((time.perf_counter() - tick) * 1000)
        # Finiteness checks are outside the per-call timer, but remain included
        # in conversion wall time. Retain the complete waveform without gaps.
        for value, shape in zip(outputs, OUTPUT_SHAPES):
            if list(value.shape) != shape or value.dtype != np.float32 or not np.isfinite(value).all():
                raise ValueError(f'Invalid waveform/state at measured block {index}')
        audio_blocks.append(outputs[0])
        states = outputs[1:]
        if time.perf_counter() - last_progress >= 20:
            report.data['measuredBlocksCompleted'] = index + 1
            report.save('30-second-unpaced-cpu-sequence')
            last_progress = time.perf_counter()
    wall = time.perf_counter() - started
    audio = np.concatenate(audio_blocks, axis=2).reshape(-1)[:30 * RATE].copy()
    full_parity = compare_array(audio, fixture['measured_expected_waveform'], WAVE_LIMIT)
    report.data.update(conversionWallSeconds=wall, measuredBlocksCompleted=len(timings), computeMs=distribution(timings),
                       timingSamplesMs=timings, computeRealTimeFactor=sum(timings) / 30000,
                       wallRealTimeFactor=wall / 30, blocksOverComputeDeadline=sum(value > 52 for value in timings),
                       fullSequenceWaveformParity=full_parity, outputSamples=len(audio),
                       outputPeak=float(np.abs(audio).max()), outputRms=float(np.sqrt(np.mean(audio.astype(np.float64) ** 2))),
                       p95BufferPlusComputeEstimateMs=(2 * L + CHUNK) * 1000 / RATE + distribution(timings)['p95'])
    audio_path = report.directory / 'converted-30s.wav'
    sf.write(audio_path, audio, RATE, subtype='FLOAT')
    report.data['audio'] = artifact(audio_path)
    report.save('reset-and-repeat-state-parity-after-measurement')
    report.data['resetParity'] = parity_sequence(step, fixture)
    events = [{'name': item.node_name, 'type': item.node_type, 'executionType': item.exec_type,
               'status': str(item.status), 'realTimeUs': item.real_time.total_seconds() * 1e6}
              for item in request.get_profiling_info()]
    executed = [item for item in events if 'EXECUTED' in item['status'].upper()]
    low_precision = [item for item in executed if any(token in item['executionType'].lower() for token in ['bf16', 'fp16', '_f16', '_i8', '_u8'])]
    report.data.update(profilingEnabled=True, lastCallProfile=events,
                       executedOperationTypes=dict(Counter(item['executionType'] for item in executed)),
                       unexpectedLowPrecisionExecutions=low_precision,
                       actualCpuExecutionVerified=bool(executed) and devices == ['CPU'],
                       numericalParityPassed=full_parity['passed'] and report.data['resetParity']['passed'],
                       limits=['Unpaced complete-file CPU experiment; no capture/playback, routing, browser or OBS.',
                               'All chunks are prepared before timing; input arrival and real-time scheduling are unmeasured.',
                               'Per-block time includes synchronous infer and owned output/state copies, with profiling enabled.',
                               'Wall time also includes finite-state checks and occasional progress writes.',
                               'Buffer-plus-compute estimate excludes physical devices, queues, routing and acoustic alignment.',
                               'One research target voice; numerical similarity is not accepted listening quality or character fit.',
                               'No automatic fallback, reduced precision, threshold change or active-service integration.'])
    report.save('final-numerical-and-device-gates')
    if not report.data['numericalParityPassed'] or not report.data['actualCpuExecutionVerified'] or low_precision:
        raise ValueError('Final waveform/reset/device/FP32 gate failed; retained timings are diagnostic only')
    report.data.update(state='passed', computeThroughputBelowInputDuration=report.data['computeRealTimeFactor'] < 1)
    report.save('passed')


if __name__ == '__main__':
    main()
