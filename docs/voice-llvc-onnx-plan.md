# LLVC compiler experiment

This private experiment tests whether the existing LLVC research model can run through a fixed 52 ms ONNX graph and OpenVINO CPU backend. It is separate from Voice Studio and does not change its presets or audio routes.

**Current result: the first export attempt failed recurrent-state parity.** Its waveform was close to eager output, but encoder/decoder state errors exceeded the required limits during silence. The dependent OpenVINO timing probe was skipped. [Measured result and retained evidence](../ops/001-zhil/sprint-001/reports/voice-llvc-onnx.md).

The [detailed execution plan](../ops/001-zhil/sprint-001/reports/voice-llvc-onnx-plan.md) records exact inputs/states, source and model pins, numerical thresholds, ownership, time limits and measurement boundaries. Original source and weights remain unchanged. The failure is preserved; no passing model manifest exists.

These commands require an explicitly coordinated quiet laptop window. They are developer experiments, not the normal Voice Studio launcher:

```powershell
python scripts/voice/export_llvc_onnx.py --quiet-window
```

Only after a current export passes every waveform/state/reset gate would its dependent command be eligible:

```powershell
python scripts/voice/probe_llvc_openvino.py --threads 1 --quiet-window
```

The probe enforces that prerequisite itself. Both workers have a 180-second cap and retain failures. A numerical or mean-compute improvement would still require deadline, wall-time, listening and streaming validation before any live acceptance.
