"""Save an editable Blender copy of the separate Rei v2 export."""
from pathlib import Path
import json
import hashlib
import os
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from blender_bootstrap import ROOT, setup


def main():
    import bpy
    bpy.ops.wm.read_factory_settings(use_empty=True)
    setup()
    work = ROOT / 'assets/work/rei-v2'
    build = json.loads((work / 'build.json').read_text(encoding='utf-8'))
    source = (work / 'source.vrm').read_bytes()
    terms = (ROOT / 'public/avatars/rei-v2-notices/readme.txt').read_bytes()
    if hashlib.sha256(source).hexdigest() != '07037243141d9c3f260c6ef09419f1225ca64ffb7791204b4aef0b817ebc1735':
        raise RuntimeError('The source hash does not match the reviewed model.')
    if hashlib.sha256(terms).hexdigest() != build['termsSha256']['readme.txt'] or '改造・再配布・他形式への変換は可能です。' not in terms.decode('cp932'):
        raise RuntimeError('The source terms do not match the reviewed readme.')
    # The supplied readme permits changes. Accept the notice for this source only.
    key = 'BLENDER_VRM_AUTOMATIC_LICENSE_CONFIRMATION'
    previous = os.environ.get(key)
    os.environ[key] = 'true'
    try:
        result = bpy.ops.import_scene.vrm(filepath=str(ROOT / 'assets/avatars/rei-v2.vrm'))
    finally:
        if previous is None:
            os.environ.pop(key, None)
        else:
            os.environ[key] = previous
    if 'FINISHED' not in result:
        raise RuntimeError(f'VRM import failed: {result}')
    for image in bpy.data.images:
        if image.has_data and not image.packed_file:
            image.pack()
    for name in ['recipe.json', 'build.json']:
        text = bpy.data.texts.new(name)
        text.write((work / name).read_text(encoding='utf-8'))
    scene = bpy.context.scene
    scene['vmodel_source'] = 'assets/work/rei-v2/source.vrm'
    scene['vmodel_recipe'] = 'config/avatars/rei-v2.json'
    scene['vmodel_export'] = 'python scripts/build_rei_v2.py'
    bpy.ops.wm.save_as_mainfile(filepath=str(work / 'rei-v2.blend'))
    report = {
        'blender': bpy.app.version_string,
        'file': 'assets/work/rei-v2/rei-v2.blend',
        'armatures': [{'name': obj.name, 'bones': len(obj.data.bones)} for obj in bpy.data.objects if obj.type == 'ARMATURE'],
        'meshes': [{'name': obj.name, 'vertices': len(obj.data.vertices),
                    'shapeKeys': len(obj.data.shape_keys.key_blocks) if obj.data.shape_keys else 0}
                   for obj in bpy.data.objects if obj.type == 'MESH'],
        'images': len(bpy.data.images),
        'packedImages': sum(bool(image.packed_file) for image in bpy.data.images),
        'limits': 'The recipe builds the tested VRM. Blender edits require a separate export and verification.',
    }
    (ROOT / 'ops/001-zhil/sprint-002/reports/rei-v2-blender.json').write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
    print('REI_V2_SOURCE_READY', json.dumps(report, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main()
