"""Inspect the downloaded official archive without executing its code."""
import hashlib
import io
import json
from pathlib import Path
import struct
import tarfile
import zipfile

ROOT = Path(__file__).resolve().parents[5]
OUTPUT = ROOT / 'ops/001-zhil/sprint-002/research/rei-vrchat-local'
archive = OUTPUT / 'official-rei-v1.0.0.zip'


def decode_vrm(data):
    length = struct.unpack_from('<I', data, 12)[0]
    return json.loads(data[20:20 + length]), data[28 + length:]


def image_hashes(document, binary):
    result = set()
    for image in document['images']:
        view = document['bufferViews'][image['bufferView']]
        start = view.get('byteOffset', 0)
        result.add(hashlib.sha256(binary[start:start + view['byteLength']]).hexdigest())
    return result


local_document, local_binary = decode_vrm((ROOT / 'assets/avatars/rei.vrm').read_bytes())
report = {'archiveSha256': hashlib.sha256(archive.read_bytes()).hexdigest()}
files = []
with zipfile.ZipFile(archive) as source:
    assert source.testzip() is None
    report['crcCheckPassed'] = True
    for entry in source.infolist():
        try:
            name = entry.filename.encode('cp437').decode('cp932')
        except UnicodeError:
            name = entry.filename
        files.append({'name': name, 'bytes': entry.file_size})
        if name.endswith('.vrm'):
            data = source.read(entry)
            document, binary = decode_vrm(data)
            report['vrm'] = {
                'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(),
                'meta': document['extensions']['VRM']['meta'],
                'triangles': sum(document['accessors'][p['indices']]['count'] // 3
                                 for m in document['meshes'] for p in m['primitives']),
                'materials': len(document['materials']), 'images': len(document['images']),
                'imageHashesSharedWithLocal': len(image_hashes(document, binary)
                                                & image_hashes(local_document, local_binary)),
            }
            (OUTPUT / 'official-rei-v1.0.0.vrm').write_bytes(data)
        elif name.endswith('.unitypackage'):
            with tarfile.open(fileobj=io.BytesIO(source.read(entry)), mode='r:gz') as package:
                report['unityPackagePaths'] = [package.extractfile(item).read().decode('utf-8')
                                               for item in package.getmembers()
                                               if item.isfile() and item.name.endswith('/pathname')]
        elif name.endswith('readme.txt'):
            text = source.read(entry).decode('cp932').replace('\r\n', '\n')
            (OUTPUT / 'archive-readme.txt').write_text(text, encoding='utf-8', newline='\n')

for filename, data in [('archive-audit.json', report), ('archive-files.json', files)]:
    (OUTPUT / filename).write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n',
                                   encoding='utf-8', newline='\n')
print(json.dumps({'crcCheckPassed': report['crcCheckPassed'], 'vrm': report['vrm']}, ensure_ascii=False))
