import type { HandObservation } from '../../src/types';

export function gestureHand(side:'left'|'right',gesture:string):HandObservation{
  const sign=side==='left'?1:-1;
  const world=Array.from({length:21},()=>({x:0,y:0,z:0,visibility:0}));
  for(const [finger,start,x]of [['Thumb',1,-.05],['Index',5,-.03],['Middle',9,0],['Ring',13,.02],['Little',17,.04]]as const){
    const bent=gesture==='fist'||gesture==='point'&&finger!=='Index'||gesture==='peace'&&(finger==='Ring'||finger==='Little');
    world[start]={x:x*sign,y:-.08,z:0,visibility:0};
    let angle=0;
    for(let part=1;part<=3;part++){
      angle+=bent?[.8,1,.5][part-1]:0;
      const previous=world[start+part-1];
      world[start+part]={x:previous.x,y:previous.y-.025*Math.cos(angle),z:previous.z-.025*Math.sin(angle),visibility:0};
    }
  }
  return{side,score:.99,world,landmarks:Array.from({length:21},()=>({x:side==='left'?.7:.3,y:.3,z:0,visibility:0}))};
}
