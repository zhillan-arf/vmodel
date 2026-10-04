"""Inventory installed OpenVINO code/notices without importing its telemetry."""
import hashlib
import importlib.metadata as metadata
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]


def sha(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for block in iter(lambda: f.read(1048576), b''):
            h.update(block)
    return h.hexdigest()


def main():
    packages, notices, native = [], [], []
    selected_native = {'openvino.dll', 'openvino_intel_cpu_plugin.dll', 'openvino_intel_gpu_plugin.dll',
                       'openvino_onnx_frontend.dll', 'tbb12.dll', 'tbbbind_2_5.dll'}
    for dist in sorted(metadata.distributions(), key=lambda d: d.metadata['Name'].lower()):
        packages.append({'name': dist.metadata['Name'], 'version': dist.version,
                         'licenseExpression': dist.metadata.get('License-Expression'),
                         'licenseMetadata': dist.metadata.get('License')})
        for item in dist.files or []:
            name = str(item).lower()
            p = Path(dist.locate_file(item)).resolve()
            if not p.is_file():
                continue
            if any(s in name for s in ['license', 'licensing/', 'copying', 'notice']):
                notices.append({'package': dist.metadata['Name'], 'path': p.relative_to(ROOT).as_posix(), 'sha256': sha(p)})
            if p.name in selected_native:
                native.append({'path': p.relative_to(ROOT).as_posix(), 'bytes': p.stat().st_size, 'sha256': sha(p)})
    result = {'schemaVersion': 1, 'environment': '.tools/voice/openvino-venv', 'python': sys.version.split()[0],
              'lock': 'config/voice/requirements-openvino.lock', 'packages': packages,
              'retainedNotices': notices, 'selectedNativeLibraries': native,
              'codeTerms': 'OpenVINO CPU/GPU/ONNX components Apache-2.0 with bundled third-party notices retained; Windows and installed Intel hardware drivers remain platform dependencies.',
              'inactiveComponents': 'Bundled NPU and other framework frontends are not selected for this experiment; their presence is not an NPU support or licensing verdict.',
              'telemetry': 'Runtime worker sets isolated LOCALAPPDATA supported consent file to 0 before OpenVINO import and denies Python sockets. This inventory imports only package metadata.'}
    (ROOT / 'ops/001-zhil/sprint-001/reports/voice-openvino-environment.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    print(json.dumps({'packages': len(packages), 'retainedNotices': len(notices), 'selectedNativeLibraries': len(native)}))


if __name__ == '__main__':
    main()
