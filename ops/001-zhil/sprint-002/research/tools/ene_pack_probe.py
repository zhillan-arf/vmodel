"""Make a smaller research copy with the same used accessor values."""
import copy
import hashlib
import json
from pathlib import Path
import struct

import numpy as np

ROOT = Path(__file__).resolve().parents[5]
OUT = ROOT / 'ops/001-zhil/sprint-002/research/ene-v2-local'
source = (ROOT / 'assets/avatars/ene.vrm').read_bytes()
size = struct.unpack_from('<I', source, 12)[0]
original = json.loads(source[20:20 + size])
binary = source[28 + size:]
document = copy.deepcopy(original)
assert not document.get('animations')
assert not any('sparse' in a for a in document['accessors'])
assert not any('byteStride' in v for v in document['bufferViews'])
assert set(document['extensions']) == {'VRMC_vrm', 'VRMC_springBone'}
references = []
morphs = set()
for mesh in document['meshes']:
    for primitive in mesh['primitives']:
        references.append((primitive, 'indices'))
        references.extend((primitive['attributes'], k) for k in primitive['attributes'])
        for target in primitive.get('targets', []):
            references.extend((target, k) for k in target)
            morphs.update(target.values())
for skin in document['skins']:
    references.append((skin, 'inverseBindMatrices'))
used = sorted({container[key] for container, key in references})
mapping = {old: new for new, old in enumerate(used)}
for container, key in references:
    container[key] = mapping[container[key]]
document['accessors'] = [document['accessors'][i] for i in used]
views = []
payload = bytearray()

def append_view(raw, target=None):
    payload.extend(b'\0' * (-len(payload) % 4))
    view = {'buffer': 0, 'byteOffset': len(payload), 'byteLength': len(raw)}
    if target is not None:
        view['target'] = target
    views.append(view)
    payload.extend(raw)
    return len(views) - 1

def old_view(index):
    view = original['bufferViews'][index]
    start = view.get('byteOffset', 0)
    return binary[start:start + view['byteLength']]

copied = {}
def copy_view(index):
    if index not in copied:
        copied[index] = append_view(old_view(index), original['bufferViews'][index].get('target'))
    return copied[index]

sparse_count = zero_count = 0
for old, accessor in zip(used, document['accessors']):
    if old in morphs:
        assert accessor['componentType'] == 5126 and accessor['type'] == 'VEC3'
        start = accessor.get('byteOffset', 0)
        dense = np.frombuffer(old_view(accessor['bufferView']), dtype='<f4',
                              count=accessor['count'] * 3, offset=start).reshape(-1, 3)
        indices = np.flatnonzero(np.any(dense != 0, axis=1))
        index_type = '<u2' if accessor['count'] <= 65536 else '<u4'
        index_size = np.dtype(index_type).itemsize
        if len(indices) * (12 + index_size) < dense.nbytes:
            del accessor['bufferView']
            accessor.pop('byteOffset', None)
            if len(indices):
                accessor['sparse'] = {
                    'count': len(indices),
                    'indices': {'bufferView': append_view(indices.astype(index_type).tobytes()),
                                'componentType': 5123 if index_size == 2 else 5125},
                    'values': {'bufferView': append_view(dense[indices].tobytes())},
                }
                sparse_count += 1
            else:
                zero_count += 1
            reconstructed = np.zeros_like(dense)
            reconstructed[indices] = dense[indices]
            assert np.array_equal(dense, reconstructed)
            continue
    accessor['bufferView'] = copy_view(accessor['bufferView'])
for image in document['images']:
    image['bufferView'] = copy_view(image['bufferView'])
document['bufferViews'] = views
document['buffers'][0]['byteLength'] = len(payload)
encoded = json.dumps(document, ensure_ascii=False, separators=(',', ':')).encode()
encoded += b' ' * (-len(encoded) % 4)
payload.extend(b'\0' * (-len(payload) % 4))
result = (struct.pack('<III', 0x46546C67, 2, 28 + len(encoded) + len(payload))
          + struct.pack('<II', len(encoded), 0x4E4F534A) + encoded
          + struct.pack('<II', len(payload), 0x004E4942) + payload)
OUT.mkdir(parents=True, exist_ok=True)
(OUT / 'ene-packed.vrm').write_bytes(result)
report = {
    'sourceSha256': hashlib.sha256(source).hexdigest(),
    'candidateSha256': hashlib.sha256(result).hexdigest(),
    'sourceBytes': len(source), 'candidateBytes': len(result),
    'reductionPercent': 100 * (1 - len(result) / len(source)),
    'originalAccessors': len(original['accessors']), 'usedAccessors': len(used),
    'removedUnusedAccessors': len(original['accessors']) - len(used),
    'sparseMorphAccessors': sparse_count, 'zeroMorphAccessors': zero_count,
    'usedAccessorValuesEqual': True, 'imagesCopiedWithoutChanges': True,
    'limits': 'File size test. Sparse arrays expand at load time. No GPU memory reduction is established.',
}
(OUT / 'pack-probe.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8', newline='\n')
print(json.dumps(report))
