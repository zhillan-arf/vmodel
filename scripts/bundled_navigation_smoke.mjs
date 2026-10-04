import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
import {createServer} from 'vite';
const server=await createServer({server:{host:'127.0.0.1',port:0}});let browser;
try{
  await server.listen();
  browser=await chromium.launch({headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
  const results=[];
  for(const model of ['ene','rei']){
  const context=await browser.newContext({permissions:['camera'],viewport:{width:1440,height:900}});
  const errors=[],externalRequests=[];
  await context.addInitScript(model=>{if(location.protocol==='http:')localStorage.setItem('vmodel-avatar',model);},model);
  context.on('page',page=>page.on('pageerror',error=>errors.push(error.message)));
  context.on('request',request=>{if(/^https?:/.test(request.url())&&new URL(request.url()).hostname!=='127.0.0.1')externalRequests.push(request.url());});
  const page=await context.newPage();await page.goto(server.resolvedUrls.local[0]);
  await page.waitForFunction(()=>!!window.__vmodel,null,{timeout:180000});
  const popup=page.waitForEvent('popup');await page.locator('#output').click();const output=await popup;
  await output.waitForFunction(()=>!!window.__vmodel,null,{timeout:180000});
  await page.locator('[data-view="tracking"]').click();await page.locator('#inspector-start-camera').click();
  await page.waitForFunction(()=>window.__vmodel.getStats().sequence>=4,null,{timeout:90000});
  await page.locator('[data-view="studio"]').click();
  await mkdir('ops/reports/local/bundled-navigation',{recursive:true});

    await page.waitForFunction(model=>window.__vmodel.getState().selectedBundle===model,model,{timeout:180000});
    const state=await page.evaluate(()=>window.__vmodel.getState());
    await output.waitForFunction(id=>window.__vmodel.getState().avatarId===id,state.avatarId,{timeout:180000});
    await page.evaluate(()=>{window.navigationReferences={vrm:window.__vmodel.viewer.vrm,stream:document.querySelector('#camera-video').srcObject};});
    await output.evaluate(()=>{window.navigationVRM=window.__vmodel.viewer.vrm;});
    const checks=[];
    for(const view of ['library','tracking','studio']){
      const sequence=await page.evaluate(()=>window.__vmodel.getStats().sequence);
      const button=page.locator(`[data-view="${view}"]`);await button.focus();await page.keyboard.press('Enter');
      await page.waitForFunction(sequence=>window.__vmodel.getStats().sequence>sequence,sequence,{timeout:60000});
      await output.waitForFunction(sequence=>window.__vmodel.getStats().sequence>sequence,sequence,{timeout:60000});
      assert.deepEqual(await page.evaluate(()=>window.__vmodel.getState()),state);
      const stable=await page.evaluate(()=>({model:window.navigationReferences.vrm===window.__vmodel.viewer.vrm,camera:window.navigationReferences.stream===document.querySelector('#camera-video').srcObject,live:window.navigationReferences.stream.getVideoTracks()[0].readyState==='live'}));
      assert.deepEqual(stable,{model:true,camera:true,live:true});
      assert.equal(await output.evaluate(()=>window.navigationVRM===window.__vmodel.viewer.vrm),true);
      assert.deepEqual(await output.evaluate(()=>window.__vmodel.getState().settings),state.settings);
      for(const viewport of [{width:390,height:844},{width:768,height:1024},{width:1440,height:900}]){
        await page.setViewportSize(viewport);
        await page.screenshot({path:`ops/reports/local/bundled-navigation/${model}-${view}-${viewport.width}.png`});
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      }
      checks.push({view,stable,outputModelPreserved:true,settingsPreserved:true});
    }
    const bytes=await readFile(`public/avatars/${model}.vrm`);
    assert.deepEqual(errors,[]);assert.deepEqual(externalRequests,[]);
    results.push({model,errors,externalRequests,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),checks});
    console.log(`${model}: all views preserve model, camera, settings, and output.`);
  await page.locator('#stop').click();
  await context.close();
  }
  const report={generatedAt:new Date().toISOString(),browser:browser.version(),results,limits:['Actual bundled model files and simulated camera input.','Screenshots require human review. No physical camera or target-laptop acceptance.']};
  await writeFile('ops/reports/bundled-navigation-smoke.json',JSON.stringify(report,null,2)+'\n');
}finally{await browser?.close();await server.close();}
