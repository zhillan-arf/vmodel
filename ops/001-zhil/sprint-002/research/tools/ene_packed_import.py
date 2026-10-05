"""Check the research VRM in Blender without a scene save."""
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[5]
sys.path.insert(0, str(ROOT / 'scripts'))
from blender_bootstrap import setup

setup()
import bpy
from io_scene_vrm.editor.extension_accessor import get_armature_extension

output = ROOT / 'ops/001-zhil/sprint-002/research/ene-v2-local'
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
result = bpy.ops.import_scene.vrm(filepath=str(output / 'ene-packed.vrm'))
assert 'FINISHED' in result
armature = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
vrm = get_armature_extension(armature.data).vrm1
mapped = {name.value: bone.node.bone_name for name, bone in vrm.humanoid.human_bones.human_bone_name_to_human_bone().items() if bone.node.bone_name}
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
shapes = sorted({key.name for mesh in meshes if mesh.data.shape_keys for key in mesh.data.shape_keys.key_blocks[1:]})
assert len(mapped) == 53
assert len(shapes) == 45
report = {'blender': bpy.app.version_string, 'importFinished': True,
          'mappedHumanoidBones': len(mapped), 'shapeNames': shapes, 'meshCount': len(meshes),
          'limits': 'Import structure check. No Blender render or new export.'}
(output / 'packed-import.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
print('ENE_PACKED_IMPORT', json.dumps(report, ensure_ascii=False))
