import {mkdir,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

export async function captureVisualState(page,group,state){
  const directory=`ops/reports/local/visual-states/${group}`;
  await mkdir(directory,{recursive:true});
  const original=page.viewportSize(),images=[];
  try{
    for(const viewport of [{width:390,height:844},{width:768,height:1024},{width:1440,height:900}]){
      await page.setViewportSize(viewport);
      await page.evaluate(async()=>{await Promise.all(document.getAnimations().filter(animation=>animation.effect?.getTiming().iterations!==Infinity).map(animation=>animation.finished.catch(()=>{})));});
      await page.evaluate(()=>{window.scrollTo(0,0);return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
      const path=`${directory}/${state}-${viewport.width}.png`;
      await page.screenshot({path,fullPage:true});
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
      images.push({state,viewport,path,sha256:createHash('sha256').update(await readFile(path)).digest('hex'),horizontalOverflow:overflow});
    }
  }finally{if(original)await page.setViewportSize(original);}
  return images;
}
