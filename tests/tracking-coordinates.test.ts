import {it,expect} from 'vitest';
import {containedPoint,displayPoint} from '../src/tracking-inspector';
it.each([[390,844],[768,1024],[1440,900]])('fits corners and applies one mirror at %s by %s',(width,height)=>{
  const input={width:640,height:480},scale=Math.min(width/640,height/480),left=(width-640*scale)/2,top=(height-480*scale)/2;
  expect(containedPoint({x:0,y:0},input,width,height,false)).toEqual({x:left,y:top});
  expect(containedPoint({x:1,y:1},input,width,height,false)).toEqual({x:left+640*scale,y:top+480*scale});
  expect(containedPoint({x:0,y:0},input,width,height,true)).toEqual({x:left+640*scale,y:top});
});
it('maps SDK depth to the display basis without scaling bone lengths',()=>{expect(displayPoint({x:1,y:2,z:3})).toEqual({x:1,y:-2,z:-3});expect(displayPoint({x:0,y:.42,z:0})).toEqual({x:0,y:-.42,z:-0});});
