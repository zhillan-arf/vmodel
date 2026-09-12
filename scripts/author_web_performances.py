"""Author private greeting and desk-normal actions; render separately for review."""
from pathlib import Path
import hashlib,json,math,sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
from blender_bootstrap import ROOT,setup
setup()
import bpy
import numpy as np
from mathutils import Quaternion,Vector
from web_authoring import Rig,prepare_fk,smooth,secondary_samples,linear_keys,projected_geometry

config=json.loads((ROOT/'config/web-resources/performances.json').read_text())
profile=json.loads((ROOT/'config/avatars/ene.json').read_text(encoding='utf-8'))
source=ROOT/config['source'];source_hash=hashlib.sha256(source.read_bytes()).hexdigest()
requested=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else ['home-greeting','desk-normal']
for resource in requested:
    spec=config[resource];is_desk=resource.startswith('desk-');bpy.ops.wm.open_mainfile(filepath=str(source));scene=bpy.context.scene
    arm=next(o for o in bpy.data.objects if o.type=='ARMATURE')
    meshes=[o for o in bpy.data.objects if o.type=='MESH' and any(m.type=='ARMATURE' and m.object==arm for m in o.modifiers)]
    for obj in bpy.data.objects:obj.hide_render=obj not in meshes and obj!=arm
    for obj in [arm,*meshes]:
        obj.animation_data_clear()
        if obj.type=='MESH' and obj.data.shape_keys:
            obj.data.shape_keys.animation_data_clear()
            for key in obj.data.shape_keys.key_blocks:key.value=0
    removed=prepare_fk(arm,profile);rig=Rig(arm,meshes,profile)
    if scene.rigidbody_world:scene.rigidbody_world.enabled=False
    count=round(spec['seconds']*config['fps']);scene.frame_start=1;scene.frame_end=count;scene.render.fps=config['fps']
    scene.render.engine='BLENDER_EEVEE';scene.render.film_transparent=True
    scene.render.resolution_x,scene.render.resolution_y=spec['large'];scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.render.image_settings.color_depth='8';scene.render.image_settings.compression=20
    scene.view_settings.view_transform='Standard';scene.view_settings.look='None';scene.view_settings.exposure=-.2;scene.view_settings.gamma=1
    if hasattr(scene,'eevee'):scene.eevee.taa_render_samples=32
    scene.world.color=(.17,.17,.17)
    center=Vector(spec['camera']['target']);bpy.ops.object.camera_add(location=(center.x,-4,center.z));camera=bpy.context.object;camera.name=resource+'-camera';camera.data.type='ORTHO';camera.data.ortho_scale=spec['camera']['orthoScale'];camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler();scene.camera=camera
    for loc,power,size in [((1.5,-3,3),100,4),((-2,-1,2),70,3),((1,2,3),80,3)]:
        bpy.ops.object.light_add(type='AREA',location=loc);light=bpy.context.object;light.data.energy=power;light.data.size=size;light.rotation_euler=(center-light.location).to_track_quat('-Z','Y').to_euler()
    if is_desk:
        bpy.ops.mesh.primitive_plane_add(size=2,location=(0,-.25,spec['deskGuideZ']));guide=bpy.context.object;guide.name='DESK_CONTACT_GUIDE_NOT_RENDERED';guide.hide_render=True;guide.display_type='WIRE'
    spring,bake=secondary_samples(spec['seconds'],config['fps'],config['secondary'])
    hair=[b.name for b in arm.pose.bones if '髪' in b.name and not b.name.startswith('+') and '先' not in b.name]
    skirt=[b.name for b in arm.pose.bones if b.name.startswith('スカート_0_')]
    palms=[];numeric=[];previous_quats={}
    for i in range(count+1):
        frame=i+1;t=i/config['fps'];phase=2*math.pi*i/count
        for bone in arm.pose.bones:bone.matrix_basis.identity()
        rig.touched=set()
        if is_desk:
            performance=spec.get('performance',{});pulse=(1-math.cos(phase))/2
            extra=performance.get('recoilDegrees',0)*pulse+performance.get('buoyancyDegrees',0)*math.sin(2*phase)
            rig.local('spine',(1,0,0),5+.25*math.sin(phase)+extra);rig.local('chest',(1,0,0),1.5+.3*math.sin(phase)+extra*.5);rig.local('neck',(1,0,0),-2);rig.local('head',(1,0,0),-3+performance.get('headReactionDegrees',0)*pulse+performance.get('headBounceDegrees',0)*math.sin(2*phase))
            rig.local('head',(0,1,0),performance.get('headTiltDegrees',0)+performance.get('headTiltVariationDegrees',0)*math.sin(phase),compose=True)
            bpy.context.view_layer.update()
            for side,sign in [('left',1),('right',-1)]:rig.aim(side+'UpperLeg',(sign*.09,-1,-.06));rig.aim(side+'LowerLeg',(sign*.04,.03,-1));rig.aim(side+'Foot',(0,-1,-.15))
            resting=rig.arm_ik('right',spec['restingWrist'],(-.42,-.12,1.03));rig.palm('right',(.82,-.57,0),(0,0,-1))
            wrist=Vector(spec['raisedWrist'])+Vector((.003*math.sin(phase)+performance.get('palmXMotion',0)*math.sin(phase),0,.003*math.sin(phase)+performance.get('palmBounceMeters',0)*math.sin(2*phase)))
            raised=rig.arm_ik('left',wrist,(.48,-.02,1.14));rig.palm('left',(.35+.05*math.sin(phase)+performance.get('palmTiltVariation',0)*math.sin(phase),0,1),(0,-1,.1))
            blink=max(0,min(1,1.5-abs(t-performance.get('blinkSeconds',1.65))/.07));rig.morph('blink',blink)
            for name,value in spec['expression'].items():
                value+=spec.get('expressionMotion',{}).get(name,0)*pulse
                if name in ['surprised','笑い','じと目']:value*=1-blink
                rig.morph(name,value)
        else:
            rise=smooth((t-.55)/1.75)*(1-smooth((t-3.6)/.95))
            nod=3*math.sin(math.pi*smooth((t-.15)/.7)) if .15<t<.85 else 0
            rig.local('spine',(0,1,0),.8*math.sin(phase));rig.local('chest',(1,0,0),.6*math.sin(phase));rig.local('head',(1,0,0),nod)
            bpy.context.view_layer.update()
            rest=Vector((-.235,-.03,.90));high=Vector((-.30,-.11,1.53));wrist=rest.lerp(high,rise)
            wave=math.sin((t-2.25)*2*math.pi*2.0)*smooth((t-2.25)/.2)*(1-smooth((t-3.35)/.25))
            wrist.x+=.018*wave*rise
            raised=rig.arm_ik('right',wrist,(-.38,.0,1.10+.14*rise))
            # Interpolate a palm angle, not a direction through near-zero length:
            # that would make the return rotate almost 90 degrees in one frame.
            palm_angle=(-math.pi+math.atan(.15))*(1-rise)-math.atan(.15)*rise
            rig.palm('right',(math.sin(palm_angle)-.25*wave*rise,0,math.cos(palm_angle)),(0,-1,.0))
            resting=rig.arm_ik('left',(.235,-.04,.90),(.38,.04,1.10));rig.palm('left',(.10,0,-1),(-1,-.2,0))
            rig.morph('happy',.18);rig.morph('omega',.10)
            blink=max(0,min(1,1.5-abs(t-.35)/.07));rig.morph('blink',blink)
        for j,name in enumerate(hair):
            depth=sum(1 for p in rig.bone(name).parent_recursive if '髪' in p.name)
            rig.local(name,(0,1,0),spring[i][0]*(1+.08*depth)*(-1 if name.startswith('右') else 1))
        for j,name in enumerate(skirt):
            y=rig.bone(name).bone.head_local.y
            seated_fold=(-50 if y<-.045 else -25 if y<.02 else 0) if is_desk else 0
            rig.local(name,(1,0,0),seated_fold+config['secondary']['skirtAmplitudeDegrees']*math.sin(phase+j*math.pi/4))
        raised_side='left' if is_desk else 'right'
        rig.morph('WebCuffRetract'+raised_side.title(),1)
        bpy.context.view_layer.update()
        # Keep adjacent quaternion samples in one hemisphere for interpolation.
        for name in rig.touched:
            q=arm.pose.bones[name].rotation_quaternion
            if name in previous_quats and q.dot(previous_quats[name])<0:q.negate()
            previous_quats[name]=q.copy()
        rig.key(frame)
        palms.append({'frame':frame,'resting':resting,'raised':raised})
        numeric.append(all(math.isfinite(x) for b in arm.pose.bones for row in b.matrix for x in row))
    arm.animation_data.action.name=resource+'-body-and-secondary-baked';linear_keys(arm.animation_data.action)
    for mesh in meshes:
        if mesh.data.shape_keys and mesh.data.shape_keys.animation_data:
            mesh.data.shape_keys.animation_data.action.name=resource+'-face';linear_keys(mesh.data.shape_keys.animation_data.action)
    # Retain a distinct authoring state before secondary motion, as well as the
    # render action. Both keep the actual body/face controls editable in Blender.
    combined=arm.animation_data.action;combined.use_fake_user=True
    body_action=combined.copy();body_action.name=resource+'-body-authored';body_action.use_fake_user=True
    for layer in body_action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for curve in list(bag.fcurves):
                    if any(curve.data_path.startswith('pose.bones["'+name+'"]') for name in hair+skirt):bag.fcurves.remove(curve)
    arm.animation_data.action=body_action;arm.animation_data.action_slot=body_action.slots[0]
    scene.frame_set(1)
    for name in hair:rig.bone(name).matrix_basis.identity()
    for name in skirt:
        y=rig.bone(name).bone.head_local.y;base=(-50 if y<-.045 else -25 if y<.02 else 0) if is_desk else 0
        rig.local(name,(1,0,0),base)
    authoring_output=ROOT/f'assets/work/ene-web/{resource}-authoring.blend';bpy.ops.wm.save_as_mainfile(filepath=str(authoring_output))
    arm.animation_data.action=combined;arm.animation_data.action_slot=combined.slots[0]
    scene.frame_set(1);bpy.context.view_layer.update()
    output=ROOT/f'assets/work/ene-web/{resource}.blend';bpy.ops.wm.save_as_mainfile(filepath=str(output))
    bounds=[]
    for frame in sorted(set([1,round(count*.2),round(count*.4),round(count*.5),round(count*.6),round(count*.8),count,count+1])):
        scene.frame_set(frame);bpy.context.view_layer.update();world,uv=projected_geometry(scene,meshes[0]);bounds.append({'frame':frame,'worldMin':world.min(axis=0).tolist(),'worldMax':world.max(axis=0).tolist(),'uvMin':uv.min(axis=0).tolist(),'uvMax':uv.max(axis=0).tolist()})
    report={'resource':resource,'source':config['source'],'sourceSha256':source_hash,'scene':str(output.relative_to(ROOT)),'sceneSha256':hashlib.sha256(output.read_bytes()).hexdigest(),'fps':config['fps'],'frames':count,'seconds':spec['seconds'],'camera':spec['camera'],'large':spec['large'],'small':spec['small'],'action':arm.animation_data.action.name,'authoringScene':str(authoring_output.relative_to(ROOT)),'bodyActionBeforeSecondaryBake':body_action.name,'removedMmdConstraints':removed,'secondaryBones':hair+skirt,'secondaryBake':bake,'secondaryScope':'Angular spring follower driven by periodic motion, baked after warmup; no Bullet collision simulation or arbitrary-pose physical accuracy claimed.','reference':spec.get('reference'),'allPoseMatricesFinite':all(numeric),'handTargets':palms,'reviewBounds':bounds,'deskGuideZ':spec.get('deskGuideZ'),'palmNormalsFromNails':{k:list(v) for k,v in rig.palm_normals.items()},'raisedCuffCorrection':{'side':raised_side,**rig.cuff_corrections[raised_side],'reason':'Expose the open palm otherwise covered by Ene\'s long cuff'}}
    report['expressionMap']={name:{'sourceKeyBlockIndex':meshes[0].data.shape_keys.key_blocks.find(name),'configuredValue':spec.get('expression',{}).get(alias),'action':resource+'-face'} for alias in [*spec.get('expression',{}),'blink'] for name in ['ω' if alias=='omega' else profile['expressions'].get(alias,alias)]}
    if is_desk:
        assert spec['camera']==config['desk-normal']['camera'] and spec['restingWrist']==config['desk-normal']['restingWrist'] and spec['deskGuideZ']==config['desk-normal']['deskGuideZ']
        report['baseline']='config/web-resources/desk-baseline.json';report['performance']=spec.get('performance',{})
    (ROOT/f'ops/reports/{resource}-authoring.json').write_text(json.dumps(report,ensure_ascii=True,indent=2)+'\n')
    print('WEB_AUTHORED',resource,count,flush=True)
assert hashlib.sha256(source.read_bytes()).hexdigest()==source_hash
