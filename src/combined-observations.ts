import { FaceLandmarker, HandLandmarker, PoseLandmarker } from '@mediapipe/tasks-vision';
import type { DiagnosticEnvelope, TrackingTask } from './tracking-diagnostics';
import type { Landmark, TrackingFrame } from './types';

export interface ObservationGroup { task:TrackingTask; points:Landmark[]; edges:readonly {start:number;end:number}[] }
export function isCombinedCapture(diagnostics:DiagnosticEnvelope) {
  return Object.values(diagnostics.tasks).every(task=>task.state==='disabled'||task.captureSequence===diagnostics.captureSequence);
}
export function combinedObservations(frame:TrackingFrame,diagnostics:DiagnosticEnvelope):ObservationGroup[] {
  const groups:ObservationGroup[]=[];
  const available=(task:TrackingTask)=>diagnostics.tasks[task].present&&diagnostics.tasks[task].state!=='disabled'&&diagnostics.tasks[task].captureSequence===diagnostics.captureSequence;
  if(available('pose'))groups.push({task:'pose',points:frame.poseImage,edges:PoseLandmarker.POSE_CONNECTIONS});
  if(available('face'))groups.push({task:'face',points:diagnostics.tasks.face.observations?.[0]??[],edges:FaceLandmarker.FACE_LANDMARKS_TESSELATION});
  if(available('hands'))for(const hand of frame.hands)groups.push({task:'hands',points:hand.landmarks,edges:HandLandmarker.HAND_CONNECTIONS});
  return groups;
}
