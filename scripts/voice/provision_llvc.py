"""Provision the bounded LLVC CPU experiment, separate from the active voice service."""
from __future__ import annotations

import ast
import hashlib
import json
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / '.tools/voice/llvc'
SOURCE_REVISION = '1627c5d358cf9bb2b92b0ccc513d8b36807c923d'
MODEL_REVISION = 'ebfe8c0fdeb974a7eeb463b3abbc8ce42a0e3851'
BRAIN_REVISION = '31c1e329048c0380dc7f2acbe680c44a036b6286'
MODEL_HASH = 'cceb7ab9621f84d62d283725ae3281cacb04f762d6a088fe3e97c1a29d4b8c0e'
MODEL_BYTES = 39489146
MODEL = ROOT / 'assets/voice/llvc/G_500000.pth'


def sha(file: Path) -> str:
    value = hashlib.sha256()
    with file.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1048576), b''):
            value.update(chunk)
    return value.hexdigest()


def fetch(url: str, file: Path, limit: int, expected_hash: str | None = None):
    if file.exists() and expected_hash and sha(file) == expected_hash:
        return
    file.parent.mkdir(parents=True, exist_ok=True)
    temporary = file.with_name(file.name + '.download')
    request = urllib.request.Request(url, headers={'User-Agent': 'EneStudio-LLVC-provision'})
    try:
        with urllib.request.urlopen(request, timeout=30) as response, temporary.open('wb') as output:
            size = 0
            while chunk := response.read(1048576):
                size += len(chunk)
                if size > limit:
                    raise ValueError(f'Download exceeds the pinned size bound: {file.name}')
                output.write(chunk)
        if expected_hash and sha(temporary) != expected_hash:
            raise ValueError(f'Unexpected downloaded hash: {file.name}')
        temporary.replace(file)
    finally:
        if temporary.exists():
            temporary.unlink()


def main():
    artifacts = []
    upstream = f'https://raw.githubusercontent.com/KoeAI/LLVC/{SOURCE_REVISION}/'
    for name in ['LICENSE', 'README.md', 'model.py', 'cached_convnet.py', 'infer.py', 'experiments/llvc/config.json']:
        file = BASE / 'source' / name
        fetch(upstream + name, file, 250000)
        artifacts.append({'path': str(file.relative_to(ROOT)).replace('\\', '/'), 'url': upstream + name, 'sha256': sha(file)})
    brain_base = f'https://raw.githubusercontent.com/speechbrain/speechbrain/{BRAIN_REVISION}/'
    for name, target in [('LICENSE', 'LICENSE'), ('speechbrain/lobes/models/transformer/Transformer.py', 'Transformer.py')]:
        file = BASE / 'speechbrain-source' / target
        fetch(brain_base + name, file, 250000)
        artifacts.append({'path': str(file.relative_to(ROOT)).replace('\\', '/'), 'url': brain_base + name, 'sha256': sha(file)})
    card_url = f'https://huggingface.co/KoeAI/llvc/raw/{MODEL_REVISION}/README.md'
    card = BASE / 'model-card.md'
    fetch(card_url, card, 100000)
    if 'license: mit' not in card.read_text(encoding='utf-8').split('---')[1].lower():
        raise ValueError('The pinned checkpoint model card does not declare the reviewed MIT terms')
    url = f'https://huggingface.co/KoeAI/llvc/resolve/{MODEL_REVISION}/models/checkpoints/llvc/G_500000.pth'
    fetch(url, MODEL, MODEL_BYTES, MODEL_HASH)
    if MODEL.stat().st_size != MODEL_BYTES:
        raise ValueError('Unexpected checkpoint byte count')

    # Retain upstream source intact. Only its single SpeechBrain dependency is
    # extracted, with the original class body and Apache license, for inference.
    # No SpeechBrain training stack, teacher model, content encoder or F0 model
    # is downloaded or imported by this standalone LLVC experiment.
    runtime = BASE / 'runtime'
    runtime.mkdir(parents=True, exist_ok=True)
    brain = (BASE / 'speechbrain-source/Transformer.py').read_text(encoding='utf-8')
    classes = [item for item in ast.parse(brain).body if isinstance(item, ast.ClassDef) and item.name == 'PositionalEncoding']
    if len(classes) != 1:
        raise ValueError('Expected one pinned SpeechBrain positional encoding class')
    positional = ast.get_source_segment(brain, classes[0])
    preamble = ('# Extracted without changing the class from SpeechBrain v1.0.3.\n'
                '# Apache-2.0; see ../speechbrain-source/LICENSE.\n'
                '# Original authors: Jianyuan Zhong, Samuele Cornell, Shucong Zhang.\n'
                'import math\nimport torch\nfrom torch import nn\n\n')
    (runtime / 'llvc_position.py').write_text(preamble + positional + '\n', encoding='utf-8')
    source = (BASE / 'source/model.py').read_text(encoding='utf-8')
    old_import = 'from speechbrain.lobes.models.transformer.Transformer import PositionalEncoding'
    if source.count(old_import) != 1:
        raise ValueError('Expected the reviewed LLVC positional encoding import')
    (runtime / 'model.py').write_text(source.replace(old_import, 'from llvc_position import PositionalEncoding'), encoding='utf-8')
    (runtime / 'cached_convnet.py').write_bytes((BASE / 'source/cached_convnet.py').read_bytes())
    for file in sorted(runtime.glob('*.py')):
        artifacts.append({'path': str(file.relative_to(ROOT)).replace('\\', '/'), 'sha256': sha(file), 'derived': True})
    artifacts.append({'path': str(MODEL.relative_to(ROOT)).replace('\\', '/'), 'url': url, 'sha256': sha(MODEL), 'bytes': MODEL_BYTES})
    artifacts.append({'path': str(card.relative_to(ROOT)).replace('\\', '/'), 'url': card_url, 'sha256': sha(card)})
    manifest = {'schemaVersion': 1, 'engine': 'LLVC', 'sourceRevision': SOURCE_REVISION, 'modelRevision': MODEL_REVISION,
                'model': str(MODEL.relative_to(ROOT)).replace('\\', '/'), 'sourceLicense': 'MIT', 'checkpointLicense': 'MIT (pinned publisher model-card declaration)',
                'positionalEncodingLicense': 'Apache-2.0', 'positionalEncodingSource': 'SpeechBrain v1.0.3', 'positionalEncodingRevision': BRAIN_REVISION,
                'runtimePython': '.tools/voice/venv/Scripts/python.exe', 'artifacts': artifacts,
                'modifications': ['Only the LLVC positional-encoding import is redirected to the exact extracted upstream class.'],
                'notes': ['No trained teacher or auxiliary embedding/F0 checkpoint is used at LLVC inference.',
                          'This is one research target voice, not three distinct timbres or a selected cheerful character.',
                          'The active Voice Studio, its profiles and its OBS routes are unchanged.'],
                'inferenceRun': False, 'liveAccepted': False}
    (BASE / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    (ROOT / 'ops/reports/voice-llvc-provision.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'provisioned': True, 'artifacts': len(artifacts), 'checkpointBytes': MODEL_BYTES, 'inferenceRun': False}))


if __name__ == '__main__':
    main()
