"""Provision the supplied native Rei VRM unchanged; retain its source terms locally."""
import hashlib
import json
from pathlib import Path
import shutil
import struct
import zipfile

ROOT = Path(__file__).resolve().parent.parent
archives = list((ROOT / 'ops/001-zhil/sprint-001/resources/REI').glob('*VRM*.zip'))
if len(archives) != 1:
    raise SystemExit('Expected one Rei VRM archive in ops/001-zhil/sprint-001/resources/REI.')
with zipfile.ZipFile(archives[0]) as archive:
    models = [entry for entry in archive.infolist() if entry.filename.lower().endswith('.vrm')]
    if len(models) != 1:
        raise SystemExit('Expected one native VRM in the Rei archive.')
    data = archive.read(models[0])
    if data[:4] != b'glTF':
        raise SystemExit('Rei source is not a binary VRM.')
    document = json.loads(data[20:20 + struct.unpack_from('<I', data, 12)[0]])
    target = ROOT / 'assets/avatars'
    target.mkdir(parents=True, exist_ok=True)
    (target / 'rei.vrm').write_bytes(data)
    notices = ROOT / 'public/avatars/rei-notices'
    notices.mkdir(parents=True, exist_ok=True)
    for name in ('readme.txt', 'log.txt'):
        entry = next(item for item in archive.infolist() if item.filename.endswith('/' + name))
        # Preserve the original bytes and encoding, including all usage terms.
        (notices / name).write_bytes(archive.read(entry))
    (notices / 'provenance.json').write_text(json.dumps({
        'sourceArchive': archives[0].name,
        'archiveSha256': hashlib.sha256(archives[0].read_bytes()).hexdigest(),
        'vrmSha256': hashlib.sha256(data).hexdigest(),
        'bytes': len(data),
        'modified': False,
        'metadata': document.get('extensions', {}).get('VRM', {}).get('meta'),
        'termsEncoding': 'CP932',
    }, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    shutil.copyfile(target / 'rei.vrm', ROOT / 'public/avatars/rei.vrm')
print(f'Rei ready: {len(data):,} bytes; original VRM and terms retained.')
