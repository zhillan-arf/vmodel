"""Import the original cyber-legs PMX without changing the supplied package."""
from pathlib import Path
import json
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from blender_bootstrap import ROOT, setup

def main():
    setup()
    import bpy
    from mathutils import Vector
    from mmd_tools import cycles_converter
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    source = ROOT / 'ops/resources/ENE/ENE Cyber legs ver.pmx'
    result = bpy.ops.mmd_tools.import_model(filepath=str(source), scale=0.08,
        types={'MESH','ARMATURE','PHYSICS','DISPLAY','MORPHS'}, rename_bones=False,
        clean_model=False, remove_doubles=False, log_level='WARNING')
    if 'FINISHED' not in result:
        raise RuntimeError(f'Import failed: {result}')
    armature = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
    meshes = [o for o in bpy.data.objects if o.type == 'MESH' and any(m.type=='ARMATURE' and m.object==armature for m in o.modifiers)]
    for obj in bpy.data.objects:
        if obj not in meshes and obj != armature:
            obj.hide_render = True
    repairs=[]
    for mat in bpy.data.materials:
        # Missing additive sphere maps contribute no light; disable their effect explicitly.
        if hasattr(mat,'mmd_material'):
            for node in mat.node_tree.nodes if mat.node_tree else []:
                if node.type == 'TEX_IMAGE' and node.image and node.image.source == 'FILE':
                    path=Path(bpy.path.abspath(node.image.filepath))
                    if not path.exists():
                        repairs.append(dict(material=mat.name,missing=path.name,action='Disable unavailable additive sphere map; retain diffuse texture'))
                        mat.mmd_material.sphere_texture_type='0'
                        node.image=None
    for obj in meshes:
        cycles_converter.convertToBlenderShader(obj,use_principled=True)
    bounds=[obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
    minimum=Vector([min(v[i] for v in bounds) for i in range(3)])
    maximum=Vector([max(v[i] for v in bounds) for i in range(3)])
    for image in bpy.data.images:
        if image.source=='FILE' and Path(bpy.path.abspath(image.filepath)).is_file():
            image.pack()
    report=dict(source=source.relative_to(ROOT).as_posix(),armature=armature.name,
        meshes=[dict(name=o.name,vertices=len(o.data.vertices),materials=len(o.data.materials),
                     shapeKeys=list(o.data.shape_keys.key_blocks.keys()) if o.data.shape_keys else []) for o in meshes],
        bounds=dict(min=list(minimum),max=list(maximum)),repairs=repairs,
        bones=[dict(name=b.name,parent=b.parent.name if b.parent else None,head=list(b.head_local),tail=list(b.tail_local)) for b in armature.data.bones])
    output=ROOT/'assets/work/ene'
    output.mkdir(parents=True,exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(output/'source.blend'))
    (ROOT/'ops/reports/ene-import.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    scene=bpy.context.scene
    scene.render.engine='BLENDER_EEVEE'
    scene.render.resolution_x=720;scene.render.resolution_y=900;scene.render.resolution_percentage=100
    scene.world.color=(0.16,0.16,0.16)
    scene.view_settings.view_transform='Standard'
    center=(minimum+maximum)*0.5
    height=maximum.z-minimum.z
    bpy.ops.object.camera_add(location=(center.x,-height*2.2,center.z))
    camera=bpy.context.object;camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type='ORTHO';camera.data.ortho_scale=height*1.12;scene.camera=camera
    for loc,power,size in [((2,-3,4),500,4),((-3,-2,2),250,3)]:
        bpy.ops.object.light_add(type='AREA',location=loc)
        light=bpy.context.object;light.data.energy=power;light.data.shape='DISK';light.data.size=size
        light.rotation_euler=(center-light.location).to_track_quat('-Z','Y').to_euler()
    preview=ROOT/'ops/reports/local/ene-import-front.png'
    preview.parent.mkdir(parents=True,exist_ok=True)
    scene.render.filepath=str(preview)
    bpy.ops.render.render(write_still=True)
    print('ENE_IMPORTED',output/'source.blend',flush=True)

if __name__=='__main__':
    main()
