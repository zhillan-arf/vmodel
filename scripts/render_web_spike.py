"""Isolated editable Ene alpha test, not one of the five final performances."""
from pathlib import Path
import ctypes, hashlib, json, math, sys, time
sys.path.insert(0, str(Path(__file__).resolve().parent))
from blender_bootstrap import ROOT, setup
setup()
import bpy
import numpy as np
from mathutils import Quaternion, Vector

config = json.loads((ROOT/'config/web-resources/source.json').read_text())
profile = json.loads((ROOT/'config/avatars/ene.json').read_text(encoding='utf-8'))
source = ROOT/config['source']
workspace = ROOT/config['workspace']; workspace.mkdir(parents=True, exist_ok=True)
frames = ROOT/config['privateFrames']; frames.mkdir(parents=True, exist_ok=True)
hashes = {}
for relative, expected in config['originals'].items():
    actual = hashlib.sha256((ROOT/relative).read_bytes()).hexdigest()
    if actual != expected: raise RuntimeError(f'Original changed: {relative}')
    hashes[relative] = actual
source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(source))
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
meshes = [o for o in bpy.data.objects if o.type == 'MESH' and any(m.type=='ARMATURE' and m.object==arm for m in o.modifiers)]
mesh_repairs=[]
for mesh in meshes:
    before=(len(mesh.data.vertices),len(mesh.data.polygons),len(mesh.data.edges))
    changed=mesh.data.validate(verbose=False,clean_customdata=False)
    after=(len(mesh.data.vertices),len(mesh.data.polygons),len(mesh.data.edges))
    if before[0]!=after[0]:raise RuntimeError('Web mesh repair changed shape-key vertex indexing')
    mesh_repairs.append({'mesh':mesh.name,'changed':changed,'before':before,'after':after})
for obj in bpy.data.objects: obj.hide_render = obj not in meshes and obj != arm
for obj in [arm, *meshes]:
    obj.animation_data_clear()
    if obj.type=='MESH' and obj.data.shape_keys: obj.data.shape_keys.animation_data_clear()
# Keep all source bones/constraints; disable no physics that was already built.
# source.blend is unbuilt; this small keyed diagnostic deliberately has no simulation.
for bone in arm.pose.bones:
    bone.rotation_mode = 'QUATERNION'; bone.rotation_quaternion.identity(); bone.location=(0,0,0); bone.scale=(1,1,1)
for mesh in meshes:
    if mesh.data.shape_keys:
        for key in mesh.data.shape_keys.key_blocks: key.value=0
bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=str(workspace/'source.blend'))

def rotation(name, axis, angle, frame):
    bone = arm.pose.bones[profile['humanoid'][name]]
    local_axis = bone.bone.matrix_local.to_quaternion().inverted() @ Vector(axis)
    bone.rotation_quaternion = Quaternion(local_axis, math.radians(angle))
    bone.keyframe_insert(data_path='rotation_quaternion', frame=frame, group=name)

def morph(name, value, frame):
    for mesh in meshes:
        if mesh.data.shape_keys:
            key = mesh.data.shape_keys.key_blocks.get(profile['expressions'][name])
            if key: key.value=value; key.keyframe_insert(data_path='value', frame=frame, group=name)

scene=bpy.context.scene; settings=config['render']
scene.frame_start=1; scene.frame_end=settings['frames']; scene.render.fps=settings['fps']
scene.render.engine=settings['engine']; scene.render.film_transparent=True
scene.render.resolution_x=settings['width'];scene.render.resolution_y=settings['height'];scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.render.image_settings.color_depth='8';scene.render.image_settings.compression=20
scene.view_settings.view_transform='Standard';scene.view_settings.look='None';scene.view_settings.exposure=settings['exposure'];scene.view_settings.gamma=1
if hasattr(scene, 'eevee'): scene.eevee.taa_render_samples=settings['samples']
scene.world.color=(.17,.17,.17)
center=Vector((.02,-.025,1.31))
bpy.ops.object.camera_add(location=(.02,-3.5,1.31));camera=bpy.context.object
camera.name='web-spike-camera';camera.data.type='ORTHO';camera.data.ortho_scale=1.10
camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler();scene.camera=camera
for loc,power,size in [((1.5,-3,3),100,4),((-2,-1,2),70,3),((1,2,3),80,3)]:
    bpy.ops.object.light_add(type='AREA',location=loc);light=bpy.context.object;light.data.energy=power;light.data.size=size
    light.rotation_euler=(center-light.location).to_track_quat('-Z','Y').to_euler()
for frame in range(1, settings['frames']+2):
    phase=2*math.pi*(frame-1)/settings['frames']
    rotation('leftUpperArm',(0,1,0),-25+2*math.sin(phase),frame)
    rotation('leftLowerArm',(0,1,0),-65+7*math.sin(phase),frame)
    rotation('leftHand',(0,1,0),8*math.sin(phase),frame)
    rotation('rightUpperArm',(0,1,0),-24,frame)
    rotation('head',(0,1,0),2*math.sin(phase),frame)
    rotation('chest',(1,0,0),1*math.sin(phase),frame)
    morph('happy',.2,frame)
    # One full blink, held closed for two rendered frames.
    blink=max(0,min(1,1.5-abs(frame-23.5)/2))
    morph('blink',blink,frame)
scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=str(workspace/'alpha-spike.blend'))
inspection={'armature':arm.name,'meshCount':len(meshes),'vertices':sum(len(m.data.vertices) for m in meshes),'meshRepairs':mesh_repairs,
    'handBones':{side:profile['humanoid'][side+'Hand'] in arm.pose.bones for side in ['left','right']},
    'morphs':{name:any(m.data.shape_keys and profile['expressions'][name] in m.data.shape_keys.key_blocks for m in meshes) for name in ['blink','happy','surprised','sad']},
    'missingImages':[im.name for im in bpy.data.images if im.source=='FILE' and not im.packed_file and not Path(bpy.path.abspath(im.filepath)).exists()]}
start=time.perf_counter(); times=[];alpha=[]
requested = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
selected=[int(x) for x in requested] if requested else range(1,settings['frames']+1)
for frame in selected:
    scene.frame_set(frame);scene.render.filepath=str(frames/f'frame-{frame:04d}.png')
    before=time.perf_counter();bpy.ops.render.render(write_still=True);times.append({'frame':frame,'seconds':time.perf_counter()-before})
    if frame in [1,12,23,24,36,48]:
        im=bpy.data.images.load(scene.render.filepath,check_existing=False)
        pixels=np.empty(len(im.pixels),dtype=np.float32);im.pixels.foreach_get(pixels);pixels=pixels.reshape(-1,4)
        a=pixels[:,3]; alpha.append({'frame':frame,'transparent':int(np.sum(a<.001)),'opaque':int(np.sum(a>.999)),'partial':int(np.sum((a>=.001)&(a<=.999)))})
        bpy.data.images.remove(im)
    print('WEB_FRAME', frame, round(times[-1]['seconds'],3), flush=True)
class MemoryCounters(ctypes.Structure):
    _fields_=[('cb',ctypes.c_ulong),('PageFaultCount',ctypes.c_ulong)]+[(name,ctypes.c_size_t) for name in ['PeakWorkingSetSize','WorkingSetSize','QuotaPeakPagedPoolUsage','QuotaPagedPoolUsage','QuotaPeakNonPagedPoolUsage','QuotaNonPagedPoolUsage','PagefileUsage','PeakPagefileUsage']]
mem=MemoryCounters();mem.cb=ctypes.sizeof(mem)
ctypes.windll.kernel32.GetCurrentProcess.restype=ctypes.c_void_p
ctypes.windll.psapi.GetProcessMemoryInfo.argtypes=[ctypes.c_void_p,ctypes.c_void_p,ctypes.c_ulong]
if not ctypes.windll.psapi.GetProcessMemoryInfo(ctypes.windll.kernel32.GetCurrentProcess(),ctypes.byref(mem),mem.cb): raise RuntimeError('Could not measure render process memory')
report={'schemaVersion':1,'blender':bpy.app.version_string,'sourceSha256':source_hash,'originalHashes':hashes,'inspection':inspection,'settings':settings,'scene':'assets/work/ene-web/alpha-spike.blend','framesDirectory':config['privateFrames'],'renderedFrames':times,'elapsedSeconds':time.perf_counter()-start,'peakWorkingSetBytes':mem.PeakWorkingSetSize,'alpha':alpha,'simulation':'No secondary simulation in disposable codec spike; final actions must bake and inspect settling separately.'}
report_path=ROOT/'ops/reports/web-spike-render.json';report_path.write_text(json.dumps(report,indent=2,ensure_ascii=True)+'\n')
if hashlib.sha256(source.read_bytes()).hexdigest()!=source_hash:raise RuntimeError('Shared source was modified')
print('WEB_SPIKE_RENDERED', report['elapsedSeconds'], flush=True)
