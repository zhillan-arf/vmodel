"""Measure the local Rei VRM and save its inventory."""
import hashlib
import io
import json
from pathlib import Path
import struct

from PIL import Image

ROOT = Path(__file__).resolve().parents[5]
OUTPUT = ROOT / 'ops/001-zhil/sprint-002/research/rei-vrchat-local'
OUTPUT.mkdir(parents=True, exist_ok=True)
source = ROOT / 'assets/avatars/rei.vrm'
data = source.read_bytes()
length = struct.unpack_from('<I', data, 12)[0]
document = json.loads(data[20:20 + length])
binary = data[28 + length:]
vrm = document['extensions']['VRM']
accessors = document['accessors']
images = []
for index, entry in enumerate(document['images']):
    view = document['bufferViews'][entry['bufferView']]
    start = view.get('byteOffset', 0)
    encoded = binary[start:start + view['byteLength']]
    with Image.open(io.BytesIO(encoded)) as img:
        images.append({'index': index, 'name': entry.get('name'), 'width': img.width,
                       'height': img.height, 'encodedBytes': len(encoded)})

result = {
    'date': '2026-10-05',
    'source': str(source.relative_to(ROOT)),
    'sha256': hashlib.sha256(data).hexdigest(),
    'publicCopyMatches': data == (ROOT / 'public/avatars/rei.vrm').read_bytes(),
    'bytes': len(data),
    'meta': vrm['meta'],
    'triangles': sum(accessors[p['indices']]['count'] // 3
                     for m in document['meshes'] for p in m['primitives']),
    'meshCount': len(document['meshes']),
    'primitiveCount': sum(len(m['primitives']) for m in document['meshes']),
    'materialCount': len(document['materials']),
    'materials': vrm['materialProperties'],
    'images': images,
    'humanoidBones': vrm['humanoid']['humanBones'],
    'morphs': [{'mesh': m['name'], 'names': m.get('extras', {}).get('targetNames', [])}
               for m in document['meshes']],
    'expressionGroups': vrm['blendShapeMaster']['blendShapeGroups'],
    'springGroups': len(vrm['secondaryAnimation']['boneGroups']),
    'colliderGroups': len(vrm['secondaryAnimation']['colliderGroups']),
    'colliders': sum(len(g['colliders']) for g in vrm['secondaryAnimation']['colliderGroups']),
    'lookAtType': vrm['firstPerson'].get('lookAtTypeName'),
}
target = OUTPUT / 'asset-audit.json'
target.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
print(json.dumps({k: result[k] for k in ['sha256', 'publicCopyMatches', 'bytes', 'triangles',
                                       'meshCount', 'primitiveCount', 'materialCount',
                                       'springGroups', 'colliderGroups', 'colliders', 'lookAtType']}))
print('Image dimensions:', sorted(set((i['width'], i['height']) for i in images)))
