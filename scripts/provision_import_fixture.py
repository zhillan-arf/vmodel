"""Download the pinned VRM import fixture and its original notice."""
import hashlib
import json
from pathlib import Path
from urllib.request import urlopen

root = Path(__file__).resolve().parents[1]
manifest = json.loads((root / 'config/import-fixture.json').read_text())
directory = root / manifest['directory']
directory.mkdir(parents=True, exist_ok=True)
for entry in manifest['files']:
    target = directory / entry['name']
    data = target.read_bytes() if target.exists() else urlopen(entry['url'], timeout=60).read()
    if hashlib.sha256(data).hexdigest() != entry['sha256']:
        raise SystemExit(f"Hash mismatch: {target}")
    if not target.exists():
        target.write_bytes(data)
    print(f"Verified {entry['name']}: {entry['sha256']}")
