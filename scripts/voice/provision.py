"""Provision pinned, local CPU voice assets. Run with the repository's normal Python.

Downloads public inputs only. Does not start a server, open audio devices, or fetch
the upstream sample catalog. The lock and manifest are maintained in config/voice.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import urllib.request

ROOT = Path(__file__).resolve().parents[2]


def inside(path: str) -> Path:
    candidate = (ROOT / path).resolve()
    candidate.relative_to(ROOT)
    return candidate


def digest(path: Path) -> str:
    checksum = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            checksum.update(block)
    return checksum.hexdigest()


def fetch(asset: dict) -> None:
    target = inside(asset['path'])
    if target.exists() and digest(target) == asset['sha256']:
        print(f"Verified {asset['id']}", flush=True)
        return
    target.parent.mkdir(parents=True, exist_ok=True)
    partial = target.with_name(target.name + '.partial')
    request = urllib.request.Request(asset['url'], headers={'User-Agent': 'VModel-Voice-Provision/1'})
    with urllib.request.urlopen(request, timeout=120) as response, partial.open('wb') as output:
        shutil.copyfileobj(response, output, length=1024 * 1024)
    if digest(partial) != asset['sha256'] or partial.stat().st_size != asset['bytes']:
        raise RuntimeError(f"Hash or size mismatch: {asset['id']}. Candidate kept as .partial.")
    partial.replace(target)
    print(f"Downloaded and verified {asset['id']}", flush=True)


def run(*args: str) -> None:
    subprocess.run(args, cwd=ROOT, check=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--assets-only', action='store_true')
    options = parser.parse_args()
    manifest = json.loads((ROOT / 'config/voice/assets.json').read_text(encoding='utf-8'))
    if not options.assets_only:
        source = inside(manifest['engine']['path'])
        if not source.exists():
            run('git', 'clone', '--no-checkout', '--filter=blob:none', manifest['engine']['url'], str(source))
        current = subprocess.run(['git', '-C', str(source), 'rev-parse', 'HEAD'], capture_output=True, text=True, check=True).stdout.strip()
        if current != manifest['engine']['revision']:
            dirty = subprocess.run(['git', '-C', str(source), 'status', '--porcelain'], capture_output=True, text=True, check=True).stdout.strip()
            if dirty:
                raise RuntimeError('Voice source has local edits; preserve them before changing its revision.')
            run('git', '-C', str(source), 'fetch', 'origin', manifest['engine']['revision'])
            run('git', '-C', str(source), 'checkout', '--detach', manifest['engine']['revision'])
        run('uv', 'python', 'install', manifest['python'])
        interpreter = inside('.tools/voice/venv/Scripts/python.exe')
        if not interpreter.exists():
            run('uv', 'venv', '--python', manifest['python'], str(interpreter.parents[1]))
        run('uv', 'pip', 'sync', '--python', str(interpreter), '--require-hashes', 'config/voice/requirements-cpu.lock')
        run('uv', 'pip', 'check', '--python', str(interpreter))
    for asset in manifest['assets']:
        fetch(asset)


if __name__ == '__main__':
    main()
