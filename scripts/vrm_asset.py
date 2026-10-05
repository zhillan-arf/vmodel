"""Read, write, and pack the local VRM assets with NumPy."""
from copy import deepcopy
import json
import struct

import numpy as np

DTYPES = {5120: '<i1', 5121: '<u1', 5122: '<i2', 5123: '<u2', 5125: '<u4', 5126: '<f4'}
WIDTHS = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


def read_vrm(data):
    if struct.unpack_from('<4sII', data) != (b'glTF', 2, len(data)):
        raise ValueError('Invalid binary glTF header.')
    length, kind = struct.unpack_from('<I4s', data, 12)
    if kind != b'JSON':
        raise ValueError('Expected a JSON chunk.')
    document = json.loads(data[20:20 + length])
    size, kind = struct.unpack_from('<I4s', data, 20 + length)
    if kind != b'BIN\x00' or 28 + length + size != len(data):
        raise ValueError('Expected one binary chunk.')
    return document, bytearray(data[28 + length:])


def write_vrm(document, binary):
    encoded = json.dumps(document, ensure_ascii=False, separators=(',', ':'), allow_nan=False).encode('utf-8')
    encoded += b' ' * (-len(encoded) % 4)
    payload = bytes(binary) + b'\0' * (-len(binary) % 4)
    return (struct.pack('<4sII', b'glTF', 2, 28 + len(encoded) + len(payload))
            + struct.pack('<I4s', len(encoded), b'JSON') + encoded
            + struct.pack('<I4s', len(payload), b'BIN\x00') + payload)


def view_bytes(document, binary, index):
    view = document['bufferViews'][index]
    start = view.get('byteOffset', 0)
    return bytes(binary[start:start + view['byteLength']])


def accessor(document, binary, index):
    entry = document['accessors'][index]
    dtype, width = np.dtype(DTYPES[entry['componentType']]), WIDTHS[entry['type']]
    result = np.zeros((entry['count'], width), dtype=dtype)
    if 'bufferView' in entry:
        view = document['bufferViews'][entry['bufferView']]
        raw = view_bytes(document, binary, entry['bufferView'])
        offset = entry.get('byteOffset', 0)
        stride = view.get('byteStride', width * dtype.itemsize)
        result[:] = np.ndarray(result.shape, dtype=dtype, buffer=raw, offset=offset, strides=(stride, dtype.itemsize))
    if 'sparse' in entry:
        sparse = entry['sparse']
        indices = sparse['indices']; values = sparse['values']
        selection = np.frombuffer(view_bytes(document, binary, indices['bufferView']),
                                  dtype=DTYPES[indices['componentType']], count=sparse['count'], offset=indices.get('byteOffset', 0))
        result[selection] = np.frombuffer(view_bytes(document, binary, values['bufferView']), dtype=dtype,
                                          count=sparse['count'] * width, offset=values.get('byteOffset', 0)).reshape(-1, width)
    return result


def append_accessor(document, binary, values, kind='VEC3', component=5126, target=None):
    array = np.asarray(values, dtype=DTYPES[component]).reshape(-1, WIDTHS[kind])
    binary.extend(b'\0' * (-len(binary) % 4))
    view = {'buffer': 0, 'byteOffset': len(binary), 'byteLength': array.nbytes}
    if target is not None:
        view['target'] = target
    document['bufferViews'].append(view); binary.extend(array.tobytes())
    entry = {'bufferView': len(document['bufferViews']) - 1, 'componentType': component, 'count': len(array), 'type': kind}
    if kind == 'VEC3':
        entry.update(min=array.min(axis=0).tolist(), max=array.max(axis=0).tolist())
    document['accessors'].append(entry)
    document['buffers'][0]['byteLength'] = len(binary)
    return len(document['accessors']) - 1


def references(document):
    result, morphs = [], set()
    for mesh in document['meshes']:
        for primitive in mesh['primitives']:
            if 'indices' in primitive:
                result.append((primitive, 'indices'))
            result.extend((primitive['attributes'], name) for name in primitive['attributes'])
            for target in primitive.get('targets', []):
                result.extend((target, name) for name in target)
                morphs.update(target.values())
    for skin in document['skins']:
        if 'inverseBindMatrices' in skin:
            result.append((skin, 'inverseBindMatrices'))
    return result, morphs


def pack(document, binary):
    if document.get('animations') or any('byteStride' in view for view in document['bufferViews']):
        raise ValueError('This packer requires a local asset without animations or interleaved buffers.')
    if set(document['extensions']) != {'VRMC_vrm', 'VRMC_springBone'}:
        raise ValueError('The extension set does not match the Ene source.')
    original = document
    result = deepcopy(document)
    refs, morphs = references(result)
    used = sorted({container[key] for container, key in refs})
    mapping = {old: new for new, old in enumerate(used)}
    for container, key in refs:
        container[key] = mapping[container[key]]
    result['accessors'] = [deepcopy(original['accessors'][index]) for index in used]
    payload, views, copied = bytearray(), [], {}

    def add(raw, target=None):
        payload.extend(b'\0' * (-len(payload) % 4))
        view = {'buffer': 0, 'byteOffset': len(payload), 'byteLength': len(raw)}
        if target is not None:
            view['target'] = target
        views.append(view); payload.extend(raw)
        return len(views) - 1

    def copy_view(index):
        if index not in copied:
            copied[index] = add(view_bytes(original, binary, index), original['bufferViews'][index].get('target'))
        return copied[index]

    sparse_count = zero_count = 0
    for old, entry in zip(used, result['accessors'], strict=True):
        dense = accessor(original, binary, old)
        if old in morphs and entry['componentType'] == 5126 and entry['type'] == 'VEC3':
            selection = np.flatnonzero(np.any(dense != 0, axis=1))
            index_type = '<u2' if len(dense) <= 65536 else '<u4'
            index_size = np.dtype(index_type).itemsize
            if len(selection) * (12 + index_size) < dense.nbytes:
                for key in ['bufferView', 'byteOffset', 'sparse']:
                    entry.pop(key, None)
                if len(selection):
                    entry['sparse'] = {'count': len(selection),
                        'indices': {'bufferView': add(selection.astype(index_type).tobytes()), 'componentType': 5123 if index_size == 2 else 5125},
                        'values': {'bufferView': add(dense[selection].tobytes())}}
                    sparse_count += 1
                else:
                    zero_count += 1
                continue
        if 'sparse' in entry:
            raise ValueError('An input sparse array could not use the selected packing path.')
        entry['bufferView'] = copy_view(entry['bufferView'])
    for image in result['images']:
        image['bufferView'] = copy_view(image['bufferView'])
    result['bufferViews'] = views
    result['buffers'][0]['byteLength'] = len(payload)
    for old, new in mapping.items():
        if not np.array_equal(accessor(original, binary, old), accessor(result, payload, new)):
            raise ValueError(f'Packing changed accessor values: {old}')
    for before, after in zip(original['images'], result['images'], strict=True):
        if view_bytes(original, binary, before['bufferView']) != view_bytes(result, payload, after['bufferView']):
            raise ValueError('Packing changed texture bytes.')
    report = {'usedAccessorValuesEqual': True, 'imagesCopiedWithoutChanges': True,
              'removedUnusedAccessors': len(original['accessors']) - len(used),
              'sparseMorphAccessors': sparse_count, 'zeroMorphAccessors': zero_count}
    return result, payload, report
