import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
import {createServer} from 'vite';
const manifest=JSON.parse(await readFile('config/import-fixture.json','utf8'));
const files=await Promise.all(manifest.files.map(async entry=>{const bytes=await readFile(`${manifest.directory}/${entry.name}`);assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256);return bytes;}));
const server=await createServer({server:{host:'127.0.0.1',port:0}});let browser;
try{
  await mkdir('ops/reports/local',{recursive:true});
  await server.listen();browser=await chromium.launch({headless:true});const page=await browser.newPage(),errors=[],externalRequests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url())&&new URL(r.url()).hostname!=='127.0.0.1')externalRequests.push(r.url());});
  await page.route('**/testing/fixture/*',route=>route.fulfill({body:files[route.request().url().endsWith('.vrm')?0:1]}));
  await page.route('**/avatars/*.vrm',route=>route.fulfill({status:404,body:'No bundled model in this test'}));
  await page.goto(server.resolvedUrls.local[0]+'tests/browser-host.html');
  const result=await page.evaluate(async()=>{
    const{LocalModelRepository}=await import('/src/model-repository.ts');const{AvatarViewer}=await import('/src/viewer.ts');const{defaults}=await import('/src/types.ts');const{sha256}=await import('/src/model-types.ts');
    const repo=new LocalModelRepository(),signal=new AbortController().signal;
    const blob=await(await fetch('/testing/fixture/Seed-san.vrm')).blob(),terms=await(await fetch('/testing/fixture/README.md')).blob();
    const inspection=await repo.inspect(blob,signal),container=document.createElement('div');container.style.cssText='width:640px;height:640px';document.body.append(container);const viewer=new AvatarViewer(container,defaults);
    const gl=viewer.renderer.getContext(),allocations=new Map(),uniforms=new Map(),getUniform=gl.getUniformLocation.bind(gl),setInt=gl.uniform1i.bind(gl);let uniformName='';gl.getUniformLocation=(program,name)=>{const location=getUniform(program,name);uniforms.set(location,name);return location;};gl.uniform1i=(location,value)=>{uniformName=uniforms.get(location);setInt(location,value);};const create=gl.createTexture.bind(gl),remove=gl.deleteTexture.bind(gl);gl.createTexture=()=>{const value=create();allocations.set(value,uniformName);return value;};gl.deleteTexture=value=>{allocations.delete(value);remove(value);};
    try{
      const prepared=await viewer.prepareAvatar(blob,signal);viewer.commitAvatar(prepared);viewer.draw(0);
      const termsHash=await sha256(terms);
      const entry=await repo.register({inspection,displayName:'Seed-san',originalFilename:'Seed-san.vrm',attachments:[{id:crypto.randomUUID(),modelId:'',kind:'terms',originalFilename:'README.md',mediaType:'text/plain',blob:terms,sha256:termsHash,encoding:'utf-8'}],acknowledgment:{acknowledgedAt:new Date().toISOString(),metadataDigest:await sha256(new Blob([JSON.stringify(inspection.rawMeta)])),attachmentHashes:[termsHash]}},signal);
      const exported=await sha256(await repo.export(entry.id)),attachments=await repo.attachments(entry.id);
      const output={hash:inspection.hash,exported,bytes:blob.size,metadata:inspection.rawMeta,resources:inspection.resources,capabilities:prepared.capabilities,termsHash,storedTermsHash:await sha256(attachments[0].blob),drawCalls:viewer.renderer.info.render.calls};
      await repo.remove(entry.id);viewer.dispose();output.afterDispose={...viewer.renderer.info.memory};output.remainingTextureAllocations=[...allocations.values()];output.contextLost=gl.isContextLost();return output;
    }finally{viewer.dispose();repo.close();}
  });
  await writeFile('ops/reports/local/licensed-import-debug.json',JSON.stringify(result,null,2)+'\n');
  assert.equal(result.hash,manifest.files[0].sha256);assert.equal(result.exported,result.hash);assert.equal(result.capabilities.vrmVersion,'1');assert.equal(result.termsHash,manifest.files[1].sha256);assert.equal(result.storedTermsHash,result.termsHash);assert(result.drawCalls>0);assert.equal(result.afterDispose.geometries,0);assert.deepEqual(result.remainingTextureAllocations,['dfgLUT']);assert.equal(result.contextLost,true);assert.deepEqual(errors,[]);assert.deepEqual(externalRequests,[]);
  const report={generatedAt:new Date().toISOString(),browser:browser.version(),source:manifest,...result,errors,externalRequests,limits:['Local import and preparation check. No target-laptop or human appearance acceptance.','The renderer retains one internal lighting-table counter after disposal. The graphics context is explicitly lost.']};
  await writeFile('ops/reports/licensed-import-smoke.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await browser?.close();await server.close();}
