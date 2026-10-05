"""Create a separate Rei v2 from the original VRM and an editable recipe."""
import argparse
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import shutil
import struct

ROOT = Path(__file__).resolve().parents[1]


def digest(data):
    return hashlib.sha256(data).hexdigest()


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')


def read_glb(data):
    if len(data) < 28 or struct.unpack_from('<4sII', data) != (b'glTF', 2, len(data)):
        raise ValueError('Invalid binary glTF header.')
    length, kind = struct.unpack_from('<I4s', data, 12)
    if kind != b'JSON' or length % 4:
        raise ValueError('Invalid JSON chunk.')
    document = json.loads(data[20:20 + length])
    tail = data[20 + length:]
    if len(tail) < 8 or struct.unpack_from('<I4s', tail) != (len(tail) - 8, b'BIN\x00'):
        raise ValueError('Expected one binary chunk.')
    return document, tail


def write_glb(document, tail):
    data = json.dumps(document, ensure_ascii=False, separators=(',', ':'), allow_nan=False).encode('utf-8')
    data += b' ' * (-len(data) % 4)
    return struct.pack('<4sIII4s', b'glTF', 2, 20 + len(data) + len(tail), len(data), b'JSON') + data + tail


def build(source, recipe):
    if digest(source) != recipe['sourceSha256'] or recipe['version'] != 1:
        raise ValueError('The source hash or recipe version does not match.')
    original, tail = read_glb(source)
    document = deepcopy(original)
    vrm = document['extensions']['VRM']
    materials = {entry['name']: entry for entry in vrm['materialProperties']}
    changes = []
    for index, root in recipe.get('skeletonRoots', {}).items():
        skin = document['skins'][int(index)]
        changes.append({'skin': int(index), 'oldSkeleton': skin.get('skeleton'), 'skeleton': root})
        skin['skeleton'] = root
    if recipe.get('removeLegacyExtensionUsed'):
        document.pop('extensionUsed', None)
        changes.append({'removedProperty': 'extensionUsed'})
    for group in recipe['outlines']:
        for name in group['materials']:
            material = materials[name]
            material['floatProperties'].update(_OutlineWidthMode=1, _OutlineWidth=group['width'], _OutlineColorMode=0)
            material['vectorProperties']['_OutlineColor'] = group['color']
            changes.append({'material': name, 'outlineWidthMeters': group['width'] * 0.01, 'outlineColor': group['color']})
    for entry in recipe['colors']:
        materials[entry['material']]['vectorProperties'][entry['property']] = entry['value']
        changes.append(entry)
    groups = vrm['blendShapeMaster']['blendShapeGroups']
    for name, target in recipe['expressions'].items():
        matches = [(mesh_index, mesh.get('extras', {}).get('targetNames', []).index(target))
                   for mesh_index, mesh in enumerate(document['meshes'])
                   if target in mesh.get('extras', {}).get('targetNames', [])]
        if len(matches) != 1 or any(group['name'] == name for group in groups):
            raise ValueError(f'Expression target is absent or ambiguous: {name}')
        mesh_index, target_index = matches[0]
        if recipe.get('addedExpressionsUsePositionOnly'):
            mesh = document['meshes'][mesh_index]
            new_index = len(mesh['extras']['targetNames'])
            for primitive in mesh['primitives']:
                primitive['targets'].append({'POSITION': primitive['targets'][target_index]['POSITION']})
            mesh['extras']['targetNames'].append(name)
            if 'weights' in mesh:
                mesh['weights'].append(0)
            for node in document['nodes']:
                if node.get('mesh') == mesh_index and 'weights' in node:
                    node['weights'].append(0)
            changes.append({'expression': name, 'sourceTarget': target_index, 'target': new_index, 'normalDeltas': 'none'})
            target_index = new_index
        groups.append({'name': name, 'presetName': 'unknown', 'isBinary': False, 'materialValues': [],
                       'binds': [{'mesh': mesh_index, 'index': target_index, 'weight': 100}]})
    vrm['meta']['title'] = recipe['title']
    vrm['meta']['version'] = recipe['assetVersion']
    document.setdefault('extras', {})['vmodelReiV2'] = {
        'sourceSha256': digest(source), 'recipeSha256': digest(json.dumps(recipe, sort_keys=True).encode()),
        'status': 'candidate', 'sourceMeta': original['extensions']['VRM']['meta'],
    }
    result = write_glb(document, tail)
    check, check_tail = read_glb(result)
    for key in ['accessors', 'bufferViews', 'buffers', 'images', 'textures', 'materials']:
        if check.get(key) != original.get(key):
            raise ValueError(f'Protected model data changed: {key}')
    restored_meshes = deepcopy(check['meshes'])
    restored_nodes = deepcopy(check['nodes'])
    for before, after in zip(original['meshes'], restored_meshes, strict=True):
        count = len(before.get('extras', {}).get('targetNames', []))
        for primitive in after['primitives']:
            if 'targets' in primitive:
                primitive['targets'] = primitive['targets'][:count]
        if count:
            after['extras']['targetNames'] = after['extras']['targetNames'][:count]
        if 'weights' in after:
            after['weights'] = after['weights'][:len(before['weights'])]
    for before, after in zip(original['nodes'], restored_nodes, strict=True):
        if 'weights' in after:
            after['weights'] = after['weights'][:len(before['weights'])]
    if restored_meshes != original['meshes'] or restored_nodes != original['nodes']:
        raise ValueError('Original mesh data or node data changed.')
    for before, after in zip(original['skins'], check['skins'], strict=True):
        if {k: v for k, v in before.items() if k != 'skeleton'} != {k: v for k, v in after.items() if k != 'skeleton'}:
            raise ValueError('Skin joints or inverse bind matrices changed.')
    for key in ['humanoid', 'firstPerson', 'secondaryAnimation']:
        if check['extensions']['VRM'][key] != original['extensions']['VRM'][key]:
            raise ValueError(f'Protected VRM data changed: {key}')
    if tail != check_tail or groups[:len(original['extensions']['VRM']['blendShapeMaster']['blendShapeGroups'])] != original['extensions']['VRM']['blendShapeMaster']['blendShapeGroups']:
        raise ValueError('Original binary data or expression groups changed.')
    return result, document, changes


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=ROOT / 'assets/avatars/rei.vrm')
    parser.add_argument('--recipe', type=Path, default=ROOT / 'config/avatars/rei-v2.json')
    args = parser.parse_args()
    source = args.source.read_bytes()
    recipe = json.loads(args.recipe.read_text(encoding='utf-8'))
    result, document, changes = build(source, recipe)
    if result != build(source, recipe)[0]:
        raise ValueError('Repeated builds produced different bytes.')
    work = ROOT / 'assets/work/rei-v2'
    work.mkdir(parents=True, exist_ok=True)
    write_json(work / 'recipe.json', recipe)
    write_json(work / 'document.json', document)
    (work / 'model.bin').write_bytes(read_glb(result)[1][8:])
    shutil.copyfile(args.source, work / 'source.vrm')
    for target in [ROOT / 'assets/avatars/rei-v2.vrm', ROOT / 'public/avatars/rei-v2.vrm']:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(result)
    notices = ROOT / 'public/avatars/rei-v2-notices'
    notices.mkdir(parents=True, exist_ok=True)
    terms = {}
    for name in ['readme.txt', 'log.txt', 'provenance.json']:
        original = ROOT / 'public/avatars/rei-notices' / name
        copied = notices / ('source-provenance.json' if name == 'provenance.json' else name)
        shutil.copyfile(original, copied)
        terms[copied.name] = digest(copied.read_bytes())
    if args.source.read_bytes() != source or (ROOT / 'public/avatars/rei.vrm').read_bytes() != source:
        raise ValueError('The original asset or public copy changed.')
    report = {
        'sourceSha256': digest(source), 'outputSha256': digest(result), 'bytes': len(result),
        'recipe': 'config/avatars/rei-v2.json', 'assetVersion': recipe['assetVersion'],
        'sourceUnchanged': True, 'binaryChunkUnchanged': True, 'repeatBuildEqual': True,
        'geometryAndSkinWeightsUnchanged': True, 'springsAndCollidersUnchanged': True,
        'originalExpressionGroupsPreserved': True, 'addedExpressions': recipe['expressions'],
        'changes': changes, 'termsSha256': terms,
        'sourceMeta': json.loads((ROOT / 'public/avatars/rei-notices/provenance.json').read_text())['metadata'],
        'limits': ['Local appearance candidate.', 'Source terms still apply.', 'Physical and appearance acceptance remain open.'],
    }
    write_json(notices / 'provenance.json', report)
    write_json(work / 'build.json', report)
    write_json(ROOT / 'ops/001-zhil/sprint-002/reports/rei-v2-build.json', report)
    print(json.dumps({key: report[key] for key in ['outputSha256', 'bytes', 'sourceUnchanged', 'repeatBuildEqual']}))


if __name__ == '__main__':
    main()
