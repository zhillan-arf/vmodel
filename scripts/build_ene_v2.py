"""Create Ene v2 with separate expressions, material settings, and cuff clearance."""
from copy import deepcopy
import hashlib
from html import escape
import json
from pathlib import Path
import shutil
from urllib.parse import quote

import numpy as np

from vrm_asset import accessor, append_accessor, pack, read_vrm, write_vrm

ROOT = Path(__file__).resolve().parents[1]


def digest(data):
    return hashlib.sha256(data).hexdigest()


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')


def build(source, recipe):
    if recipe['version'] != 1 or digest(source) != recipe['sourceSha256']:
        raise ValueError('The recipe version or original Ene hash does not match.')
    document, binary = read_vrm(source)
    original = deepcopy(document)
    vrm = document['extensions']['VRMC_vrm']
    mesh = document['meshes'][0]
    names = mesh['extras']['targetNames']
    original_names = names[:]
    node = next(i for i, entry in enumerate(document['nodes']) if entry.get('mesh') == 0)
    changes = {'cuffs': [], 'materials': [], 'expressions': []}
    skin = document['skins'][document['nodes'][node]['skin']]
    matrices = accessor(document, binary, skin['inverseBindMatrices'])
    human = vrm['humanoid']['humanBones']

    def bone_point(name):
        index = skin['joints'].index(human[name]['node'])
        return np.linalg.inv(matrices[index].reshape(4, 4).T)[:3, 3]

    cuff_materials = {i for i, material in enumerate(document['materials']) if material['name'] in recipe['cuffs']['materials']}
    if len(cuff_materials) != len(recipe['cuffs']['materials']):
        raise ValueError('A cuff material is absent.')
    for side in ['left', 'right']:
        hand, elbow = bone_point(side + 'Hand'), bone_point(side + 'LowerArm')
        axis = (hand - elbow) / np.linalg.norm(hand - elbow)
        maximum = max(float(((accessor(document, binary, primitive['attributes']['POSITION']) - hand) @ axis)
                            [accessor(document, binary, primitive['attributes']['POSITION'])[:, 0] * hand[0] > 0].max())
                      for primitive in mesh['primitives'] if primitive['material'] in cuff_materials)
        start = -recipe['cuffs']['startBeforeWristMeters']
        end = -recipe['cuffs']['endBeforeWristMeters']
        displacement = maximum - end
        if maximum <= 0 or not 0 < displacement / (maximum - start) < 2 / 3:
            raise ValueError('The cuff correction would reverse or exceed the selected surface range.')
        for primitive in mesh['primitives']:
            if primitive['material'] not in cuff_materials:
                continue
            positions = accessor(document, binary, primitive['attributes']['POSITION'])
            distance = (positions - hand) @ axis
            selected = (positions[:, 0] * hand[0] > 0) & (distance > start)
            fraction = np.clip((distance - start) / (maximum - start), 0, 1)
            smooth = fraction ** 2 * (3 - 2 * fraction)
            delta = -smooth[:, None] * displacement * axis
            delta[~selected] = 0
            positions += delta
            primitive['attributes']['POSITION'] = append_accessor(document, binary, positions, target=34962)
            normal = accessor(document, binary, primitive['attributes']['NORMAL'])
            derivative = 1 - displacement / (maximum - start) * 6 * fraction * (1 - fraction)
            normal[selected] += ((1 / derivative[selected] - 1) * (normal[selected] @ axis))[:, None] * axis
            normal /= np.maximum(np.linalg.norm(normal, axis=1)[:, None], 1e-12)
            primitive['attributes']['NORMAL'] = append_accessor(document, binary, normal, target=34962)
            if 'TANGENT' in primitive['attributes']:
                tangent = accessor(document, binary, primitive['attributes']['TANGENT'])
                tangent[selected, :3] += ((derivative[selected] - 1) * (tangent[selected, :3] @ axis))[:, None] * axis
                tangent[:, :3] /= np.maximum(np.linalg.norm(tangent[:, :3], axis=1)[:, None], 1e-12)
                primitive['attributes']['TANGENT'] = append_accessor(document, binary, tangent, 'VEC4', target=34962)
            changes['cuffs'].append({'side': side, 'material': document['materials'][primitive['material']]['name'],
                                    'vertices': int(selected.sum()), 'maximumDisplacementMeters': float(np.linalg.norm(delta, axis=1).max()),
                                    'originalEndFromWristMeters': maximum, 'newEndFromWristMeters': end})

    def bind(targets, override=False):
        return {'isBinary': False, 'overrideBlink': 'blend' if override else 'none',
                'overrideMouth': 'blend' if override else 'none', 'overrideLookAt': 'none',
                'morphTargetBinds': [{'node': node, 'index': names.index(name), 'weight': weight} for name, weight in targets.items()]}

    def add_shape(name, generate):
        index = len(names)
        changed = 0
        for primitive in mesh['primitives']:
            positions = accessor(document, binary, primitive['attributes']['POSITION'])
            delta = np.asarray(generate(primitive, positions), dtype='<f4')
            if delta.shape != positions.shape or not np.all(np.isfinite(delta)):
                raise ValueError(f'Invalid authored shape: {name}')
            changed += int(np.count_nonzero(np.linalg.norm(delta, axis=1) > 1e-7))
            primitive['targets'].append({'POSITION': append_accessor(document, binary, delta)})
        if not changed:
            raise ValueError(f'The authored shape has no vertex changes: {name}')
        names.append(name)
        if 'weights' in mesh:
            mesh['weights'].append(0)
        if 'weights' in document['nodes'][node]:
            document['nodes'][node]['weights'].append(0)
        changes['expressions'].append({'name': name, 'index': index, 'changedPrimitiveVertices': changed})

    def source_delta(primitive, name):
        return accessor(document, binary, primitive['targets'][original_names.index(name)]['POSITION'])

    for name, definition in recipe['splitExpressions'].items():
        def split(primitive, positions):
            delta = source_delta(primitive, definition['source'])
            sign = 1 if definition['side'] == 'left' else -1
            delta[positions[:, 0] * sign < 0] = 0
            return delta
        add_shape(name, split)
    def make_ee(primitive, positions):
        delta = source_delta(primitive, 'あ') * recipe['ee']['aaWeight'] + source_delta(primitive, 'い') * recipe['ee']['ihWeight']
        delta[:, 0] *= recipe['ee']['widthGain']
        return delta
    add_shape('vmodelEe', make_ee)
    expressions = vrm['expressions']
    for name, target in recipe['customExpressions'].items():
        expressions['custom'][name] = bind({target: 1})
    for name in recipe['splitExpressions']:
        expressions['custom'][name] = bind({name: 1})
    expressions['preset']['ee'] = bind({'vmodelEe': 1})
    for name, targets in recipe['presets'].items():
        expressions['custom']['vmodelOriginal' + name.title()] = deepcopy(expressions['preset'][name])
        expressions['preset'][name] = bind(targets, override=True)
    vrm['lookAt']['type'] = 'bone'
    gaze = recipe['gazeDegrees']
    for key, maximum in [('rangeMapHorizontalInner', gaze['horizontalInner']), ('rangeMapHorizontalOuter', gaze['horizontalOuter']),
                         ('rangeMapVerticalDown', gaze['vertical']), ('rangeMapVerticalUp', gaze['vertical'])]:
        vrm['lookAt'][key] = {'inputMaxValue': 30, 'outputScale': maximum}
    vrm['meta']['name'] = recipe['name']; vrm['meta']['version'] = recipe['assetVersion']
    for group in recipe['materialGroups']:
        for name in group['materials']:
            material = next(entry for entry in document['materials'] if entry['name'] == name)
            toon = material['extensions']['VRMC_materials_mtoon']
            toon['shadeColorFactor'] = group['shade']; toon['shadingToonyFactor'] = .92; toon['shadingShiftFactor'] = -.04
            toon['outlineWidthMode'] = 'worldCoordinates' if group['outlineMeters'] else 'none'
            toon['outlineWidthFactor'] = group['outlineMeters']
            if group['outlineMeters']:
                toon['outlineColorFactor'] = group['outlineColor']; toon['outlineLightingMixFactor'] = .3
            changes['materials'].append({'name': name, 'outlineMeters': group['outlineMeters'], 'shade': group['shade']})
    document.setdefault('extras', {})['vmodelEneV2'] = {'sourceSha256': digest(source), 'sourceMeta': original['extensions']['VRMC_vrm']['meta'],
        'recipeSha256': digest(json.dumps(recipe, sort_keys=True).encode()), 'status': 'candidate'}
    for key in ['skins', 'images', 'textures']:
        if document[key] != original[key]:
            raise ValueError(f'Protected data changed: {key}')
    if vrm['humanoid'] != original['extensions']['VRMC_vrm']['humanoid'] or document['extensions']['VRMC_springBone'] != original['extensions']['VRMC_springBone']:
        raise ValueError('Humanoid assignments, springs, or colliders changed.')
    for before, after in zip(original['materials'], document['materials'], strict=True):
        for key in ['alphaMode', 'alphaCutoff', 'doubleSided', 'pbrMetallicRoughness']:
            if before.get(key) != after.get(key):
                raise ValueError(f'Protected material data changed: {key}')
    for before, after in zip(original['meshes'][0]['primitives'], mesh['primitives'], strict=True):
        if before['targets'] != after['targets'][:len(original_names)] or before['indices'] != after['indices']:
            raise ValueError('Original expressions or topology changed.')
        for name in ['JOINTS_0', 'WEIGHTS_0', 'TEXCOORD_0']:
            if before['attributes'].get(name) != after['attributes'].get(name):
                raise ValueError('Skin weights or texture coordinates changed.')
    document, binary, packing = pack(document, binary)
    return write_vrm(document, binary), document, changes, packing


def main():
    recipe_path = ROOT / 'config/avatars/ene-v2.json'
    recipe = json.loads(recipe_path.read_text(encoding='utf-8'))
    source_path = ROOT / 'assets/avatars/ene.vrm'
    source = source_path.read_bytes()
    result, document, changes, packing = build(source, recipe)
    if result != build(source, recipe)[0]:
        raise ValueError('Repeated builds produced different bytes.')
    work = ROOT / 'assets/work/ene-v2'; work.mkdir(parents=True, exist_ok=True)
    (work / 'source.vrm').write_bytes(source)
    write_json(work / 'recipe.json', recipe); write_json(work / 'document.json', document)
    (work / 'model.bin').write_bytes(read_vrm(result)[1])
    for target in [ROOT / 'assets/avatars/ene-v2.vrm', ROOT / 'public/avatars/ene-v2.vrm']:
        target.write_bytes(result)
    notices = ROOT / 'public/avatars/ene-v2-notices'; notices.mkdir(parents=True, exist_ok=True)
    terms_root = ROOT / 'ops/001-zhil/sprint-002/research/ene-v2-local/source/ENE'
    term_files = list(terms_root.rglob('*.txt'))
    if not term_files:
        raise ValueError('The Ene source terms are absent.')
    terms = {}
    for source_term in term_files:
        target = notices / source_term.relative_to(terms_root)
        target.parent.mkdir(parents=True, exist_ok=True); shutil.copyfile(source_term, target)
        terms[target.relative_to(notices).as_posix()] = digest(target.read_bytes())
    links = ''.join(f'<li><a href="{quote(name)}" download>{escape(name)}</a></li>' for name in sorted(terms))
    (notices / 'index.html').write_text(
        '<!doctype html><html lang="en"><meta charset="utf-8"><title>Ene source terms</title>'
        '<h1>Ene source terms</h1><p>The source files retain their original bytes and text encoding.</p>'
        '<p>The original asset terms still apply to Ene v2.</p><ul>' + links + '</ul>'
        '<p><a href="provenance.json">Build record and source hashes</a></p></html>\n', encoding='utf-8', newline='\n')
    report = {'sourceSha256': digest(source), 'outputSha256': digest(result), 'sourceBytes': len(source), 'bytes': len(result),
        'sourceUnchanged': source_path.read_bytes() == source and (ROOT / 'public/avatars/ene.vrm').read_bytes() == source,
        'repeatBuildEqual': True, 'packing': packing, 'changes': changes, 'termsSha256': terms,
        'originalMorphTargetsPreserved': True, 'skinWeightsAndTextureCoordinatesUnchanged': True,
        'alphaModesAndTexturesUnchanged': True, 'humanoidSpringsAndCollidersUnchanged': True,
        'recipe': 'config/avatars/ene-v2.json', 'assetVersion': recipe['assetVersion'],
        'limits': ['Local appearance candidate.', 'Physical and appearance acceptance remain open.', 'Source terms still apply.']}
    if not report['sourceUnchanged']:
        raise ValueError('The original Ene file or its public copy changed.')
    for target in [work / 'build.json', notices / 'provenance.json', ROOT / 'ops/001-zhil/sprint-002/reports/ene-v2-build.json']:
        write_json(target, report)
    print(json.dumps({key: report[key] for key in ['outputSha256', 'sourceBytes', 'bytes', 'sourceUnchanged', 'repeatBuildEqual']}))


if __name__ == '__main__':
    main()
