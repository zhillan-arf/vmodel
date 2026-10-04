export const observationColors = {
  outline: '#101827', accepted: '#7CE1BE', rejected: '#FFD18A',
  stale: '#879B99', point: '#E4EAF5', selected: '#60DCEA',
} as const;

type Point = {x:number;y:number};

export function drawObservationEdge(context:CanvasRenderingContext2D,a:Point,b:Point,rejected:boolean,stale:boolean){
  context.globalAlpha=1;
  context.setLineDash(rejected?[6,5]:[]);
  context.beginPath();context.moveTo(a.x,a.y);context.lineTo(b.x,b.y);
  context.strokeStyle=observationColors.outline;context.lineWidth=6;context.stroke();
  context.strokeStyle=stale?observationColors.stale:rejected?observationColors.rejected:observationColors.accepted;
  context.lineWidth=2;context.stroke();
}

export function drawObservationPoint(context:CanvasRenderingContext2D,point:Point,selected:boolean,stale:boolean){
  context.globalAlpha=1;context.setLineDash([]);
  context.beginPath();context.arc(point.x,point.y,selected?6:2,0,Math.PI*2);
  context.strokeStyle=observationColors.outline;context.lineWidth=4;context.stroke();
  context.fillStyle=stale?observationColors.stale:selected?observationColors.selected:observationColors.point;
  context.fill();
}
