"""Editable FK authoring helpers for the private Ene web scene; no shared edits."""
import math
import bpy
import numpy as np
from mathutils import Matrix, Quaternion, Vector

def smooth(x):
    x=max(0,min(1,x));return x*x*x*(x*(x*6-15)+10)

def prepare_fk(arm,profile):
    mapping=profile['humanoid'];removed=[]
    for bone in arm.pose.bones:
        bone.rotation_mode='QUATERNION';bone.matrix_basis.identity()
        for constraint in list(bone.constraints):
            removed.append({'bone':bone.name,'type':constraint.type});bone.constraints.remove(constraint)
    bpy.context.view_layer.objects.active=arm;arm.hide_set(False);arm.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    parents={'spine':'hips','chest':'spine','neck':'chest','head':'neck','leftEye':'head','rightEye':'head'}
    for side in ['left','right']:
        for child,parent in [('Shoulder','chest'),('UpperArm',side+'Shoulder'),('LowerArm',side+'UpperArm'),('Hand',side+'LowerArm'),('UpperLeg','hips'),('LowerLeg',side+'UpperLeg'),('Foot',side+'LowerLeg'),('Toes',side+'Foot')]:parents[side+child]=parent
        for finger in ['Thumb','Index','Middle','Ring','Little']:
            names=['Metacarpal','Proximal','Distal'] if finger=='Thumb' else ['Proximal','Intermediate','Distal']
            for i,name in enumerate(names):parents[side+finger+name]=side+'Hand' if i==0 else side+finger+names[i-1]
    for child,parent in parents.items():
        bone=arm.data.edit_bones[mapping[child]];bone.use_connect=False;bone.parent=arm.data.edit_bones[mapping[parent]]
    for jp in ['左','右']:
        for part in ['足','ひざ','足首']:
            alias=arm.data.edit_bones.get(jp+part+'D')
            if alias:alias.use_connect=False;alias.parent=arm.data.edit_bones[jp+part]
    bpy.ops.object.mode_set(mode='OBJECT');bpy.context.view_layer.update()
    return removed

class Rig:
    def __init__(self,arm,meshes,profile):
        self.arm,self.meshes,self.profile=arm,meshes,profile
        self.mapping=profile['humanoid'];self.touched=set();self.palm_normals={};self.morph_names=set()
        # The source has a dedicated Nails material; its outward face normal
        # distinguishes the back of the hand from the palm without a sign guess.
        for side,sign in [('left',1),('right',-1)]:
            normal=Vector((0,0,0))
            for mesh in meshes:
                for poly in mesh.data.polygons:
                    if poly.material_index==0 and sign*poly.center.x>.38 and .80<poly.center.z<1.08:normal+=poly.normal*poly.area
            if normal.length>1e-8:self.palm_normals[side]=-normal.normalized()
        self.cuff_corrections={}
        for side,sign in [('left',1),('right',-1)]:
            wrist=self.bone(side+'Hand').bone.head_local
            forward=(self.bone(side+'MiddleProximal').bone.head_local-wrist).normalized()
            total=0
            for mesh in meshes:
                cloth={v for p in mesh.data.polygons if p.material_index not in [0,1] for v in p.vertices}
                shape=mesh.shape_key_add(name='WebCuffRetract'+side.title(),from_mix=False)
                for index in cloth:
                    co=shape.data[index].co
                    if sign*co.x>.35 and .80<co.z<1.16:
                        amount=.065*smooth(((co-wrist).dot(forward)+.01)/.10)
                        if amount>1e-6:co-=forward*amount;total+=1
                shape.value=0
            self.cuff_corrections[side]={'shape':'WebCuffRetract'+side.title(),'affectedVertices':total,'maximumRetractionMeters':.065}
    def bone(self,name):return self.arm.pose.bones[self.mapping.get(name,name)]
    def local(self,name,axis,degrees,compose=False):
        b=self.bone(name);q=b.bone.matrix_local.to_quaternion();delta=Quaternion(q.inverted()@Vector(axis),math.radians(degrees));b.rotation_quaternion=delta@b.rotation_quaternion if compose else delta;self.touched.add(b.name)
    def global_quat(self,name,q):
        b=self.bone(name);head=b.matrix.translation.copy();b.matrix=Matrix.LocRotScale(head,q,Vector((1,1,1)));self.touched.add(b.name);bpy.context.view_layer.update()
    def aim(self,name,direction):
        b=self.bone(name);rest=b.bone.matrix_local.to_quaternion();rest_y=rest@Vector((0,1,0));self.global_quat(name,rest_y.rotation_difference(Vector(direction).normalized())@rest)
    def arm_ik(self,side,wrist,pole):
        upper=self.bone(side+'UpperArm');lower=self.bone(side+'LowerArm');hand=self.bone(side+'Hand')
        shoulder=upper.matrix.translation.copy();wrist=Vector(wrist);pole=Vector(pole)
        a=(lower.bone.head_local-upper.bone.head_local).length;b=(hand.bone.head_local-lower.bone.head_local).length
        delta=wrist-shoulder;distance=min(max(delta.length,abs(a-b)+.001),a+b-.002);direction=delta.normalized();actual=shoulder+direction*distance
        along=(a*a-b*b+distance*distance)/(2*distance);height=math.sqrt(max(0,a*a-along*along))
        plane=pole-shoulder;plane-=direction*plane.dot(direction);plane.normalize()
        elbow=shoulder+direction*along+plane*height
        self.aim(side+'UpperArm',elbow-shoulder);self.aim(side+'LowerArm',actual-elbow)
        return {'target':list(wrist),'actual':list(self.bone(side+'Hand').matrix.translation),'clamped':(actual-wrist).length>.0001}
    def palm(self,side,direction,normal):
        b=self.bone(side+'Hand');rest=b.bone.matrix_local.to_quaternion()
        wrist=b.bone.head_local;middle=self.bone(side+'MiddleProximal').bone.head_local;index=self.bone(side+'IndexProximal').bone.head_local;little=self.bone(side+'LittleProximal').bone.head_local
        forward=(middle-wrist).normalized();palm=self.palm_normals.get(side,forward.cross(little-index).normalized()*(-1 if side=='left' else 1))
        palm=palm-forward*palm.dot(forward);palm.normalize()
        target=Vector(direction).normalized();normal=Vector(normal);normal-=target*normal.dot(target);normal.normalize()
        align=forward.rotation_difference(target);current=align@palm
        angle=math.atan2(target.dot(current.cross(normal)),current.dot(normal));world=Quaternion(target,angle)@align
        self.global_quat(side+'Hand',world@rest)
        # Separate five digits gently, preserving each real Ene joint and geometry.
        for finger,degrees in [('Index',4),('Middle',0),('Ring',-2),('Little',-5)]:
            name=side+finger+'Proximal';pb=self.bone(name)
            axis=pb.bone.matrix_local.to_quaternion().inverted()@palm
            pb.rotation_quaternion=Quaternion(axis,math.radians(degrees*(-1 if side=='left' else 1)));self.touched.add(pb.name)
    def morph(self,name,value):
        source='ω' if name=='omega' else self.profile['expressions'].get(name,name)
        found=False
        for mesh in self.meshes:
            if mesh.data.shape_keys and source in mesh.data.shape_keys.key_blocks:mesh.data.shape_keys.key_blocks[source].value=value;found=True
        if not found:raise KeyError('Missing Ene shape: '+source)
        self.morph_names.add(source)
    def key(self,frame):
        for name in self.touched:
            b=self.arm.pose.bones[name];b.keyframe_insert(data_path='rotation_quaternion',frame=frame,group=name)
            b.keyframe_insert(data_path='location',frame=frame,group=name);b.keyframe_insert(data_path='scale',frame=frame,group=name)
        for mesh in self.meshes:
            if mesh.data.shape_keys:
                for k in mesh.data.shape_keys.key_blocks:
                    if k.name in self.morph_names or k.name in [self.profile['expressions']['blink'],self.profile['expressions']['happy'],'ω'] or k.name.startswith('WebCuffRetract'):k.keyframe_insert(data_path='value',frame=frame,group='Face and cuff pose')

def secondary_samples(seconds,fps,settings):
    """Damped periodic angular response, warmed to steady state before key baking."""
    count=round(seconds*fps);sub=settings['substeps'];dt=1/(fps*sub);omega=2*math.pi*settings['frequencyHz'];damping=2*settings['dampingRatio']*omega
    position=velocity=0.;samples=[];warm=settings['warmupLoops']*count*sub
    for step in range(warm+count*sub+1):
        phase=2*math.pi*step/(count*sub)
        target=settings['hairAmplitudeDegrees']*(math.sin(phase)+.25*math.sin(2*phase-.4))
        velocity+=(omega*omega*(target-position)-damping*velocity)*dt;position+=velocity*dt
        if step>=warm and (step-warm)%sub==0:samples.append((position,velocity))
    return samples,{'warmupSeconds':settings['warmupLoops']*seconds,'integrationHz':fps*sub,'frequencyHz':settings['frequencyHz'],'dampingRatio':settings['dampingRatio'],'boundaryAngleDeltaDegrees':abs(samples[-1][0]-samples[0][0]),'boundaryVelocityDeltaDegreesPerSecond':abs(samples[-1][1]-samples[0][1])}

def linear_keys(action):
    if not action:return
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for curve in bag.fcurves:
                    for key in curve.keyframe_points:key.interpolation='LINEAR'

def projected_geometry(scene,mesh):
    deps=bpy.context.evaluated_depsgraph_get();evaluated=mesh.evaluated_get(deps);data=evaluated.to_mesh()
    vertices=np.empty(len(data.vertices)*3,dtype=np.float32);data.vertices.foreach_get('co',vertices);vertices=vertices.reshape(-1,3)
    world=np.c_[vertices,np.ones(len(vertices))]@np.asarray(mesh.matrix_world).T
    projection=np.asarray(scene.camera.calc_matrix_camera(deps,x=scene.render.resolution_x,y=scene.render.resolution_y))@np.asarray(scene.camera.matrix_world.inverted())
    clip=world@projection.T;uv=clip[:,:2]/clip[:,3:4]*.5+.5
    evaluated.to_mesh_clear();return world[:,:3],uv
