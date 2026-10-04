import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, writeFile, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { build } from 'vite';

export const baselineCommit='da48542e991aa202a1b9eaafc1a4f1cbb22ef7b9';
export async function prepareTrackingBaseline(){
  const root=process.cwd();await mkdir('.cache',{recursive:true});
  const directory=await mkdtemp(path.join(root,'.cache','tracking-baseline-'));
  const files=execFileSync('git',['ls-tree','-r','--name-only',baselineCommit],{encoding:'utf8'}).trim().split('\n')
    .filter(name=>name.startsWith('src/')||name.startsWith('config/')||['index.html','package.json'].includes(name));
  for(const name of files){
    const target=path.join(directory,name);await mkdir(path.dirname(target),{recursive:true});
    await writeFile(target,execFileSync('git',['show',`${baselineCommit}:${name}`],{maxBuffer:16*1024*1024}));
  }
  await mkdir(path.join(directory,'scripts'),{recursive:true});
  for(const name of ['server.mjs','output-layout.mjs','windows-browser.mjs'])await copyFile(path.join(root,'scripts',name),path.join(directory,'scripts',name));
  await build({root:directory,configFile:false,publicDir:path.join(root,'public'),worker:{format:'es'},build:{target:'es2022',outDir:'dist'}});
  return directory;
}
