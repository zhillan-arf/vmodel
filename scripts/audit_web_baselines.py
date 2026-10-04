"""Verify editable pre-secondary actions and save reusable private desk baseline."""
from pathlib import Path
import hashlib,json,sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
from blender_bootstrap import ROOT,setup
setup()
import bpy
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
profile=json.loads((ROOT/'config/avatars/ene.json').read_text(encoding='utf-8'))
result={'authoringScenes':[]}
for resource in [name for name in ['home-greeting','desk-normal','desk-confused','desk-surprised','desk-excited'] if (ROOT/f'assets/work/ene-web/{name}-authoring.blend').exists()]:
    path=ROOT/f'assets/work/ene-web/{resource}-authoring.blend';bpy.ops.wm.open_mainfile(filepath=str(path));scene=bpy.context.scene
    arm=next(o for o in bpy.data.objects if o.type=='ARMATURE');action=arm.animation_data.action
    assert action.name==resource+'-body-authored'
    paths=[c.data_path for layer in action.layers for strip in layer.strips for bag in strip.channelbags for c in bag.fcurves]
    assert not any('\u9aea' in p or '\u30b9\u30ab\u30fc\u30c8_0_' in p for p in paths)
    scene.frame_set(1);first=arm.pose.bones[profile['humanoid']['chest']].rotation_quaternion.copy();changes=[]
    for frame in [10,20,37]:
        scene.frame_set(frame);second=arm.pose.bones[profile['humanoid']['chest']].rotation_quaternion.copy();changes.append(max(abs(a-b) for a,b in zip(first,second)))
    # Quaternion.angle rounds tiny but real breath changes to zero in float32.
    assert max(changes)>1e-6
    result['authoringScenes'].append({'path':str(path.relative_to(ROOT)),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'activeAction':action.name,'bodyAnimated':True,'maximumChestQuaternionComponentChange':max(changes),'sampledFrames':[1,10,20,37],'secondaryCurvesExcluded':True,'fcurves':len(paths)})
path=ROOT/'assets/work/ene-web/desk-normal.blend';bpy.ops.wm.open_mainfile(filepath=str(path));scene=bpy.context.scene;scene.frame_set(1)
arm=next(o for o in bpy.data.objects if o.type=='ARMATURE');mesh=next(o for o in bpy.data.objects if o.type=='MESH' and any(m.type=='ARMATURE' and m.object==arm for m in o.modifiers))
pose={'resource':'desk-normal','frame':1,'sourceScene':str(path.relative_to(ROOT)),'bones':{b.name:{'rotationQuaternion':list(b.rotation_quaternion),'location':list(b.location),'scale':list(b.scale)} for b in arm.pose.bones},'shapeKeys':{k.name:k.value for k in mesh.data.shape_keys.key_blocks}}
pose_path=ROOT/'assets/work/ene-web/desk-baseline-pose.json';pose_path.write_text(json.dumps(pose,ensure_ascii=True,indent=2)+'\n')
audit=json.loads((ROOT/'ops/001-zhil/sprint-001/reports/desk-normal-audit.json').read_text());camera=scene.camera
names={alias:profile['expressions'][alias] for alias in ['happy','blink']};names['omega']='\u03c9'
expressions={alias:{'sourceIndex':profile['expressionBindings'][alias]['sourceIndex'] if alias in profile['expressionBindings'] else 38,'blenderKeyBlockIndex':mesh.data.shape_keys.key_blocks.find(name),'sourceName':name,'baselineValue':mesh.data.shape_keys.key_blocks[name].value} for alias,name in names.items()}
baseline={'schemaVersion':1,'sourceScene':str(path.relative_to(ROOT)),'authoringScene':'assets/work/ene-web/desk-normal-authoring.blend','privatePose':str(pose_path.relative_to(ROOT)),'bodyAction':arm.animation_data.action.name,'fps':24,'frameRange':[1,72],'loopEndpoint':73,'seconds':3,'camera':{'type':'ORTHO','location':list(camera.location),'rotationQuaternion':list(camera.rotation_euler.to_quaternion()),'orthoScale':camera.data.ortho_scale,'large':[960,960],'small':[480,480]},'coordinateConvention':'Normalized image coordinates from top left; x increases right, y down','deskAnchor':audit['deskAnchorTopOrigin'],'deskGuideZ':audit['deskGuideZ'],'movingBounds':{'minimumUvBottomOrigin':audit['movingExtremityMinimumUv'],'maximumUvBottomOrigin':audit['movingExtremityMaximumUv']},'safeInset':.05,'expressions':expressions,'raisedHand':'model left / screen right','restingHand':'model right / screen left','referenceComparison':'Original screenshot unavailable; written composition brief followed','reuse':'Copy this source scene for TASK-033/034/035; preserve camera, resting wrist, desk anchor and lower-body pose. Edit named face keys and small head/hand accents, then re-audit every frame.'}
(ROOT/'config/web-resources/desk-baseline.json').write_text(json.dumps(baseline,ensure_ascii=True,indent=2)+'\n');result['deskBaseline']=baseline
expected={'ops/001-zhil/sprint-001/resources/ENE/ENE Cyber legs ver.pmx':'226fe9075f25c7dd2e6474fdd6acb77ff71c45900fb2d5c8794e08647aa9dbe4','ops/001-zhil/sprint-001/resources/ENE/ENE normal legs ver.pmx':'1b10578850b2ebd98a87f34099740a87c9589e3b8383aa2cef38d285ef3dfcab','ops/001-zhil/sprint-001/resources/ene.vmd':'d3abdedf45e36a55ad66e2546ec0a562054db8a6c11d4198fa8c6a773f39bea8','assets/avatars/ene.vrm':'3657b97928638e7ada5f6639141fb63f555912049a2c6ec217851001e322cbcb','assets/work/ene/source.blend':'e03272d80f9afdc6a86a956f0b81a8a43b3d0152f4dfc5ae2b71b9a84b9031e8'}
result['preservedSources']={p:{'sha256':hashlib.sha256((ROOT/p).read_bytes()).hexdigest(),'unchanged':hashlib.sha256((ROOT/p).read_bytes()).hexdigest()==sha} for p,sha in expected.items()}
assert all(x['unchanged'] for x in result['preservedSources'].values())
(ROOT/'ops/001-zhil/sprint-001/reports/web-performance-baselines.json').write_text(json.dumps(result,ensure_ascii=True,indent=2)+'\n');print('WEB_BASELINES_PASSED',expressions,flush=True)
