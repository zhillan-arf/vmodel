"""Measure Ene without changes to the model."""
from collections import Counter
import hashlib
import io
import json
from pathlib import Path
import struct

from PIL import Image

ROOT = Path(__file__).resolve().parents[5]
OUTPUT = ROOT / 'ops/001-zhil/sprint-002/research/ene-v2-local'
OUTPUT.mkdir(parents=True, exist_ok=True)
source = ROOT / 'assets/avatars/ene.vrm'
data = source.read_bytes()
length = struct.unpack_from('<I', data, 12)[0]
document = json.loads(data[20:20 + length])
binary = data[28 + length:]
vrm = document['extensions']['VRMC_vrm']
accessors = document['accessors']
images = []
for index, entry in enumerate(document['images']):
    view = document['bufferViews'][entry['bufferView']]
    start = view.get('byteOffset', 0)
    encoded = binary[start:start + view['byteLength']]
    with Image.open(io.BytesIO(encoded)) as img:
        images.append({'index': index, 'name': entry.get('name'), 'width': img.width,
                       'height': img.height, 'encodedBytes': len(encoded),
                       'rgbaBytes': img.width * img.height * 4})
roles = {}
for mesh in document['meshes']:
    for primitive in mesh['primitives']:
        roles[primitive['indices']] = 'indices'
        for role, index in primitive['attributes'].items():
            roles[index] = role
        for target in primitive.get('targets', []):
            for role, index in target.items():
                roles[index] = 'morph_' + role
bytes_by_role = Counter()
views_seen = set()
for index, role in roles.items():
    accessor = accessors[index]
    if 'bufferView' in accessor and accessor['bufferView'] not in views_seen:
        view_index = accessor['bufferView']
        bytes_by_role[role] += document['bufferViews'][view_index]['byteLength']
        views_seen.add(view_index)
names = document['meshes'][0]['extras']['targetNames']
presets = vrm['expressions']['preset']
bound = {bind['index'] for expression in presets.values()
         for bind in expression.get('morphTargetBinds', [])}
source_inventory = json.loads((ROOT / 'ops/001-zhil/sprint-001/reports/asset-inventory.json').read_text())[0]
spring = document['extensions']['VRMC_springBone']
result = {
    'date': '2026-10-05', 'source': str(source.relative_to(ROOT)),
    'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data),
    'publicCopyMatches': data == (ROOT / 'public/avatars/ene.vrm').read_bytes(),
    'meta': vrm['meta'],
    'triangles': sum(accessors[p['indices']]['count'] // 3
                     for m in document['meshes'] for p in m['primitives']),
    'primitiveVertices': sum(accessors[p['attributes']['POSITION']]['count']
                             for m in document['meshes'] for p in m['primitives']),
    'meshCount': len(document['meshes']),
    'primitiveCount': sum(len(m['primitives']) for m in document['meshes']),
    'materialCount': len(document['materials']), 'materials': document['materials'],
    'alphaModes': dict(Counter(m.get('alphaMode', 'OPAQUE') for m in document['materials'])),
    'outlineModes': dict(Counter(m['extensions']['VRMC_materials_mtoon']['outlineWidthMode']
                                for m in document['materials'])),
    'images': images, 'imageEncodedBytes': sum(i['encodedBytes'] for i in images),
    'imageRgbaBytesWithoutMipmaps': sum(i['rgbaBytes'] for i in images),
    'accessorBytesByRole': dict(bytes_by_role),
    'humanoidBones': vrm['humanoid']['humanBones'],
    'morphNames': names, 'sourceMorphs': source_inventory['morphs'],
    'expressions': vrm['expressions'], 'boundMorphCount': len(bound),
    'unboundMorphNames': [n for i, n in enumerate(names) if i not in bound],
    'springGroups': len(spring['springs']),
    'springJoints': sum(len(s['joints']) for s in spring['springs']),
    'colliderGroups': len(spring['colliderGroups']), 'colliders': len(spring['colliders']),
    'lookAt': vrm.get('lookAt'),
}
(OUTPUT / 'asset-audit.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n',
                                         encoding='utf-8', newline='\n')
print(json.dumps({k: result[k] for k in ['bytes', 'sha256', 'triangles', 'primitiveVertices',
    'materialCount', 'alphaModes', 'outlineModes', 'imageEncodedBytes', 'accessorBytesByRole',
    'boundMorphCount', 'springGroups', 'springJoints', 'colliders']}))
