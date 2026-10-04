import { readdir, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const root=await realpath('dist'),files=[];
async function walk(folder) {
  for(const entry of await readdir(folder,{withFileTypes:true})) {
    const target=path.join(folder,entry.name),resolved=await realpath(target);
    assert(resolved.startsWith(root+path.sep),'Bundle symlink escapes the build directory.');
    if(entry.isDirectory())await walk(target);
    else {
      const relative=path.relative(root,target).replaceAll('\\','/');
      assert(relative==='index.html'||/^assets\/[^/]+\.(js|css)$/.test(relative)||/^runtime\/(?:wasm\/[\w.]+\.(js|wasm)|[\w.]+\.task)$/.test(relative)||/^avatars\/(ene|rei)\.vrm$/.test(relative)||/^avatars\/thumbnails\/(?:[a-f0-9]{64}\.png|manifest\.json)$/.test(relative)||/^avatars\/rei-notices\/(readme\.txt|log\.txt|provenance\.json)$/.test(relative)||/^notices\/[^/]+\.(txt|json)$/.test(relative),`Unexpected served file: ${relative}`);
      files.push({path:relative,bytes:(await stat(target)).size});
    }
  }
}
await walk(root);
const hash=async target=>createHash('sha256').update(await readFile(target)).digest('hex');
assert.equal(await hash(path.join(root,'avatars/ene.vrm')),await hash('assets/avatars/ene.vrm'),'Bundled avatar differs from validated local artifact.');
assert.equal(await hash(path.join(root,'avatars/rei.vrm')),await hash('assets/avatars/rei.vrm'),'Bundled Rei differs from the prepared local artifact.');
const thumbnails=JSON.parse(await readFile(path.join(root,'avatars/thumbnails/manifest.json'),'utf8'));
for(const id of ['ene','rei']){
  const item=thumbnails[id];
  assert(item&&/^[a-f0-9]{64}$/.test(item.modelHash)&&/^[a-f0-9]{64}$/.test(item.thumbnailHash),`Missing thumbnail provenance: ${id}`);
  assert.equal(item.modelHash,await hash(path.join(root,`avatars/${id}.vrm`)),`Thumbnail model mismatch: ${id}`);
  const filename=path.join(root,`avatars/thumbnails/${item.modelHash}.png`);
  assert.equal(await hash(filename),item.thumbnailHash,`Thumbnail hash mismatch: ${id}`);
  const png=await readFile(filename);
  assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.equal(png.readUInt32BE(16),320);assert.equal(png.readUInt32BE(20),320);
}
const reiProvenance=JSON.parse(await readFile(path.join(root,'avatars/rei-notices/provenance.json'),'utf8'));
assert.equal(await hash(path.join(root,'avatars/rei.vrm')),reiProvenance.vrmSha256,'Rei differs from its source provenance.');
for(const name of ['readme.txt','log.txt','provenance.json'])assert.equal(await hash(path.join(root,'avatars/rei-notices',name)),await hash(path.join('public/avatars/rei-notices',name)),`Rei notice mismatch: ${name}`);
for(const asset of JSON.parse(await readFile('config/runtime-assets.json','utf8')))assert.equal(await hash(path.join(root,'runtime',asset.name)),asset.sha256,`Runtime hash mismatch: ${asset.name}`);
const notices=JSON.parse(await readFile(path.join(root,'notices/index.json'),'utf8'));
for(const item of notices.packages)assert.equal(await hash(path.join(root,'notices',item.notice)),item.sha256,`Notice hash mismatch: ${item.name}`);
assert.equal(await hash(path.join(root,'notices/tracking-models.json')),await hash('config/model-notices.json'));
const result={date:new Date().toISOString(),scope:'Static served build only; does not scan unrelated files or certify future changes.',checks:{onlyDesignatedFiles:true,avatarMatchesPreparedArtifact:true,thumbnailHashesMatch:true,runtimeHashesMatch:true,noticesPresent:true},runtimePackages:notices.packages.length,files:files.sort((a,b)=>a.path.localeCompare(b.path))};
await writeFile('ops/reports/bundle-audit.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({checks:result.checks,files:files.length,runtimePackages:notices.packages.length}));
