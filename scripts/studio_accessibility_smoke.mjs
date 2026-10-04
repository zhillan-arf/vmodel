import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {createServer} from 'vite';
const server=await createServer({server:{host:'127.0.0.1',port:0}});let browser;
try{
  await server.listen();browser=await chromium.launch({headless:true});const context=await browser.newContext(),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));const base=server.resolvedUrls.local[0];await page.goto(base+'tests/browser-host.html');
  const fixtures=await page.evaluate(async()=>{const{renderableFixture}=await import('/tests/fixtures/vrm.ts');return Promise.all([0,1].map(async i=>Array.from(new Uint8Array(await renderableFixture(i).arrayBuffer()))));});
  await context.route('**/avatars/*.vrm',route=>route.fulfill({contentType:'model/gltf-binary',body:Buffer.from(fixtures[0])}));
  await page.goto(base);await page.waitForFunction(()=>!!window.__vmodel);await page.locator('.studio-nav [data-view="library"]').click();
  await page.setInputFiles('#library-file',{name:'access.vrm',mimeType:'application/octet-stream',buffer:Buffer.from(fixtures[1])});await page.waitForFunction(()=>document.querySelector('#library-message').textContent==='Ready to save');
  await page.locator('#model-name').fill('Long model name '.repeat(5).trim());await page.locator('#acknowledge-terms').check();await page.locator('#save-model').click();
  await page.waitForFunction(()=>document.querySelectorAll('.model-card').length===3);
  const cases=[],failures=[],pairs=new Map();
  for(const width of [390,768,1440])for(const scale of [1,2])for(const view of ['library','observations','estimated','accepted','combined']){
    await page.setViewportSize({width,height:900});await page.evaluate(scale=>document.documentElement.style.zoom=String(scale),scale);
    await page.locator(`.studio-nav [data-view="${view==='library'?'library':'tracking'}"]`).click();
    if(view!=='library'){await page.locator('#inspector-layer').selectOption(view);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));for(const summary of await page.locator('.feature-panel:not([hidden]) summary').elementHandles())if(await summary.isVisible()&&!(await summary.evaluate(el=>el.parentElement.open)))await summary.click();}
    else for(const summary of await page.locator('.model-card summary').all())if(!(await summary.evaluate(el=>el.parentElement.open)))await summary.click();
    const result=await page.evaluate(()=>{
      const color=value=>{const parts=value.match(/[\d.]+/g)?.map(Number)??[0,0,0];return[...parts.slice(0,3),parts[3]??1];};
      const blend=(front,back)=>front.slice(0,3).map((v,i)=>v*front[3]+back[i]*(1-front[3]));
      const background=element=>{const chain=[];for(let node=element;node;node=node.parentElement)chain.unshift(node);let value=[255,255,255];for(const node of chain)value=blend(color(getComputedStyle(node).backgroundColor),value);return value;};
      const luminance=rgb=>rgb.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
      const pairs=[],badTargets=[];
      for(const element of document.querySelectorAll('.feature-panel:not([hidden]) *, .studio-nav *')){
        if(!element.checkVisibility()||element.closest('[hidden]')||element.matches(':disabled')||!Array.from(element.childNodes).some(node=>node.nodeType===Node.TEXT_NODE&&node.textContent.trim()))continue;
        const style=getComputedStyle(element),bg=background(element),fg=blend(color(style.color),bg),a=luminance(fg),b=luminance(bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
        const large=parseFloat(style.fontSize)>=24||(parseFloat(style.fontSize)>=18.66&&Number(style.fontWeight)>=700);
        pairs.push({text:element.textContent.slice(0,60),foreground:style.color,background:bg,ratio,required:large?3:4.5});
      }
      for(const element of document.querySelectorAll('.studio-nav button,.feature-panel:not([hidden]) button,.feature-panel:not([hidden]) select,.feature-panel:not([hidden]) input[type=number]')){
        if(!element.checkVisibility()||element.matches(':disabled'))continue;
        const style=getComputedStyle(element);if(style.borderTopStyle==='none'||parseFloat(style.borderTopWidth)===0)continue;
        const bg=background(element.parentElement),fg=blend(color(style.borderTopColor),bg),a=luminance(fg),b=luminance(bg);
        pairs.push({kind:'control-border',text:element.textContent.slice(0,60)||element.id,foreground:style.borderTopColor,background:bg,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),required:3});
      }
      for(const element of document.querySelectorAll('.studio-nav button,.feature-panel:not([hidden]) button.primary')){if(!element.checkVisibility())continue;const rect=element.getBoundingClientRect();if(rect.width<44||rect.height<44)badTargets.push(element.textContent);}
      return{panelLeft:document.querySelector('.feature-panel:not([hidden])').getBoundingClientRect().left,overflow:document.documentElement.scrollWidth>innerWidth,pairs,badTargets,offenders:[...document.querySelectorAll('body *')].filter(el=>el.checkVisibility()&&el.getBoundingClientRect().right>innerWidth+1).map(el=>({tag:el.tagName,id:el.id,className:typeof el.className==='string'?el.className:'',right:el.getBoundingClientRect().right})).slice(0,12)};
    });
    for(const pair of result.pairs){const key=JSON.stringify([pair.kind??'text',pair.foreground,pair.background,pair.required]);if(!pairs.has(key))pairs.set(key,pair);if(pair.ratio<pair.required)failures.push({width,scale,view,...pair});}
    if(result.overflow||result.badTargets.length)failures.push({width,scale,view,overflow:result.overflow,badTargets:result.badTargets,offenders:result.offenders});
    if(width===768&&scale===1&&result.panelLeft!==0)failures.push({width,scale,view,panelLeft:result.panelLeft});
    cases.push({width,scale,view,overflow:result.overflow,panelLeft:result.panelLeft});
  }
  await page.evaluate(()=>document.documentElement.style.zoom='1');
  await page.locator('.studio-nav [data-view="library"]').focus();await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>document.body.dataset.view),'library');
  const focus=await page.locator('.studio-nav [data-view="library"]').evaluate(el=>({visible:el.matches(':focus-visible'),outline:getComputedStyle(el).outlineStyle}));assert(focus.visible&&focus.outline!=='none');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.evaluate(()=>{window.panelTransitions=[];for(const type of ['transitionrun','transitionend'])document.addEventListener(type,event=>{if(event.target.classList.contains('feature-panel'))window.panelTransitions.push({type,property:event.propertyName,elapsed:event.elapsedTime});});});
  await page.locator('.studio-nav [data-view="tracking"]').click();
  const transition=await page.locator('.feature-panel:not([hidden])').evaluate(element=>({duration:getComputedStyle(element).transitionDuration,property:getComputedStyle(element).transitionProperty}));
  assert.equal(transition.duration,'0.15s');assert.equal(transition.property,'opacity');
  await page.waitForFunction(()=>window.panelTransitions.some(event=>event.type==='transitionend'&&event.property==='opacity'),null,{timeout:2000});
  transition.events=await page.evaluate(()=>window.panelTransitions);
  assert(transition.events.some(event=>event.type==='transitionend'&&event.elapsed===.15));
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.locator('.studio-nav [data-view="library"]').click();
  const reduced=await page.locator('.feature-panel:not([hidden])').evaluate(element=>({duration:getComputedStyle(element).transitionDuration,animations:element.getAnimations().length}));
  assert.equal(reduced.duration,'0s');assert.equal(reduced.animations,0);
  const report={panelTransition:transition,reducedMotion:reduced,generatedAt:new Date().toISOString(),browser:browser.version(),cases,textPairs:[...pairs.values()].filter(pair=>!pair.kind),controlPairs:[...pairs.values()].filter(pair=>pair.kind),failures,keyboardNavigation:true,focus,errors,
    limits:['CSS zoom at 1 and 2. This does not certify browser zoom or screen-reader behavior.','Solid text backgrounds and control borders only. Canvas graphics and disabled controls are outside this check.']};
  await writeFile('ops/001-zhil/sprint-001/reports/studio-accessibility-smoke.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({failureCount:failures.length,firstFailures:failures.slice(0,8),errors},null,2));assert.equal(failures.length,0,'See studio-accessibility-smoke.json for failed cases.');assert.deepEqual(errors,[]);
}finally{await browser?.close();await server.close();}
