"""Provision pinned official tool releases into the project, never user preferences."""
from pathlib import Path
import hashlib
import json
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.cache' / 'downloads'
TOOLS = ROOT / '.tools'
MANIFEST = ROOT / 'config' / 'tool-downloads.json'

def fetch(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'VModel-Setup/1.0'}), timeout=60)

def provision():
    CACHE.mkdir(parents=True, exist_ok=True)
    TOOLS.mkdir(exist_ok=True)
    if MANIFEST.exists():
        entries = json.loads(MANIFEST.read_text())
    else:
        selections = [
            ('MMD-Blender/blender_mmd_tools', 'v4.5.14', lambda n: n.endswith('.zip') and 'mmd_tools' in n, 'mmd'),
            ('saturday06/VRM-Addon-for-Blender', 'v4.7.1', lambda n: n == 'VRM_Addon_for_Blender-4_7_1.zip', 'vrm'),
            ('obsproject/obs-studio', '32.2.2', lambda n: n == 'OBS-Studio-32.2.2-Windows-x64.zip', 'obs'),
        ]
        entries = []
        for repo, version, select, dest in selections:
            with fetch(f'https://api.github.com/repos/{repo}/releases/tags/{version}') as response:
                release = json.load(response)
            candidates = [a for a in release['assets'] if select(a['name'])]
            if len(candidates) != 1:
                raise RuntimeError(f'Expected one asset for {repo}: {[a["name"] for a in candidates]}')
            asset = candidates[0]
            digest = asset.get('digest', '')
            if not digest.startswith('sha256:'):
                raise RuntimeError(f'No publisher checksum for {asset["name"]}')
            entries.append(dict(repo=repo, version=version, filename=asset['name'], url=asset['browser_download_url'], sha256=digest[7:], destination=dest))
        MANIFEST.parent.mkdir(exist_ok=True)
        MANIFEST.write_text(json.dumps(entries, indent=2) + '\n')
    for entry in entries:
        archive = CACHE / entry['filename']
        if not archive.exists() or hashlib.file_digest(archive.open('rb'), 'sha256').hexdigest() != entry['sha256']:
            partial = archive.with_suffix('.partial')
            print(f'Downloading {entry["filename"]}', flush=True)
            with fetch(entry['url']) as response, partial.open('wb') as target:
                while chunk := response.read(1024 * 1024):
                    target.write(chunk)
            with partial.open('rb') as stream:
                actual = hashlib.file_digest(stream, 'sha256').hexdigest()
            if actual != entry['sha256']:
                raise RuntimeError(f'Checksum mismatch: {entry["filename"]}')
            partial.replace(archive)
        destination = TOOLS / entry['destination']
        marker = destination / '.vmodel-installed.json'
        if not marker.exists() or json.loads(marker.read_text()).get('sha256') != entry['sha256']:
            destination.mkdir(parents=True, exist_ok=True)
            with zipfile.ZipFile(archive) as z:
                for member in z.infolist():
                    resolved = (destination / member.filename).resolve()
                    if not resolved.is_relative_to(destination.resolve()):
                        raise RuntimeError(f'Unsafe archive path: {member.filename}')
                z.extractall(destination)
            marker.write_text(json.dumps(entry, indent=2) + '\n')
        print(f'Installed and checksum verified: {entry["repo"]} {entry["version"]}', flush=True)

if __name__ == '__main__':
    provision()
