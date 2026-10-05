"""Measure the supplied traces without changes to their contents."""

from collections import Counter
from hashlib import sha256
import json
import math
from pathlib import Path
import subprocess
import struct

ROOT = Path(__file__).resolve().parents[5]
SPRINT = ROOT / "ops/001-zhil/sprint-002"


def distribution(values):
    values = sorted(values)
    if not values:
        return {"count": 0}
    return {
        "count": len(values),
        "min": values[0],
        "p50": values[math.ceil(len(values) * .5) - 1],
        "p95": values[math.ceil(len(values) * .95) - 1],
        "max": values[-1],
    }


def analyze(path):
    raw = path.read_bytes()
    trace = json.loads(raw)
    samples = [e for e in trace["events"] if e["kind"] == "sample"]
    applies = [e for e in trace["events"] if e["kind"] == "apply"]
    frames = {}
    for event in samples:
        frame = dict(event["frame"])
        for task, reference in event.get("references", {}).items():
            keys = {"face": ["face", "faceMatrix"], "pose": ["pose", "poseImage"], "hands": ["hands"]}[task]
            for key in keys:
                frame[key] = frames[reference][key]
        frames[frame["sequence"]] = frame
    reason_counts = Counter(
        (reason["stage"], reason["channel"], reason["reason"])
        for event in applies for reason in event.get("reasons", [])
    )
    unique = {}
    for task in ["face", "pose", "hands"]:
        unique[task] = list({e["diagnostics"]["tasks"][task]["sampleSequence"]: e for e in samples}.values())
    task_stats = {}
    for task, events in unique.items():
        times = sorted(e["diagnostics"]["tasks"][task]["sampleTimeMs"] for e in events)
        times_in_window = [t for t in times if t >= trace["manifest"]["startTimeMs"]]
        dt = [b - a for a, b in zip(times_in_window, times_in_window[1:])]
        ages = [e["solverTimeMs"] - frames[e["frameSequence"]]["samples"][task]["timestamp"] for e in applies]
        task_stats[task] = {
            "unique_samples": len(events),
            "unique_samples_in_window": len(times_in_window),
            "present_unique_samples": sum(e["diagnostics"]["tasks"][task]["present"] for e in events),
            "rate_hz_in_window": (len(times_in_window) - 1) * 1000 / (times_in_window[-1] - times_in_window[0]) if len(times_in_window) > 1 else None,
            "sample_interval_ms": distribution(dt),
            "inference_ms": distribution([e["diagnostics"]["tasks"][task]["finishedAtMs"] - e["diagnostics"]["tasks"][task]["startedAtMs"] for e in events]),
            "age_at_apply_ms": distribution(ages),
            "applies_age_at_least_500ms": sum(age >= 500 for age in ages),
        }
    hand_frames = [frames[e["frame"]["sequence"]] for e in unique["hands"]]
    hand_points = [p for frame in hand_frames for h in frame["hands"] for p in h["world"]]
    pose_frames = [frames[e["frame"]["sequence"]] for e in unique["pose"]]
    channels = ["spine", "leftArm", "rightArm", "leftUpperArm", "rightUpperArm"]
    return {
        "file": str(path.relative_to(ROOT)), "sha256": sha256(raw).hexdigest(),
        "bytes": len(raw), "trace_id": trace["id"], "manifest": trace["manifest"],
        "sample_events": len(samples), "apply_events": len(applies),
        "duration_ms": max(e["timeMs"] for e in trace["events"]),
        "task_stats": task_stats,
        "unique_hand_observations": sum(len(f["hands"]) for f in hand_frames),
        "hand_count_per_unique_sample": dict(Counter(len(f["hands"]) for f in hand_frames)),
        "hand_world_visibility": dict(Counter(str(p.get("visibility", "absent")) for p in hand_points)),
        "hand_world_presence": dict(Counter(str(p.get("presence", "absent")) for p in hand_points)),
        "pose_visibility": {str(i): distribution([f["pose"][i].get("visibility", 1) for f in pose_frames if len(f["pose"]) > i]) for i in [11, 12, 13, 14, 15, 16, 23, 24]},
        "hips_outside_image_samples": sum(any(not 0 <= f["poseImage"][i]["y"] <= 1 for i in [23, 24]) for f in pose_frames if len(f["poseImage"]) == 33),
        "solver_channels": {c: dict(Counter(r["reason"] for e in applies for r in e.get("reasons", []) if r["channel"] == c and r["stage"] == "solver")) for c in channels},
        "reasons": [{"stage": stage, "channel": channel, "reason": reason, "count": count} for (stage, channel, reason), count in sorted(reason_counts.items())],
    }


def model_inventory(path):
    raw = path.read_bytes()
    length = struct.unpack_from("<I", raw, 12)[0]
    data = json.loads(raw[20:20 + length])
    extensions = data.get("extensions", {})
    vrm0 = extensions.get("VRM", {})
    vrm1 = extensions.get("VRMC_vrm", {})
    return {
        "path": str(path.relative_to(ROOT)), "sha256": sha256(raw).hexdigest(),
        "vrm_version": vrm1.get("specVersion", vrm0.get("specVersion")),
        "node_count": len(data.get("nodes", [])), "mesh_count": len(data.get("meshes", [])),
        "expressions": vrm1.get("expressions", vrm0.get("blendShapeMaster", {}).get("blendShapeGroups", [])),
    }


output = {
    "source_commit": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
    "source_hashes": {name: sha256((ROOT / name).read_bytes()).hexdigest() for name in [
        "src/motion-solver.ts", "src/retarget-math.ts", "src/finger-solver.ts", "src/limb-solver.ts",
        "src/tracking.worker.ts", "src/tracking-recording.ts", "src/canonical-rig.ts", "src/viewer.ts",
        "node_modules/@mediapipe/tasks-vision/vision_bundle.mjs",
    ]},
    "method": "Resolve task references before measurements. Count each task identity once for inference statistics. Count each apply event for age statistics.",
    "models": [model_inventory(ROOT / f"assets/avatars/{name}.vrm") for name in ["ene", "rei"]],
    "traces": [analyze(p) for p in sorted((SPRINT / "research/trace").glob("*.json"))],
}
(SPRINT / "reports").mkdir(parents=True, exist_ok=True)
(SPRINT / "reports/trace-analysis.json").write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8", newline="\n")
for trace in output["traces"]:
    print(Path(trace["file"]).name, trace["sample_events"], trace["unique_hand_observations"], trace["solver_channels"])
