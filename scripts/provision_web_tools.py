"""Install checksum-pinned local encoder; never modify global PATH or packages."""
from pathlib import Path
import base64, hashlib, json, subprocess, urllib.request, zipfile

ROOT = Path(__file__).resolve().parents[1]
config = json.loads((ROOT/'config/web-resources/toolchain.json').read_text())
tool = config['ffmpeg']
archive = ROOT/tool['archiveDirectory']/tool['url'].rsplit('/', 1)[-1]
archive.parent.mkdir(parents=True, exist_ok=True)
if not archive.exists():
    print('Downloading pinned FFmpeg', flush=True)
    with urllib.request.urlopen(tool['url'], timeout=60) as response, archive.open('wb') as output:
        while block := response.read(1024*1024):
            output.write(block)
actual = hashlib.file_digest(archive.open('rb'), 'sha256').hexdigest()
if actual != tool['sha256']:
    raise RuntimeError(f'FFmpeg checksum mismatch: {actual}')
destination = ROOT/'.tools/web'
destination.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(archive) as package:
    for entry in package.infolist():
        if not (destination/entry.filename).resolve().is_relative_to(destination.resolve()):
            raise RuntimeError('Archive path escapes tool directory')
    package.extractall(destination)
binary = ROOT/tool['installDirectory']/'bin/ffmpeg.exe'
version = subprocess.check_output([str(binary), '-version'], text=True)
encoders = subprocess.check_output([str(binary), '-hide_banner', '-encoders'], text=True)
for name in ['libvpx-vp9', 'libwebp_anim']:
    if name not in encoders:
        raise RuntimeError(f'Required encoder absent: {name}')
report = ROOT/'ops/001-zhil/sprint-001/reports/web-encoder-build.txt'
report.write_text(version+'\n'+encoders, encoding='utf-8')
notices=destination/'notices';notices.mkdir(exist_ok=True)
for notice in config.get('notices',[]):
    target=notices/notice['file']
    data=target.read_bytes() if target.exists() else base64.b64decode(urllib.request.urlopen(notice['url']).read())
    if hashlib.sha256(data).hexdigest()!=notice['sha256']:raise RuntimeError(f'Notice checksum mismatch: {target.name}')
    target.write_bytes(data)
print(version.splitlines()[0], flush=True)
print(f'FFmpeg verified SHA-256 {actual}; libvpx-vp9 and libwebp_anim present', flush=True)
