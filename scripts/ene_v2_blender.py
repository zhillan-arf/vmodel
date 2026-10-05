"""Save Ene v2 source work and test bone gaze in the Blender VRM viewer."""
from pathlib import Path
import hashlib
import json
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from blender_bootstrap import ROOT, setup


def main():
    import bpy
    from mathutils import Vector
    bpy.ops.wm.read_factory_settings(use_empty=True)
    setup()
    from io_scene_vrm.editor.extension_accessor import get_armature_extension
    work = ROOT / 'assets/work/ene-v2'
    build = json.loads((work / 'build.json').read_text(encoding='utf-8'))
    source = ROOT / 'assets/avatars/ene-v2.vrm'
    if hashlib.sha256(source.read_bytes()).hexdigest() != build['outputSha256']:
        raise RuntimeError('The VRM does not match its build record.')
    result = bpy.ops.import_scene.vrm(filepath=str(source))
    if 'FINISHED' not in result:
        raise RuntimeError(f'VRM import failed: {result}')
    armature = next(obj for obj in bpy.data.objects if obj.type == 'ARMATURE')
    vrm = get_armature_extension(armature.data).vrm1
    human = {name.value: bone.node.bone_name for name, bone in vrm.humanoid.human_bones.human_bone_name_to_human_bone().items() if bone.node.bone_name}
    if len(human) != 53 or len(set(human.values())) != 53:
        raise RuntimeError('Expected 53 different humanoid bone assignments.')
    shapes = {key.name for obj in bpy.data.objects if obj.type == 'MESH' and obj.data.shape_keys for key in obj.data.shape_keys.key_blocks[1:]}
    if len(shapes) != 52 or 'vmodelEe' not in shapes:
        raise RuntimeError('The imported facial shapes do not match the export.')
    for image in bpy.data.images:
        if image.has_data and not image.packed_file:
            image.pack()
    for name in ['recipe.json', 'build.json']:
        text = bpy.data.texts.new(name); text.write((work / name).read_text(encoding='utf-8'))
    if vrm.look_at.type != 'bone':
        raise RuntimeError('The viewer does not use bone gaze.')
    target = bpy.data.objects.new('VModel gaze target', None); bpy.context.scene.collection.objects.link(target)
    target.hide_render = True
    vrm.look_at.preview_target_bpy_object = target; vrm.look_at.enable_preview = True
    head = armature.matrix_world @ armature.pose.bones[human['head']].head
    eyes = [armature.pose.bones[human[name]] for name in ['leftEye', 'rightEye']]
    gaze = []
    for direction, offset in [('left', (.5, -1, 0)), ('right', (-.5, -1, 0)), ('up', (0, -1, .4)), ('down', (0, -1, -.4))]:
        for eye in eyes:
            eye.matrix_basis.identity()
        target.location = head + Vector(offset); bpy.context.view_layer.update()
        vrm.look_at.update_preview(bpy.context, armature, vrm, check_only=False); bpy.context.view_layer.update()
        angles = [eye.matrix_basis.to_quaternion().angle for eye in eyes]
        if not all(.01 < angle < .4 for angle in angles):
            raise RuntimeError(f'The eye response is absent or outside the selected limit: {direction}: {angles}')
        gaze.append({'direction': direction, 'anglesRadians': angles, 'quaternions': [list(eye.matrix_basis.to_quaternion()) for eye in eyes]})
    vrm.look_at.enable_preview = False; vrm.look_at.preview_target_bpy_object = None
    bpy.data.objects.remove(target, do_unlink=True)
    for eye in eyes:
        eye.matrix_basis.identity()
    bpy.ops.wm.save_as_mainfile(filepath=str(work / 'ene-v2.blend'))
    bpy.ops.wm.open_mainfile(filepath=str(work / 'ene-v2.blend'))
    armature = next(obj for obj in bpy.data.objects if obj.type == 'ARMATURE')
    reopened = get_armature_extension(armature.data).vrm1
    mapped = [bone.node.bone_name for bone in reopened.humanoid.human_bones.human_bone_name_to_human_bone().values() if bone.node.bone_name]
    reopened_shapes = {key.name for obj in bpy.data.objects if obj.type == 'MESH' and obj.data.shape_keys
                       for key in obj.data.shape_keys.key_blocks[1:]}
    if len(mapped) != 53 or set(mapped) != set(human.values()) or not all(name in armature.data.bones for name in mapped):
        raise RuntimeError('The saved source lost a humanoid bone assignment.')
    if reopened_shapes != shapes or not all(image.packed_file for image in bpy.data.images if image.has_data):
        raise RuntimeError('The saved source lost a face shape or packed image.')
    if json.loads(bpy.data.texts['build.json'].as_string()) != build:
        raise RuntimeError('The saved source has a different build record.')
    if json.loads(bpy.data.texts['recipe.json'].as_string()) != json.loads((work / 'recipe.json').read_text(encoding='utf-8')):
        raise RuntimeError('The saved source has a different recipe.')
    report = {'blender': bpy.app.version_string, 'sourceVrmSha256': build['outputSha256'],
              'file': 'assets/work/ene-v2/ene-v2.blend', 'blendSha256': hashlib.sha256((work / 'ene-v2.blend').read_bytes()).hexdigest(),
              'reopened': True, 'humanoidBones': human, 'shapes': sorted(shapes), 'packedImages': sum(bool(image.packed_file) for image in bpy.data.images),
              'gazeType': reopened.look_at.type, 'secondViewerGaze': gaze,
              'limits': 'Blender VRM viewer controls and source check. No physical camera test.'}
    (ROOT / 'ops/001-zhil/sprint-002/reports/ene-v2-blender.json').write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
    print('ENE_V2_SOURCE_READY', json.dumps({'humanoidBones': len(human), 'shapes': len(shapes), 'gazeDirections': len(gaze)}), flush=True)


if __name__ == '__main__':
    main()
