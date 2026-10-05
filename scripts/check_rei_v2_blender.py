"""Reopen the Rei v2 source and check its controls and packed textures."""
from pathlib import Path
import hashlib
import json
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from blender_bootstrap import ROOT, setup


def main():
    import bpy
    setup()
    path = ROOT / 'assets/work/rei-v2/rei-v2.blend'
    bpy.ops.wm.open_mainfile(filepath=str(path))
    armature = next(obj for obj in bpy.data.objects if obj.type == 'ARMATURE')
    human = [{'name': bone.bone, 'node': bone.node.bone_name}
             for bone in armature.data.vrm_addon_extension.vrm0.humanoid.human_bones if bone.node.bone_name]
    if len(human) != 53 or len({bone['node'] for bone in human}) != 53:
        raise RuntimeError('Expected 53 different humanoid bone assignments.')
    if not all(bone['node'] in armature.data.bones for bone in human):
        raise RuntimeError('A humanoid bone is absent from the armature.')
    recipe = json.loads((ROOT / 'config/avatars/rei-v2.json').read_text(encoding='utf-8'))
    shapes = {key.name for obj in bpy.data.objects if obj.type == 'MESH' and obj.data.shape_keys
              for key in obj.data.shape_keys.key_blocks}
    if not all(name in shapes for name in recipe['expressions']):
        raise RuntimeError('An added facial shape is absent.')
    if not all(image.packed_file for image in bpy.data.images if image.has_data):
        raise RuntimeError('A texture is not packed in the Blender file.')
    build = json.loads(bpy.data.texts['build.json'].as_string())
    current = hashlib.sha256((ROOT / 'assets/avatars/rei-v2.vrm').read_bytes()).hexdigest()
    if current != build['outputSha256']:
        raise RuntimeError('The Blender source does not match the current VRM export.')
    report_path = ROOT / 'ops/001-zhil/sprint-002/reports/rei-v2-blender.json'
    report = json.loads(report_path.read_text(encoding='utf-8'))
    report.update(reopened=True, humanoidBones=human, sourceVrmSha256=current,
                  blendSha256=hashlib.sha256(path.read_bytes()).hexdigest(), addedShapesPresent=True)
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
    print('REI_BLEND_CHECK_PASSED', len(human), len(shapes))


if __name__ == '__main__':
    main()
