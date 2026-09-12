"""Bounds-check with MMD Tools, then import VMD into a separate source-scene copy."""
from pathlib import Path
import io,json,math,sys,hashlib
sys.path.insert(0,str(Path(__file__).resolve().parent))
from blender_bootstrap import ROOT,setup
setup()
import bpy
from mathutils import Vector
from mmd_tools.core import vmd

source=ROOT/'ops/resources/ene.vmd';data=source.read_bytes()
class CheckedReader(io.BytesIO):
    def read(self,n=-1):
        result=super().read(n)
        if n>=0 and len(result)!=n:raise EOFError(f'VMD truncated at byte {self.tell()}: expected {n}, read {len(result)}')
        return result

reader=CheckedReader(data);header=vmd.Header();header.load(reader)
sections={};animations={}
for name,kind in [('bone',vmd.BoneAnimation),('morph',vmd.ShapeKeyAnimation),('camera',vmd.CameraAnimation),('light',vmd.LightAnimation),('shadow',vmd.SelfShadowAnimation),('ik',vmd.PropertyAnimation)]:
    animation=kind();start=reader.tell();animation.load(reader);animations[name]=animation
    keys=[key for channel in animation.values() for key in channel] if isinstance(animation,dict) else list(animation)
    sections[name]=dict(keys=len(keys),startByte=start,endByte=reader.tell(),minFrame=min((k.frame_number for k in keys),default=None),maxFrame=max((k.frame_number for k in keys),default=None))
if reader.tell()!=len(data):raise ValueError(f'{len(data)-reader.tell()} trailing VMD bytes')
numeric_issues=[]
for name,keys in animations['bone'].items():
    for key in keys:
        if not all(math.isfinite(x) for x in (*key.location,*key.rotation)):numeric_issues.append(f'{name}@{key.frame_number}: nonfinite transform')
        if any(x<0 or x>127 for x in key.interp):numeric_issues.append(f'{name}@{key.frame_number}: noncanonical interpolation bytes')
for name,keys in animations['morph'].items():
    for key in keys:
        if not math.isfinite(key.weight):numeric_issues.append(f'{name}@{key.frame_number}: nonfinite weight')

bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/work/ene/source.blend'))
arm=next(o for o in bpy.data.objects if o.type=='ARMATURE')
mesh=next(o for o in bpy.data.objects if o.type=='MESH' and any(m.type=='ARMATURE' and m.object==arm for m in o.modifiers))
root=next(o for o in bpy.data.objects if getattr(o,'mmd_type',None)=='ROOT')
bone_names={b.mmd_bone.name_j or b.name for b in arm.pose.bones}
morph_names=set(mesh.data.shape_keys.key_blocks.keys())
mapping={}
for kind,names in [('bone',bone_names),('morph',morph_names)]:
    channels=set(animations[kind]);mapping[kind]=dict(matched=sorted(channels&names),unmatched=sorted(channels-names))
bpy.ops.object.select_all(action='DESELECT');root.hide_set(False);root.select_set(True);bpy.context.view_layer.objects.active=root
with bpy.context.temp_override(selected_objects=[root],active_object=root,object=root):
    imported=bpy.ops.mmd_tools.import_vmd(filepath=str(source),scale=0.08,bone_mapper='PMX',use_pose_mode=False,use_mirror=False,update_scene_settings=True,create_new_action=True,save_log=False)
if 'FINISHED' not in imported:raise RuntimeError(f'VMD import failed: {imported}')
scene=bpy.context.scene
output=ROOT/'assets/work/ene/vmd-inspection.blend';bpy.ops.wm.save_as_mainfile(filepath=str(output))
for obj in bpy.data.objects:
    if obj not in [mesh,arm]:obj.hide_render=True
scene.render.engine='BLENDER_EEVEE';scene.view_settings.view_transform='Standard';scene.world.color=(0.16,0.16,0.16)
scene.render.resolution_x=640;scene.render.resolution_y=800;scene.render.resolution_percentage=100
bpy.ops.object.camera_add();camera=bpy.context.object;camera.data.type='ORTHO';camera.data.ortho_scale=2.15;scene.camera=camera
target=Vector((0,0,0.95));camera.location=(0,-4,1.0);camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
for pos,energy in [((2,-3,4),450),((-2,-2,2),250)]:
    bpy.ops.object.light_add(type='AREA',location=pos);light=bpy.context.object;light.data.energy=energy;light.data.size=4;light.rotation_euler=(target-light.location).to_track_quat('-Z','Y').to_euler()
frames=[]
for frame in [1,60,120,180,240,300,349]:
    scene.frame_set(frame);bpy.context.view_layer.update()
    bounds=[mesh.matrix_world@Vector(corner) for corner in mesh.bound_box]
    image=ROOT/f'ops/reports/local/vmd/frame-{frame:03d}.png';image.parent.mkdir(parents=True,exist_ok=True)
    scene.render.filepath=str(image);bpy.ops.render.render(write_still=True)
    frames.append(dict(frame=frame,image=image.relative_to(ROOT).as_posix(),bounds=dict(min=[min(v[i] for v in bounds) for i in range(3)],max=[max(v[i] for v in bounds) for i in range(3)]),finite=all(math.isfinite(x) for p in arm.pose.bones for row in p.matrix for x in row)))
report=dict(file=source.relative_to(ROOT).as_posix(),sha256=hashlib.sha256(data).hexdigest(),model=header.model_name,bytes=len(data),reader='MMD Tools 4.5.14 section readers with exact-read bounds guard',sections=sections,numericIssues=numeric_issues,trailingBytes=0,mapping=mapping,ikStates=[dict(frame=k.frame_number,visible=k.visible,states=k.ik_states) for k in animations['ik']],importResult=list(imported),scene=output.relative_to(ROOT).as_posix(),frameRate=scene.render.fps,frames=frames)
(ROOT/'ops/reports/vmd-inspection.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('VMD_INSPECTED',json.dumps(dict(model=header.model_name,sections=sections,numericIssues=len(numeric_issues),frames=len(frames)),ensure_ascii=True),flush=True)
