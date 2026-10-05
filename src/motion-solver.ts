import { Euler, Matrix4, Object3D, Quaternion, Vector3, MathUtils } from 'three';
import type { VRMHumanBoneName } from '@pixiv/three-vrm';
import { freshnessReason, type DiagnosticSink, type SolverOutcome, type TrackingTask } from './tracking-diagnostics';
export interface MotionRig { scene: Object3D; humanoid: { resetNormalizedPose(): void; getNormalizedBoneNode(name: VRMHumanBoneName): Object3D|null }; expressionManager?: { getExpression(name:string): unknown; getValue(name:string): number|null|undefined; setValue(name:string,value:number): void } }
import type { Calibration, Landmark, StudioSettings, TrackingFrame } from './types';
import { validCalibration } from './profiles';
import { associateHands, calibratedHeadWorld, faceRotation, palmWorldRotation, type PalmPoints } from './retarget-math';
import { limitFingerRotation } from './finger-solver';
import { solveLimbWorld } from './limb-solver';
import { shoulderRoll } from './torso-solver';

export const confidence = (p?: Landmark) => !!p && Number.isFinite(p.x + p.y + p.z) && (p.visibility ?? 1) > 0.55 && (p.presence ?? 1) > 0.55;
export const point = (p: Landmark) => new Vector3(p.x, -p.y, -p.z);
export const smoothingFactor = (speed: number, dt: number) => 1 - Math.exp(-Math.max(0, speed) * Math.max(0, dt));
export function segmentRotation(rest: Vector3, target: Vector3): Quaternion | null {
  if (rest.lengthSq() < 1e-8 || target.lengthSq() < 1e-8 || !Number.isFinite(target.lengthSq())) return null;
  return new Quaternion().setFromUnitVectors(rest.clone().normalize(), target.clone().normalize());
}
interface Rest { node: Object3D; local: Quaternion; world: Quaternion; direction: Vector3 }
const recent = (timestamp: number, now: number) => Number.isFinite(timestamp) && now - timestamp >= -50 && now - timestamp < 500;
const coefficient = (value: number | undefined) => Number.isFinite(value) ? MathUtils.clamp(value!, 0, 1) : 0;
export class MotionSolver {
  diagnosticSink?: DiagnosticSink;
  sampleIds:Partial<Record<'face'|'pose'|'hands',number>>={};
  headDiagnostic:{raw:number[];neutralRelative:number[];limited:number[];applied:number[]}|null=null;
  private task(channel:string):TrackingTask { return channel==='head'||channel==='face'||channel==='neck'||channel.endsWith('Eye')?'face':/hands|Hand|Thumb|Index|Middle|Ring|Little/.test(channel)?'hands':'pose'; }
  private report(channel:string,reason:SolverOutcome['reason'],value?:number,threshold?:number,task=this.task(channel),jointIndex?:number) {
    this.diagnosticSink?.({stage:'solver',channel,reason,accepted:reason==='accepted'||reason==='clamped',sampleId:this.sampleIds[task],jointIndex,
      value:Number.isFinite(value)?value:undefined,threshold:Number.isFinite(threshold)?threshold:undefined});
  }
  private context(task:TrackingTask,channel?:string):DiagnosticSink|undefined {
    return this.diagnosticSink ? outcome=>this.diagnosticSink?.({...outcome,channel:channel??outcome.channel,sampleId:this.sampleIds[task]}) : undefined;
  }
  private points(channel:string,points:(Landmark|undefined)[],indices:number[],task=this.task(channel)) {
    for(let i=0;i<points.length;i++){
      const point=points[i];
      if(!point||!Number.isFinite(point.x+point.y+point.z)){this.report(channel,point?'invalid_value':'missing_landmark',undefined,undefined,task,indices[i]);return false;}
      if(task==='hands')continue;
      for(const field of ['visibility','presence']as const){
        if(point[field]===undefined)this.diagnosticSink?.({stage:`confidence.${field}`,channel,reason:'accepted',accepted:true,sampleId:this.sampleIds[task],jointIndex:indices[i],defaultApplied:1});
        if(!((point[field]??1)>.55)){this.report(channel,field==='visibility'?'low_visibility':'low_presence',point[field],.55,task,indices[i]);return false;}
      }
    }
    return true;
  }
  private age(channel:string,timestamp:number,now:number,task=this.task(channel)){
    const reason=freshnessReason(timestamp,now);
    if(reason)this.report(channel,reason,now-timestamp,reason==='future_sample'?-50:reason==='stale'?500:undefined,task);
  }
  private limit(channel:string,value:number,min:number,max:number,task=this.task(channel)){
    if(value<min||value>max)this.report(channel,'clamped',value,value<min?min:max,task);
  }
  private faceCoefficient(channel:string,value:number|undefined){
    const result=coefficient(value);
    if(!Number.isFinite(value))this.diagnosticSink?.({stage:'face coefficient',channel,reason:value===undefined?'not_detected':'invalid_value',accepted:false,sampleId:this.sampleIds.face,defaultApplied:0});
    else {this.limit(channel,value!,0,1,'face');if(result===value)this.report(channel,'accepted',value,undefined,'face');}
    return result;
  }
  private rests = new Map<string, Rest>();
  private idleArms = new Map<string, Quaternion>();
  private neutralHead = new Quaternion();
  private neutralRoot = new Vector3(0.5, -0.5, 0);
  private lastTimestamp = -1;
  private lastMode = '';
  private neutralTorsoRoll = 0;
  private sampleOutcomes:SolverOutcome[]=[];
  private goals = new Map<string, { world: Quaternion; timestamp: number; task:TrackingTask; sampleId?:number; lostAt?:number }>();
  private palms = new Map<string, PalmPoints>();
  private fingerAxes = new Map<string, Vector3>();
  private limbPlanes = new Map<string, { normal: Vector3; timestamp: number }>();
  private groundY = 0;
  private expressionGoals: Record<string, number> = {};
  private manual = 'neutral';
  private root: Object3D | null;
  private rootRest = new Vector3();
  constructor(readonly vrm: MotionRig) {
    vrm.humanoid.resetNormalizedPose(); vrm.scene.updateMatrixWorld(true);
    const childOf: Record<string, string> = { hips:'spine',spine:'chest',chest:'neck',neck:'head',head:'leftEye',leftEye:'leftEye',rightEye:'rightEye' };
    for (const side of ['left','right']) {
      Object.assign(childOf, { [side+'Shoulder']:side+'UpperArm', [side+'UpperArm']:side+'LowerArm', [side+'LowerArm']:side+'Hand',
        [side+'Hand']:side+'MiddleProximal', [side+'UpperLeg']:side+'LowerLeg',[side+'LowerLeg']:side+'Foot',[side+'Foot']:side+'Toes' });
      for (const finger of ['Thumb','Index','Middle','Ring','Little']) {
        const segments = finger === 'Thumb' ? ['Metacarpal','Proximal','Distal'] : ['Proximal','Intermediate','Distal'];
        segments.forEach((segment,i) => childOf[side+finger+segment] = side+finger+(segments[i+1] ?? segments[i]));
      }
    }
    for (const [name, childName] of Object.entries(childOf)) {
      const node = vrm.humanoid.getNormalizedBoneNode(name as VRMHumanBoneName);
      const child = vrm.humanoid.getNormalizedBoneNode(childName as VRMHumanBoneName);
      if (!node) continue;
      let direction = child ? child.getWorldPosition(new Vector3()).sub(node.getWorldPosition(new Vector3())) : new Vector3(0,1,0);
      if (direction.lengthSq() < 1e-8) direction = node.getWorldPosition(new Vector3()).sub(node.parent?.getWorldPosition(new Vector3()) ?? new Vector3());
      this.rests.set(name,{ node,local:node.quaternion.clone(),world:node.getWorldQuaternion(new Quaternion()),direction });
    }
    const depth = (node: Object3D): number => node.parent ? 1 + depth(node.parent) : 0;
    this.rests = new Map([...this.rests].sort(([, a], [, b]) => depth(a.node) - depth(b.node)));
    for (const name of ['leftUpperArm', 'rightUpperArm']) {
      const rest = this.rests.get(name); if (!rest) continue;
      // VRM0 and VRM1 can face opposite directions before normalization. Derive
      // the relaxed pose from this rig instead of assuming Ene's local Z signs.
      const lateral = rest.direction.clone().setY(0).normalize();
      const target = lateral.multiplyScalar(Math.cos(1.15)).add(new Vector3(0, -Math.sin(1.15), 0));
      const rotation = segmentRotation(rest.direction, target); if (!rotation) continue;
      this.idleArms.set(name, rest.local.clone().multiply(rest.world.clone().invert().multiply(rotation).multiply(rest.world)));
    }
    for (const side of ['left', 'right']) {
      const palm: Partial<PalmPoints> = {};
      for (const [key, bone] of [['wrist','Hand'], ['middle','MiddleProximal'], ['index','IndexProximal'], ['little','LittleProximal']] as const) {
        const node = vrm.humanoid.getNormalizedBoneNode((side + bone) as VRMHumanBoneName);
        if (node) palm[key] = node.getWorldPosition(new Vector3());
      }
      if (palm.wrist && palm.middle && palm.index && palm.little) {
        this.palms.set(side, palm as PalmPoints);
        const along = palm.middle.clone().sub(palm.wrist).normalize();
        const closing = palm.index.clone().sub(palm.little).cross(along).normalize().multiplyScalar(side === 'left' ? -1 : 1);
        for (const [name, rest] of this.rests) if (name.startsWith(side) && /Index|Middle|Ring|Little/.test(name)) {
          const axis = rest.direction.clone().normalize().cross(closing).normalize().applyQuaternion(rest.world.clone().invert());
          if (axis.lengthSq() > .5) this.fingerAxes.set(name, axis);
        }
      }
    }
    this.root = vrm.humanoid.getNormalizedBoneNode('hips');
    if (this.root) this.rootRest.copy(this.root.position);
    const feet = ['leftFoot','rightFoot','leftToes','rightToes'].map(name => vrm.humanoid.getNormalizedBoneNode(name as VRMHumanBoneName)).filter((node): node is Object3D => !!node);
    if (feet.length) this.groundY = Math.min(...feet.map(node => node.getWorldPosition(new Vector3()).y));
  }
  calibrate(frame: TrackingFrame | null) {
    const head = faceRotation(frame?.faceMatrix ?? null);
    if (head) this.neutralHead.copy(head);
    if(frame&&frame.samples.pose.present&&recent(frame.samples.pose.timestamp,frame.timestamp))this.neutralTorsoRoll=shoulderRoll(frame)??this.neutralTorsoRoll;
    if (confidence(frame?.poseImage[23]) && confidence(frame?.poseImage[24])) this.neutralRoot.copy(point(frame!.poseImage[23])).add(point(frame!.poseImage[24])).multiplyScalar(0.5);
    this.lastTimestamp = -1; this.goals.clear(); this.limbPlanes.clear();
  }
  getCalibration(): Calibration { return { version: 1, head: this.neutralHead.toArray(), root: this.neutralRoot.toArray(), torsoRoll: this.neutralTorsoRoll }; }
  setCalibration(value: Calibration | null) {
    if (validCalibration(value)) { this.neutralHead.fromArray(value.head); this.neutralRoot.fromArray(value.root); this.neutralTorsoRoll=value.torsoRoll??0; }
    else { this.neutralHead.identity(); this.neutralRoot.set(0.5, -0.5, 0); this.neutralTorsoRoll=0; }
    this.lastTimestamp = -1; this.goals.clear(); this.limbPlanes.clear();
  }
  setExpression(name: string) { this.manual = ['neutral','happy','surprised'].includes(name) ? name : 'neutral'; }
  private setGoal(name: string, world: Quaternion, timestamp: number, task=this.task(name)) {
    if (world.toArray().every(Number.isFinite) && world.lengthSq() > 1e-8) { this.goals.set(name, { world: world.normalize(), timestamp, task, sampleId:this.sampleIds[task] }); this.report(name,'accepted',undefined,undefined,task); } else this.report(name,'invalid_value',undefined,undefined,task);
  }
  private aim(name: string, timestamp: number, a?: Landmark, b?: Landmark, referenceDelta?: Quaternion, indices:number[] = [], task=this.task(name)) {
    const rest = this.rests.get(name);
    if (!rest) { this.report(name,'missing_bone',undefined,undefined,task); return; }
    if(!this.points(name,[a,b],indices,task))return;
    const direction = rest.direction.clone();
    const reference = rest.world.clone();
    if (referenceDelta) { direction.applyQuaternion(referenceDelta); reference.premultiply(referenceDelta); }
    const delta = segmentRotation(direction, point(b!).sub(point(a!)));
    if (!delta) { this.report(name,'degenerate_segment',undefined,undefined,task); return; }
    const world = delta.multiply(reference);
    this.setGoal(name, world, timestamp,task);
  }
  private limb(side: string, kind: 'Arm' | 'Leg', timestamp: number, a?: Landmark, b?: Landmark, c?: Landmark, pelvis?: Quaternion) {
    const indices=kind==='Arm'?(side==='left'?[11,13,15]:[12,14,16]):(side==='left'?[23,25,27]:[24,26,28]);
    if(!this.points(side+kind,[a,b,c],indices,'pose'))return;
    const upper = this.rests.get(side+'Upper'+kind), lower = this.rests.get(side+'Lower'+kind);
    if (!upper || !lower) { this.report(side+kind,'missing_bone'); return; }
    const name = side+kind, previous = this.limbPlanes.get(name);
    const normal = kind === 'Arm' ? upper.direction.clone().cross(new Vector3(0,0,1)).normalize() : new Vector3(1,0,0);
    const history = previous && recent(previous.timestamp,timestamp) ? previous.normal : undefined;
    const solution = solveLimbWorld(point(a!), point(b!), point(c!), {
      upperDirection: upper.direction, lowerDirection: lower.direction, upperWorld: upper.world, lowerWorld: lower.world, bendNormal: normal,
    }, { previousNormal: history ?? (kind === 'Leg' && pelvis ? normal.clone().applyQuaternion(pelvis) : undefined), diagnostic: this.diagnosticSink ? (reason,value,threshold)=>this.report(side+kind,reason,value,threshold) : undefined });
    if (!solution) return;
    this.setGoal(side+'Upper'+kind,solution.upperWorld,timestamp);
    this.setGoal(side+'Lower'+kind,solution.lowerWorld,timestamp);
    // Do not seed persistent continuity from an arbitrary first straight pose.
    if (solution.flexion > MathUtils.degToRad(6) || history) this.limbPlanes.set(name,{normal:solution.planeNormal,timestamp});
  }
  private body(frame: TrackingFrame, settings: StudioSettings, now: number) {
    const poseTime = frame.samples.pose.timestamp;
    if(!frame.samples.pose.present)this.report('body','not_detected');
    else this.age('body',poseTime,now,'pose');
    if(settings.mode!=='standing')this.report('legs','disabled_by_mode');
    if(!settings.hands)this.report('hands','disabled_by_setting');
    else if(!frame.samples.hands.present)this.report('hands','not_detected');
    else this.age('hands',frame.samples.hands.timestamp,now,'hands');
    const p = frame.samples.pose.present && recent(poseTime, now) ? frame.pose : [];
    let pelvis: Quaternion | undefined;
    const fullTorso=[11,12,23,24].every(index=>confidence(p[index]));
    if (fullTorso) {
      const up = point(p[11]).add(point(p[12])).sub(point(p[23])).sub(point(p[24])).normalize();
      const left = point(p[11]).sub(point(p[12])).normalize();
      const forward = new Vector3().crossVectors(left,up).normalize(); left.crossVectors(up,forward).normalize();
      if (forward.lengthSq() > 0.5) {
        const q = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(left,up,forward));
        const e = new Euler().setFromQuaternion(q, 'YXZ');
        if(this.diagnosticSink)for(const [axis,limit]of [['x',.45],['y',.8],['z',.5]]as const)if(Math.abs(e[axis])>limit)this.report(`spine.${axis}`,'clamped',e[axis],limit);
        e.x=MathUtils.clamp(e.x,-0.45,0.45);e.y=MathUtils.clamp(e.y,-0.8,0.8);e.z=MathUtils.clamp(e.z-this.neutralTorsoRoll,-0.5,0.5);
        this.torsoGoals(new Quaternion().setFromEuler(e),poseTime);
        if (settings.mode === 'standing') {
          const hipLine = point(p[23]).sub(point(p[24])).normalize();
          const yaw=Math.atan2(-hipLine.z,hipLine.x),roll=Math.asin(MathUtils.clamp(hipLine.y,-1,1));
          if(Math.abs(yaw)>.8)this.report('hips.y','clamped',yaw,.8);
          if(Math.abs(roll)>.25)this.report('hips.z','clamped',roll,.25);
          const hipYaw = MathUtils.clamp(Math.atan2(-hipLine.z,hipLine.x),-.8,.8);
          const hipRoll = MathUtils.clamp(Math.asin(MathUtils.clamp(hipLine.y,-1,1)),-.25,.25);
          pelvis = new Quaternion().setFromEuler(new Euler(0,hipYaw,hipRoll,'YXZ'));
          const hips = this.rests.get('hips'); if (hips) this.setGoal('hips',pelvis.clone().multiply(hips.world),poseTime);else this.report('hips','missing_bone');
        }
      }else this.report('spine','degenerate_segment',forward.lengthSq(),.5);
    } else if(settings.mode==='seated'&&p.length){
      const roll=shoulderRoll(frame);
      if(roll!==null){
        const relative=roll-this.neutralTorsoRoll;
        this.limit('spine.z',relative,-.5,.5,'pose');
        this.torsoGoals(new Quaternion().setFromAxisAngle(new Vector3(0,0,1),MathUtils.clamp(relative,-.5,.5)),poseTime);
        this.diagnosticSink?.({stage:'torso.shoulders.roll',channel:'spine',reason:'accepted',accepted:true,sampleId:this.sampleIds.pose});
      }else this.report('spine','missing_landmark');
    }else this.points('spine',[p[11],p[12],p[23],p[24]],[11,12,23,24],'pose');
    for (const [side,s,e,w,h,k,a,t] of [['left',11,13,15,23,25,27,31],['right',12,14,16,24,26,28,32]] as const) {
      this.shoulder(side,poseTime,p,s,e);
      this.limb(side,'Arm',poseTime,p[s],p[e],p[w]);
      // Pose's wrist-to-index direction supplies a fallback when detailed hands disappear.
      const previousHand=this.goals.get(side+'Hand');
      if(!settings.hands||!previousHand||previousHand.task!=='hands'||now-previousHand.timestamp>=250)
        this.aim(side+'Hand',poseTime,p[w],p[side === 'left' ? 19 : 20],undefined,[w,side==='left'?19:20],'pose');
      if (settings.mode==='standing') { this.limb(side,'Leg',poseTime,p[h],p[k],p[a],pelvis);this.aim(side+'Foot',poseTime,p[a],p[t],undefined,[a,t],'pose'); }
    }
    if (settings.hands && frame.samples.hands.present && recent(frame.samples.hands.timestamp, now)) for (const [side, hand] of Object.entries(associateHands(frame.hands, p.length ? frame.poseImage : [], { imageAspect: frame.inputSize ? frame.inputSize.width / frame.inputSize.height : 1, diagnostic:this.context('hands') }))) {
      if (hand.world.length !== 21) {this.report(side+'Hand','missing_landmark');continue;}
      if(!this.points(side+'Hand',hand.world,hand.world.map((_,index)=>index),'hands'))continue;
      const rest = this.rests.get(side+'Hand'), palm = this.palms.get(side);
      if(!rest||!palm)this.report(side+'Hand','missing_bone');
      const rotation = rest && palm && palmWorldRotation(palm, { wrist: point(hand.world[0]), middle: point(hand.world[9]), index: point(hand.world[5]), little: point(hand.world[17]) }, rest.world, {diagnostic:this.context('hands',side+'Hand')});
      if (!rotation) continue;
      this.setGoal(side+'Hand', rotation, frame.samples.hands.timestamp);
      const palmDelta = rotation.clone().multiply(rest!.world.clone().invert());
      for (const [finger,start] of [['Thumb',1],['Index',5],['Middle',9],['Ring',13],['Little',17]] as const) {
        const segments = finger === 'Thumb' ? ['Metacarpal','Proximal','Distal'] : ['Proximal','Intermediate','Distal'];
        segments.forEach((part,i) => this.aim(side+finger+part,frame.samples.hands.timestamp,hand.world[start+i],hand.world[start+i+1],palmDelta,[start+i,start+i+1],'hands'));
      }
    }
  }
  private torsoGoals(delta:Quaternion,timestamp:number){
    const spine=this.rests.get('spine'),chest=this.rests.get('chest');
    if(spine)this.setGoal('spine',new Quaternion().slerp(delta,chest?.45:1).multiply(spine.world),timestamp);
    else this.report('spine','missing_bone');
    // Both goals use world space. The chest receives the total rotation once.
    if(chest)this.setGoal('chest',delta.clone().multiply(chest.world),timestamp);
  }
  private shoulder(side:'left'|'right',timestamp:number,p:Landmark[],s:number,e:number) {
    const name=side+'Shoulder',rest=this.rests.get(name),spine=this.rests.get('chest')??this.rests.get('spine'),torso=this.goals.get('chest')??this.goals.get('spine');
    if(!rest){this.report(name,'missing_bone');return;}
    if(!this.points(name,[p[11],p[12],p[s],p[e]],[11,12,s,e],'pose'))return;
    // Use the total torso rotation as the shoulder reference.
    const torsoDelta=spine&&torso?torso.world.clone().multiply(spine.world.clone().invert()):new Quaternion();
    const up=new Vector3(0,1,0).applyQuaternion(torsoDelta);
    const across=point(p[s]).sub(point(p[side==='left'?12:11]));
    const arm=point(p[e]).sub(point(p[s]));
    if(across.lengthSq()<1e-8||arm.lengthSq()<1e-8){this.report(name,'degenerate_segment');return;}
    // Shoulder points show tilt. Raised arms add a bounded clavicle estimate.
    const tilt=Math.asin(MathUtils.clamp(across.normalize().dot(up),-1,1));
    const lift=Math.max(0,Math.asin(MathUtils.clamp(arm.normalize().dot(up),-1,1)))*.3;
    const angle=tilt+lift;this.limit(name,angle,-.25,.45,'pose');
    const lateral=rest.direction.clone().normalize().applyQuaternion(torsoDelta);
    const axis=lateral.clone().cross(up).normalize();
    if(axis.lengthSq()<.5){this.report(name,'invalid_rest');return;}
    this.setGoal(name,new Quaternion().setFromAxisAngle(axis,MathUtils.clamp(angle,-.25,.45)).multiply(torsoDelta).multiply(rest.world),timestamp,'pose');
  }
  private gaze(frame:TrackingFrame|null,active:boolean,alpha:number) {
    for(const side of ['left','right'] as const){
      const name=side+'Eye',rest=this.rests.get(name);
      if(!rest){if(active)this.report(name,'missing_bone',undefined,undefined,'face');continue;}
      const suffix=side==='left'?'Left':'Right',face=active?frame!.face:{};
      const valid=active&&['In','Out','Up','Down'].every(direction=>Number.isFinite(face['eyeLook'+direction+suffix]));
      const value=(direction:string)=>coefficient(face['eyeLook'+direction+suffix]);
      const yaw=valid?(value('Out')-value('In'))*(side==='left'?1:-1)*.35:0;
      const pitch=valid?(value('Down')-value('Up'))*.25:0;
      const delta=new Quaternion().setFromEuler(new Euler(pitch,yaw,0,'YXZ'));
      const local=rest.local.clone().multiply(rest.world.clone().invert().multiply(delta).multiply(rest.world));
      rest.node.quaternion.slerp(local,alpha);rest.node.updateWorldMatrix(false,false);
      this.report(name,valid?'accepted':'not_detected',undefined,undefined,'face');
    }
  }
  update(frame: TrackingFrame | null, settings: StudioSettings, dt: number, now: number) {
    if(!frame)this.report('frame','not_detected');
    else this.age('frame',frame.timestamp,now,'pose');
    const fresh = frame !== null && frame.version === 1 && recent(frame.timestamp, now);
    const faceFresh = fresh && frame.samples.face.present && recent(frame.samples.face.timestamp, now);
    if(!faceFresh)this.headDiagnostic=null;
    const mode=settings.mode+':'+settings.hands;
    if(mode!==this.lastMode){this.goals.clear();this.limbPlanes.clear();this.lastTimestamp=-1;this.lastMode=mode;}
    const sink=this.diagnosticSink;
    if (fresh && frame.timestamp !== this.lastTimestamp) {
      this.sampleOutcomes=[];
      if(sink)this.diagnosticSink=outcome=>{this.sampleOutcomes.push(outcome);sink(outcome);};
      this.headDiagnostic=null;
      this.lastTimestamp = frame.timestamp; this.expressionGoals = {};
      for(const [name,goal]of this.goals)if(goal.task==='face'||!recent(goal.timestamp,now))this.goals.delete(name);
      this.body(frame,settings,now);
      if(!frame.samples.face.present)this.report('face','not_detected');else this.age('face',frame.samples.face.timestamp,now,'face');
      const face = faceFresh ? faceRotation(frame.faceMatrix) : null;
      if(faceFresh&&!face)this.report('head','invalid_value');
      if (face) {
        const rest = this.rests.get('head');
        if(!rest)this.report('head','missing_bone');
        const head = rest && calibratedHeadWorld(face, this.neutralHead, rest.world, { x: .65*settings.headRange, y: 1.1*settings.headRange, z: .5*settings.headRange }, this.context('face'));
        if (head) {
          if(this.diagnosticSink)this.headDiagnostic={raw:face.toArray(),neutralRelative:face.clone().multiply(this.neutralHead.clone().invert()).toArray(),limited:head.clone().multiply(rest!.world.clone().invert()).toArray(),applied:[]};
          this.setGoal('head',head,frame.samples.face.timestamp);
          const neck = this.rests.get('neck'), spine = this.rests.get('chest')??this.rests.get('spine'), torso = this.goals.get('chest')??this.goals.get('spine');
          if (neck) {
            const torsoDelta = torso && spine ? torso.world.clone().multiply(spine.world.clone().invert()) : new Quaternion();
            const headDelta = head.clone().multiply(rest!.world.clone().invert());
            this.setGoal('neck',torsoDelta.slerp(headDelta,.25).multiply(neck.world),frame.samples.face.timestamp);
          }else this.report('neck','missing_bone');
        }
      }
      if (faceFresh) {
        const blinkLeft=this.faceCoefficient('eyeBlinkLeft',frame.face.eyeBlinkLeft),blinkRight=this.faceCoefficient('eyeBlinkRight',frame.face.eyeBlinkRight);
        const jaw=this.faceCoefficient('jawOpen',frame.face.jawOpen)*settings.mouthGain;
        this.limit('aa',jaw,0,1,'face');
        this.expressionGoals={blinkLeft,blinkRight,aa:Math.min(jaw,1),happy:Math.min(this.faceCoefficient('mouthSmileLeft',frame.face.mouthSmileLeft),this.faceCoefficient('mouthSmileRight',frame.face.mouthSmileRight))*0.55};
      }
    } else if(fresh) {
      for(const outcome of this.sampleOutcomes)sink?.(outcome);
    }
    this.diagnosticSink=sink;
    const alpha = smoothingFactor(settings.smoothing,dt);
    // Snapshot before moving any parent. Smooth in world space, then convert through
    // the updated parent so torso motion is not added a second time to tracked limbs.
    this.vrm.scene.updateMatrixWorld(true);
    const currentWorlds = new Map([...this.rests].map(([name,rest]) => [name,rest.node.getWorldQuaternion(new Quaternion())]));
    for (const [name,rest] of this.rests) {
      if(name.endsWith('Eye'))continue;
      const measured = fresh ? this.goals.get(name) : undefined;
      const parent = rest.node.parent?.getWorldQuaternion(new Quaternion()) ?? new Quaternion();
      const rejected=!!measured&&!!frame&&frame.samples[measured.task].timestamp>measured.timestamp;
      if(rejected&&measured.lostAt===undefined)measured.lostAt=now;
      const valid=measured&&recent(measured.timestamp,now)&&(!rejected||now-measured.lostAt!<150);
      let goal = valid ? measured.world : undefined;
      if(name!=='hips')this.diagnosticSink?.({stage:'application',channel:name,reason:!goal?'decaying':rejected?'held':frame&&measured!.timestamp<frame.timestamp?'cached':'accepted',accepted:!!goal&&!rejected,sampleId:measured?.sampleId??this.sampleIds[this.task(name)]});
      if (!goal) {
        goal = (this.idleArms.get(name) ?? rest.local).clone();
        goal.premultiply(parent);
      }
      rest.node.quaternion.copy(parent.invert().multiply(currentWorlds.get(name)!.slerp(goal,alpha))).normalize();
      const fingerAxis = this.fingerAxes.get(name);
      if (fingerAxis) {
        const delta = rest.local.clone().invert().multiply(rest.node.quaternion);
        const limited = limitFingerRotation(delta, fingerAxis, name.endsWith('Proximal') ? 'proximal' : name.endsWith('Intermediate') ? 'intermediate' : 'distal',this.context('hands',name));
        rest.node.quaternion.copy(rest.local).multiply(limited);
      } else if (name.includes('Thumb')) {
        // Thumb opposition uses multiple axes; bound the total excursion separately.
        const delta = rest.local.clone().invert().multiply(rest.node.quaternion);
        const limit = name.endsWith('Metacarpal') ? 1.0 : 1.55;
        const angle = new Quaternion().angleTo(delta);
        if (angle > limit) {this.report(name,'clamped',angle,limit);rest.node.quaternion.copy(rest.local).multiply(new Quaternion().slerp(delta, limit / angle));}
      }
      rest.node.updateWorldMatrix(false,false);
    }
    this.gaze(frame,!!faceFresh,alpha);
    if (this.root) {
      const target = this.rootRest.clone();
      if (fresh && frame.samples.pose.present && recent(frame.samples.pose.timestamp,now) && settings.mode==='standing' && this.points('root',[frame.poseImage[23],frame.poseImage[24]],[23,24],'pose')) {
        const center=point(frame.poseImage[23]).add(point(frame.poseImage[24])).multiplyScalar(0.5);
        this.limit('root.x',(center.x-this.neutralRoot.x)*0.5,-.2,.2,'pose');
        this.limit('root.y',(center.y-this.neutralRoot.y)*0.3,-.12,.12,'pose');
        target.x+=MathUtils.clamp((center.x-this.neutralRoot.x)*0.5,-0.2,0.2);
        target.y+=MathUtils.clamp((center.y-this.neutralRoot.y)*0.3,-0.12,0.12);
        const inFrame = (p: Landmark | undefined,index:number) => {
          if(!this.points('ground',[p],[index],'pose'))return false;
          for(const axis of ['x','y']as const)if(p![axis]<0||p![axis]>1){this.report('ground','invalid_value',p![axis],p![axis]<0?0:1,'pose',index);return false;}
          return true;
        };
        if ([27,28].every(index => inFrame(frame.poseImage[index],index))) {
          const feet = ['leftFoot','rightFoot','leftToes','rightToes'].map(name => this.vrm.humanoid.getNormalizedBoneNode(name as VRMHumanBoneName)).filter((node): node is Object3D => !!node);
          if (feet.length) {
            const lowest = Math.min(...feet.map(node => node.getWorldPosition(new Vector3()).y));
            const scale = this.root.parent?.getWorldScale(new Vector3()).y ?? 1;
            if (Math.abs(scale) > 1e-5) {
              const value=this.root.position.y-this.rootRest.y + (this.groundY-lowest)/scale;
              this.limit('ground',value,-.35,.12,'pose');target.y = this.rootRest.y + MathUtils.clamp(value,-.35,.12);
            }else this.report('ground','invalid_rest',scale,1e-5,'pose');
          }else this.report('ground','missing_bone',undefined,undefined,'pose');
        }
        this.report('root','accepted',undefined,undefined,'pose');
      }else if(!fresh){if(frame)this.age('root',frame.timestamp,now,'pose');else this.report('root','not_detected',undefined,undefined,'pose');}
      else if(!frame.samples.pose.present)this.report('root','not_detected',undefined,undefined,'pose');
      else if(!recent(frame.samples.pose.timestamp,now))this.age('root',frame.samples.pose.timestamp,now,'pose');
      else if(settings.mode!=='standing')this.report('root','disabled_by_mode',undefined,undefined,'pose');
      this.root.position.lerp(target,alpha);
    }else this.report('root','missing_bone',undefined,undefined,'pose');
    if(this.diagnosticSink&&this.headDiagnostic)this.headDiagnostic.applied=this.rests.get('head')?.node.getWorldQuaternion(new Quaternion()).toArray()??[];
    for (const name of ['blinkLeft','blinkRight','aa','happy','surprised']) {
      const manual = this.manual === name ? 0.75 : 0;
      const target = Math.max(manual,faceFresh ? this.expressionGoals[name] ?? 0 : 0);
      const manager = this.vrm.expressionManager;
      // Rei supplies the surprise morph as a custom Japanese expression.
      const expression = name === 'surprised' && !manager?.getExpression(name) && manager?.getExpression('びっくり') ? 'びっくり' : name;
      const current = manager?.getValue(expression) ?? 0;
      manager?.setValue(expression,MathUtils.lerp(current,MathUtils.clamp(target,0,1),alpha));
    }
  }
}
