"""Record the optional runtime environment without opening devices/network."""
import hashlib
import importlib.metadata as metadata
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]


def digest(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1048576), b''):
            h.update(chunk)
    return h.hexdigest()


def main():
    import onnxruntime as ort
    distributions, notices = [], []
    for dist in sorted(metadata.distributions(), key=lambda d: d.metadata['Name'].lower()):
        distributions.append({'name': dist.metadata['Name'], 'version': dist.version,
                              'licenseExpression': dist.metadata.get('License-Expression'),
                              'licenseMetadata': dist.metadata.get('License')})
        for item in dist.files or []:
            label = str(item).lower()
            if any(s in label for s in ['license', 'thirdpartynotices', 'copying', 'notice.txt']):
                path = Path(dist.locate_file(item)).resolve()
                if path.is_file():
                    notices.append({'distribution': dist.metadata['Name'],
                                    'path': path.relative_to(ROOT).as_posix(), 'sha256': digest(path)})
    dll = Path(ort.__file__).parent / 'capi/DirectML.dll'
    report = {'schemaVersion': 1, 'python': sys.version.split()[0], 'environment': '.tools/voice/onnx-venv',
              'lock': 'config/voice/requirements-onnx.lock', 'distributions': distributions,
              'retainedNotices': notices, 'onnxruntime': ort.__version__,
              'availableProviders': ort.get_available_providers(),
              'directml': {'version': '1.15.4+241025-1615.1.dml-1.15.fac7597',
                           'path': dll.relative_to(ROOT).as_posix(), 'sha256': digest(dll),
                           'bytes': dll.stat().st_size,
                           'terms': 'Microsoft Software License Terms for DirectML; proprietary Windows/Xbox redistributable, not the repository MIT license',
                           'termsUrl': 'https://www.nuget.org/packages/Microsoft.AI.DirectML/1.15.4/License'},
              'selection': 'Optional platform-acceleration probe only. Not the accepted OSS inference baseline; CPU baseline unchanged.'}
    (ROOT / 'ops/001-zhil/sprint-001/reports/voice-onnx-environment.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps({'distributions': len(distributions), 'retainedNotices': len(notices),
                      'availableProviders': ort.get_available_providers(), 'directmlSha256': digest(dll)}, indent=2))


if __name__ == '__main__':
    main()
