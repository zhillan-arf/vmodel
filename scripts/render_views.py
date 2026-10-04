"""Reopen the source or import the exported VRM and render three review views."""
from pathlib import Path
import sys,json,math,hashlib
sys.path.insert(0,str(Path(__file__).resolve().parent))
from blender_bootstrap import ROOT,setup
setup()
import bpy
from mathutils import Vector
mode=sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else 'source'
if mode=='vrm':
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    result=bpy.ops.import_scene.vrm(filepath=str(ROOT/'assets/avatars/ene.vrm'),use_addon_preferences=False)
    if 'FINISHED' not in result:raise RuntimeError(f'Independent VRM import failed: {result}')
else:bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/work/ene/source.blend'))
arm=next(o for o in bpy.data.objects if o.type=='ARMATURE')
meshes=[o for o in bpy.data.objects if o.type=='MESH' and any(m.type=='ARMATURE' and m.object==arm for m in o.modifiers)]
for obj in bpy.data.objects:
    if obj not in meshes and obj!=arm:obj.hide_render=True
bounds=[o.matrix_world@Vector(c) for o in meshes for c in o.bound_box]
minimum=Vector([min(v[i] for v in bounds) for i in range(3)]);maximum=Vector([max(v[i] for v in bounds) for i in range(3)])
center=(minimum+maximum)/2;height=maximum.z-minimum.z
scene=bpy.context.scene;scene.render.engine='BLENDER_EEVEE';scene.view_settings.view_transform='Standard'
scene.render.resolution_x=640;scene.render.resolution_y=800;scene.render.resolution_percentage=100
scene.world.color=(0.15,0.15,0.15)
bpy.ops.object.camera_add();camera=bpy.context.object;camera.data.type='ORTHO';camera.data.ortho_scale=height*1.12;scene.camera=camera
for x,y,z,energy in [(2,-3,4,350),(-2,2,3,250)]:
    bpy.ops.object.light_add(type='AREA',location=(x,y,z));light=bpy.context.object;light.data.energy=energy;light.data.size=4
    light.rotation_euler=(center-light.location).to_track_quat('-Z','Y').to_euler()
rendered=[]
for name,angle in [('front',0),('side',math.pi/2),('back',math.pi)]:
    camera.location=center+Vector((math.sin(angle)*height*2.5,-math.cos(angle)*height*2.5,0))
    camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler()
    path=ROOT/f'ops/001-zhil/sprint-001/reports/local/ene-{mode}-{name}.png';path.parent.mkdir(exist_ok=True,parents=True)
    scene.render.filepath=str(path);bpy.ops.render.render(write_still=True);rendered.append(path.relative_to(ROOT).as_posix())
report={'mode':mode,'reopened':True,'armature':arm.name,'meshes':len(meshes),'images':rendered,'missingImageFiles':[i.name for i in bpy.data.images if i.source=='FILE' and not i.packed_file and not Path(bpy.path.abspath(i.filepath)).exists()]}
if mode=='vrm':report['avatarSha256']=hashlib.sha256((ROOT/'assets/avatars/ene.vrm').read_bytes()).hexdigest()
(ROOT/f'ops/001-zhil/sprint-001/reports/{mode}-views.json').write_text(json.dumps(report,indent=2)+'\n')
print('VIEWS_COMPLETE',json.dumps(report),flush=True)
