import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat, realpath, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createOutputLayoutHandler } from './output-layout.mjs';
const root=await realpath(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../dist'));
const port=Number(process.env.VMODEL_PORT??4173);
const outputLayout = createOutputLayoutHandler(port);
const policy=JSON.parse(await readFile(new URL('../config/http-policy.json',import.meta.url),'utf8'));
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.wasm':'application/wasm','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.vrm':'model/gltf-binary','.task':'application/octet-stream'};
const server=http.createServer(async(req,res)=>{
  // Apply to worker scripts too: workers enforce the policy on their own response.
  for(const [name,value] of Object.entries(policy))res.setHeader(name,value);
  if(req.headers.host!==`127.0.0.1:${port}`&&req.headers.host!==`localhost:${port}`){res.writeHead(403);res.end();return;}
  if(await outputLayout(req,res))return;
  if(!['GET','HEAD'].includes(req.method??'')){res.writeHead(405);res.end();return;}
  if(req.url==='/health'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({application:'vmodel',version:'0.1.0'}));return;}
  try{
    const pathname=decodeURIComponent(new URL(req.url??'/',`http://127.0.0.1:${port}`).pathname);
    const requested=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if(!requested.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
    const file=await realpath(requested);
    if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
    const info=await stat(file);if(!info.isFile())throw new Error('Not a file');
    res.writeHead(200,{'Content-Type':types[path.extname(file)]??'application/octet-stream','Content-Length':info.size,
      'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cache-Control':file.endsWith('.html')?'no-cache':'private, max-age=3600'});
    if(req.method==='HEAD'){res.end();return;}
    createReadStream(file).on('error',()=>res.destroy()).pipe(res);
  }catch{res.writeHead(404,{'Content-Type':'text/plain'});res.end('File not found.');}
});
server.on('error',error=>{console.error(error.code==='EADDRINUSE'?`Port ${port} is in use. Close the other app or choose VMODEL_PORT.`:error);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(`Ene Studio is ready at http://127.0.0.1:${port}`));
