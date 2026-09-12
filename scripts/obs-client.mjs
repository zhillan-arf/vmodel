import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

export async function connectOBS() {
  const config = JSON.parse((await readFile(new URL('../.tools/obs/config/obs-studio/plugin_config/obs-websocket/config.json', import.meta.url),'utf8')).replace(/^\uFEFF/,''));
  const ws = new WebSocket(`ws://127.0.0.1:${config.server_port ?? 4455}`, 'obswebsocket.json');
  const pending = new Map();
  let resolveReady, rejectReady;
  const ready = new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});
  const startup = setTimeout(()=>rejectReady(new Error('OBS did not complete its local handshake.')),10000);
  const hash = text => createHash('sha256').update(text).digest('base64');
  ws.addEventListener('message', event => {
    const message=JSON.parse(event.data);
    if(message.op===0){
      const auth=message.d.authentication;
      ws.send(JSON.stringify({op:1,d:{rpcVersion:1,eventSubscriptions:0,...(auth?{authentication:hash(hash(config.server_password+auth.salt)+auth.challenge)}:{})}}));
    } else if(message.op===2){clearTimeout(startup);resolveReady();}
    else if(message.op===7){
      const request=pending.get(message.d.requestId);if(!request)return;
      clearTimeout(request.timer);pending.delete(message.d.requestId);
      if(message.d.requestStatus.result)request.resolve(message.d.responseData??{});
      else request.reject(new Error(`${message.d.requestType}: ${message.d.requestStatus.code} ${message.d.requestStatus.comment??''}`));
    }
  });
  const failed = () => {
    clearTimeout(startup);rejectReady(new Error('Local OBS connection closed.'));
    for(const request of pending.values()){clearTimeout(request.timer);request.reject(new Error('Local OBS connection closed.'));}
    pending.clear();
  };
  ws.addEventListener('error',failed);ws.addEventListener('close',failed);
  try { await ready; } catch(error) { ws.close();throw error; }
  return {
    request(requestType,requestData={}){
      return new Promise((resolve,reject)=>{
        const requestId=randomUUID();
        const timer=setTimeout(()=>{pending.delete(requestId);reject(new Error(`OBS timed out: ${requestType}`));},10000);
        pending.set(requestId,{resolve,reject,timer});
        ws.send(JSON.stringify({op:6,d:{requestType,requestId,requestData}}));
      });
    },
    close(){ws.close();},
  };
}
