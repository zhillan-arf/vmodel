"""Prepare a VRM export scene from the preserved imported cyber-legs source."""
from pathlib import Path
import json
import sys
import unicodedata
sys.path.insert(0,str(Path(__file__).resolve().parent))
from blender_bootstrap import ROOT,setup

def write_export(bpy,arm,expression_names):
    from io_scene_vrm.editor.extension_accessor import get_armature_extension
    expressions=get_armature_extension(arm.data).vrm1.expressions
    expressions.initial_automatic_expression_assignment=False
    # Source migration can populate extra presets before our explicit assignments.
    # In particular, MMD eyebrow up/down must not become gaze controls.
    for name,expression in expressions.preset.name_to_expression_dict().items():
        if name not in expression_names:expression.morph_target_binds.clear()
    bpy.ops.object.select_all(action='DESELECT')
    arm.hide_set(False);arm.select_set(True)
    meshes=[o for o in bpy.data.objects if o.type=='MESH' and any(m.type=='ARMATURE' and m.object==arm for m in o.modifiers)]
    if not meshes:raise RuntimeError('Prepared scene has no skinned avatar mesh.')
    for mesh in meshes:mesh.hide_set(False);mesh.hide_render=False;mesh.select_set(True)
    bpy.context.view_layer.objects.active=arm
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/work/ene/vrm-work.blend'))
    output=ROOT/'assets/avatars/ene.vrm';output.parent.mkdir(parents=True,exist_ok=True)
    candidate=output.with_name('ene.candidate.vrm')
    # Save/load handlers may change active selection. Supply the intended objects
    # explicitly to the export operator, including when reopening a prepared scene.
    for obj in [arm,*meshes]:obj.select_set(True)
    bpy.context.view_layer.update()
    with bpy.context.temp_override(selected_objects=[arm,*meshes],active_object=arm,object=arm):
        result=bpy.ops.export_scene.vrm(filepath=str(candidate),armature_object_name=arm.name,
            export_only_selections=True,export_invisibles=False,use_addon_preferences=False)
    if 'FINISHED' not in result:raise RuntimeError(f'VRM export did not finish: {result}')
    data=candidate.read_bytes();gltf=json.loads(data[20:20+int.from_bytes(data[12:16],'little')])
    if not gltf.get('meshes') or not gltf.get('images'):raise RuntimeError('Export omitted avatar geometry or textures; previous VRM preserved.')
    candidate.replace(output)
    print('VRM_EXPORTED',output,output.stat().st_size,flush=True)

def main():
    setup()
    import bpy
    import numpy as np
    from io_scene_vrm.editor.extension_accessor import get_armature_extension,get_material_extension
    if '--prepared' in sys.argv:
        bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/work/ene/vrm-work.blend'))
        arm=next(o for o in bpy.data.objects if o.type=='ARMATURE')
        profile=json.loads((ROOT/'config/avatars/ene.json').read_text(encoding='utf-8'))
        write_export(bpy,arm,profile['expressions'])
        return
    bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/work/ene/source.blend'))
    arm=next(o for o in bpy.data.objects if o.type=='ARMATURE')
    meshes=[o for o in bpy.data.objects if o.type=='MESH' and any(m.type=='ARMATURE' and m.object==arm for m in o.modifiers)]
    lookup={unicodedata.normalize('NFKC',b.name):b.name for b in arm.data.bones}
    mapping={'hips':'腰','spine':'上半身','chest':'上半身2','neck':'首','head':'頭','leftEye':'左目','rightEye':'右目'}
    for side,jp in [('left','左'),('right','右')]:
        for english,name in [('Shoulder','肩'),('UpperArm','腕'),('LowerArm','ひじ'),('Hand','手首'),('UpperLeg','足'),('LowerLeg','ひざ'),('Foot','足首'),('Toes','つま先')]:
            mapping[side+english]=jp+name
        for finger,jname in [('Thumb','親指'),('Index','人指'),('Middle','中指'),('Ring','薬指'),('Little','小指')]:
            segments=['Metacarpal','Proximal','Distal'] if finger=='Thumb' else ['Proximal','Intermediate','Distal']
            for i,segment in enumerate(segments):mapping[side+finger+segment]=jp+jname+str(i if finger=='Thumb' else i+1)
    mapping={k:lookup[unicodedata.normalize('NFKC',v)] for k,v in mapping.items()}
    # Constraints drive MMD IK/additional transforms and cannot simply be serialized as VRM.
    # Keep the untouched source rig in source.blend; construct an FK export hierarchy here.
    removed=[]
    for bone in arm.pose.bones:
        for constraint in list(bone.constraints):
            removed.append(dict(bone=bone.name,type=constraint.type))
            bone.constraints.remove(constraint)
        bone.matrix_basis.identity()
    bpy.context.view_layer.objects.active=arm
    bpy.ops.object.mode_set(mode='EDIT')
    parents={'spine':'hips','chest':'spine','neck':'chest','head':'neck','leftEye':'head','rightEye':'head'}
    for side in ('left','right'):
        parents.update({side+'Shoulder':'chest',side+'UpperArm':side+'Shoulder',side+'LowerArm':side+'UpperArm',side+'Hand':side+'LowerArm',side+'UpperLeg':'hips',side+'LowerLeg':side+'UpperLeg',side+'Foot':side+'LowerLeg',side+'Toes':side+'Foot'})
        for finger in ('Thumb','Index','Middle','Ring','Little'):
            segments=['Metacarpal','Proximal','Distal'] if finger=='Thumb' else ['Proximal','Intermediate','Distal']
            for i,segment in enumerate(segments):parents[side+finger+segment]=side+'Hand' if i==0 else side+finger+segments[i-1]
    for child,parent in parents.items():
        bone=arm.data.edit_bones[mapping[child]];bone.use_connect=False;bone.parent=arm.data.edit_bones[mapping[parent]]
    # D deform bones must follow their FK counterpart after removal of MMD copy transforms.
    for jp in ('左','右'):
        for part in ('足','ひざ','足首'):
            alias=lookup.get(jp+part+'D')
            if alias:
                bone=arm.data.edit_bones[alias];bone.use_connect=False;bone.parent=arm.data.edit_bones[lookup[jp+part]]
    bpy.ops.object.mode_set(mode='OBJECT')
    ext=get_armature_extension(arm.data);ext.spec_version='1.0'
    vrm=ext.vrm1
    human=vrm.humanoid.human_bones
    human.initial_automatic_bone_assignment=False
    for key,bone in human.human_bone_name_to_human_bone().items():
        if key.value in mapping:bone.node.bone_name=mapping[key.value]
    meta=vrm.meta;meta.vrm_name='Ene — Cyber legs';meta.version='0.1.0'
    meta.authors.clear();meta.authors.add().value='yokkaulove (DA) / AuroraYok (user attribution)'
    meta.copyright_information='Original character: Kagerou Project. Preserve bundled Ene and contributor readmes.'
    meta.third_party_licenses='Local user-authorized conversion. Original model redistribution prohibited. See source package Readmes.'
    meta.avatar_permission='onlySeparatelyLicensedPerson';meta.allow_redistribution=False
    meta.modification='allowModification'
    expression_map={'blink':'まばたき','blinkLeft':'ウィンク左','blinkRight':'ウィンク右','aa':'あ','ih':'い','ou':'う','oh':'お','happy':'にこり','angry':'怒り','sad':'困る','surprised':'びっくり'}
    source_morphs=json.loads((ROOT/'ops/reports/asset-inventory.json').read_text(encoding='utf-8'))[0]['morphs']
    expression_bindings={name:dict(sourceName=shape,sourceIndex=next(m['index'] for m in source_morphs if m['name']==shape),range=[0,1]) for name,shape in expression_map.items()}
    presets=vrm.expressions.preset.name_to_expression_dict()
    # Preserve only the deliberate mappings below in both .blend and .vrm.
    # Otherwise export silently adds further presets after the .blend is saved.
    vrm.expressions.initial_automatic_expression_assignment=False
    for key,shape in expression_map.items():
        expression=presets[key]
        expression.morph_target_binds.clear()
        for mesh in meshes:
            if mesh.data.shape_keys and shape in mesh.data.shape_keys.key_blocks:
                bind=expression.morph_target_binds.add();bind.node.mesh_object_name=mesh.name;bind.index=shape;bind.weight=1
    materials=[];alpha_cache={}
    for mat in list(meshes[0].data.materials):
        source=mat.mmd_material
        image=next((n.image for n in mat.node_tree.nodes if n.type=='TEX_IMAGE' and n.image and n.name=='mmd_base_tex'),None)
        if image is None:
            image=next((n.image for n in mat.node_tree.nodes if n.type=='TEX_IMAGE' and n.image and 'base' in n.name.lower()),None)
        color=tuple(source.diffuse_color)+(source.alpha,)
        mtoon=get_material_extension(mat).mtoon1
        mtoon.enabled=True
        mtoon.pbr_metallic_roughness.base_color_factor=color
        if image:
            mtoon.pbr_metallic_roughness.base_color_texture.index.source=image
            mtoon.extensions.vrmc_materials_mtoon.shade_multiply_texture.index.source=image
        mtoon.extensions.vrmc_materials_mtoon.shade_color_factor=(0.72,0.75,0.80)
        mtoon.extensions.vrmc_materials_mtoon.shading_toony_factor=0.9
        mtoon.double_sided=source.is_double_sided
        alpha_min=1.0;fractional=0.0
        if image and image.channels==4:
            if image.name not in alpha_cache:
                pixels=np.empty(len(image.pixels),dtype=np.float32);image.pixels.foreach_get(pixels)
                alpha=pixels[3::4]
                alpha_cache[image.name]=(float(alpha.min()),float(np.mean((alpha>0.05)&(alpha<0.95))))
            alpha_min,fractional=alpha_cache[image.name]
        # Treat opaque RGBA textures as opaque. Sending every texture through BLEND
        # disables depth writes and lets the face incorrectly draw over the fringe.
        mtoon.alpha_mode='BLEND' if source.alpha<0.98 or fractional>0.08 else ('MASK' if alpha_min<0.99 else 'OPAQUE')
        mtoon.alpha_cutoff=0.35
        if mtoon.alpha_mode=='BLEND':mtoon.extensions.vrmc_materials_mtoon.transparent_with_z_write=True
        materials.append(dict(name=mat.name,texture=image.name if image else None,baseColor=color,alphaMode=mtoon.alpha_mode,alphaMin=alpha_min,fractionalAlphaRatio=fractional))
    # SDEF data keys are importer implementation details, not facial expressions.
    mesh_repairs=[]
    for mesh in meshes:
        if mesh.data.shape_keys:
            for name in ('mmd_sdef_c','mmd_sdef_r0','mmd_sdef_r1'):
                key=mesh.data.shape_keys.key_blocks.get(name)
                if key:mesh.shape_key_remove(key)
        # Source face 45706 repeats vertex 21535. Remove its degenerate face/edge
        # before saving the working scene; never alter the untouched imported source.
        before=dict(vertices=len(mesh.data.vertices),edges=len(mesh.data.edges),polygons=len(mesh.data.polygons))
        changed=mesh.data.validate(verbose=True)
        after=dict(vertices=len(mesh.data.vertices),edges=len(mesh.data.edges),polygons=len(mesh.data.polygons))
        if after['vertices']!=before['vertices']:raise RuntimeError('Mesh repair changed vertex indexing; inspect morphs before export.')
        mesh_repairs.append(dict(mesh=mesh.name,changed=changed,before=before,after=after))
    bpy.ops.object.select_all(action='DESELECT')
    arm.hide_set(False);arm.select_set(True)
    for mesh in meshes:mesh.hide_set(False);mesh.hide_render=False;mesh.select_set(True)
    bpy.context.view_layer.objects.active=arm
    bpy.context.view_layer.update()
    # The exporter otherwise performs this after the editable scene has been saved.
    # Generate from MMD rigid bodies explicitly so .blend and .vrm contain the same springs.
    result=bpy.ops.vrm.assign_spring_bone1_from_mmd(armature_object_name=arm.name)
    if 'FINISHED' not in result:raise RuntimeError(f'Spring conversion did not finish: {result}')
    for spring in ext.spring_bone1.springs:
        for joint in spring.joints:
            joint.stiffness=3.0
            joint.drag_force=0.8
    config=ROOT/'config/avatars';config.mkdir(parents=True,exist_ok=True)
    (config/'ene.json').write_text(json.dumps(dict(schemaVersion=1,variant='cyber-legs',sourceSha256='226fe9075f25c7dd2e6474fdd6acb77ff71c45900fb2d5c8794e08647aa9dbe4',humanoid=mapping,expressions=expression_map,expressionBindings=expression_bindings,missingOptionalExpressions=['ee'],expressionPolicy=dict(blink='Use blink OR independent blinkLeft/blinkRight; do not sum both.',vowels='Use one vowel at a time; live jaw drives aa.',manual='Manual happy/surprised applies a 0.75 minimum; neutral releases the override.',compatibility='Mapped MMD shapes; not a full ARKit 52-shape avatar.')),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (ROOT/'ops/reports/ene-export-preparation.json').write_text(json.dumps(dict(removedConstraints=removed,materials=materials,meshRepairs=mesh_repairs,restBasis={name:dict(head=list(arm.data.bones[bone].head_local),tail=list(arm.data.bones[bone].tail_local),matrix=[list(row) for row in arm.data.bones[bone].matrix_local]) for name,bone in mapping.items()},coordinates='Blender armature local: Z up; exported glTF/VRM: Y up. Runtime uses three-vrm normalized humanoid bones.'),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    write_export(bpy,arm,expression_map)

if __name__=='__main__':main()
