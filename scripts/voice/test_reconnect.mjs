// Deterministic clock/socket/worklet tests; no browser, network or audio devices.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const source=(await fs.readFile(new URL('./studio/player.js',import.meta.url),'utf8')).replace('export class ConvertedPlayer','class ConvertedPlayer')+'\nglobalThis.Player=ConvertedPlayer;';
const results=[];
function fixture(kind='converted',reconnect=true) {
  let now=0,next=1;const timers=new Map(),sockets=[],messages=[],errors=[],contexts=[];
  const schedule=(fn,delay,interval=false)=>{const id=next++;timers.set(id,{fn,at:now+delay,interval:interval?delay:0});return id;};
  const advance=ms=>{const end=now+ms;for(let n=0;n<20000;n++){const entry=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!entry){now=end;return;}const[id,t]=entry;now=t.at;if(t.interval)t.at+=t.interval;else timers.delete(id);t.fn();}throw Error('Timer loop exceeded test bound');};
  class Socket {
    constructor(url){this.url=url;this.readyState=0;this.sent=[];sockets.push(this);}
    send(value){this.sent.push(value);}
    open(){this.readyState=1;this.onopen?.();}
    message(data){this.onmessage?.({data});}
    serverClose(code=1006){this.readyState=3;this.onclose?.({code});}
    close(){this.readyState=3;}
  }
  class Context {
    constructor({sampleRate}){this.sampleRate=sampleRate;this.destination={};this.audioWorklet={addModule:async()=>{}};this.closed=false;contexts.push(this);}
    resume(){return Promise.resolve();}close(){this.closed=true;return Promise.resolve();}
    createGain(){return{gain:{value:1},connect:node=>node};}
  }
  const sandbox={ArrayBuffer,DataView,Float32Array,Uint8Array,Number,Math,JSON,Set,
    Date:{now:()=>1700000000000+now},performance:{now:()=>now},location:{pathname:'/test',host:'127.0.0.1:5999'},
    setTimeout:(fn,ms)=>schedule(fn,ms),clearTimeout:id=>timers.delete(id),setInterval:(fn,ms)=>schedule(fn,ms,true),clearInterval:id=>timers.delete(id),
    WebSocket:Socket,AudioContext:Context,AudioWorkletNode:class{constructor(){this.port={postMessage:m=>messages.push(m)};}connect(node){return node;}}};
  vm.runInNewContext(source,sandbox);
  const player=new sandbox.Player({routeId:kind+'-route',outputKey:'private-test-only'},()=>{},e=>errors.push(e),kind,{reconnect});
  const state=(epoch=7,muted=false)=>JSON.stringify({type:'state',routeId:kind+'-route',outputKind:kind==='natural'?'VMNA':'VMOA',epoch,producerId:muted?null:'owner',mode:muted?'idle':kind==='natural'?'natural':'reference',muted,sampleRate:40000,chunkSamples:6400,reset:true});
  const frame=(epoch=7,seq=0)=>{const data=new ArrayBuffer(25624),v=new DataView(data);new Uint8Array(data,0,4).set(kind==='natural'?[86,77,78,65]:[86,77,79,65]);v.setUint32(4,epoch,true);v.setUint32(8,seq,true);v.setUint32(12,40000,true);v.setFloat64(16,sandbox.Date.now(),true);new Float32Array(data,24).fill(.1);return data;};
  return{player,sockets,messages,errors,contexts,timers,advance,state,frame};
}
async function test(name,run){await run();results.push(name);}

await test('Both receiver kinds reauthenticate; old socket and pre-state PCM stay muted',async()=>{
  for(const kind of ['converted','natural']) {
    const f=fixture(kind);await f.player.connect();const old=f.sockets[0];old.open();
    assert.equal(old.sent.length,1);assert.deepEqual(JSON.parse(old.sent[0]),{routeId:kind+'-route',outputKey:'private-test-only'});
    old.message(f.state());old.message(f.frame());assert.equal(f.messages.at(-1).type,'pcm');
    const lateMessage=old.onmessage,lateOpen=old.onopen,lateClose=old.onclose;
    old.serverClose();assert.equal(f.player.allow,false);assert.equal(f.messages.at(-1).type,'reset');
    f.advance(499);assert.equal(f.sockets.length,1);f.advance(1);assert.equal(f.sockets.length,2);
    const fresh=f.sockets[1];fresh.open();const before=f.messages.length;
    lateMessage({data:f.state()});lateOpen();lateClose({code:1006});
    assert.equal(f.messages.length,before);assert.equal(old.sent.length,1);assert.equal(f.sockets.length,2);
    fresh.message(f.frame());assert.equal(f.messages.at(-1).type,'reset');assert.equal(f.player.allow,false);
    fresh.message(f.state(19,true));fresh.message(f.frame(19));assert.equal(f.messages.at(-1).type,'reset');
    fresh.message(f.state(20));fresh.message(f.frame(7));assert.equal(f.messages.at(-1).type,'reset');
    fresh.message(f.frame(20));assert.equal(f.messages.at(-1).type,'pcm');assert.equal(f.contexts.length,1);
    assert(f.sockets.every(s=>s.url.endsWith(kind==='natural'?'/ws/natural-output':'/ws/output')));
    assert(f.errors.every(e=>e.startsWith(kind==='natural'?'Natural':'Converted')));
    await f.player.close();assert.equal(f.timers.size,0);assert(f.contexts[0].closed);
  }
});
await test('Authentication/protocol rejection and malformed state stop retry',async()=>{
  for(const mode of ['auth','json','route','kind']) {
    const f=fixture();await f.player.connect();const ws=f.sockets[0];ws.open();
    if(mode==='auth')ws.serverClose(1008);
    else if(mode==='json')ws.message('{');
    else {const s=JSON.parse(f.state());s[mode==='route'?'routeId':'outputKind']='wrong';ws.message(JSON.stringify(s));}
    assert.equal(f.player.allow,false);f.advance(150000);assert.equal(f.sockets.length,1);
    assert(f.errors.at(-1).includes('Verify'));await f.player.close();assert.equal(f.timers.size,0);
  }
});
await test('Error mutes immediately; connection and heartbeat timeouts reconnect',async()=>{
  const f=fixture();await f.player.connect();f.advance(5000);assert.equal(f.player.ws,null);f.advance(500);
  const ws=f.sockets[1];ws.open();ws.message(f.state());ws.message(f.frame());ws.onerror();
  assert.equal(f.player.allow,false);assert.equal(f.messages.at(-1).type,'reset');f.advance(1000);
  const next=f.sockets[2];next.open();next.message(f.state());f.advance(3100);assert.equal(f.player.allow,false);assert.equal(f.player.ws,null);
  await f.player.close();assert.equal(f.timers.size,0);
});
await test('Retry count/time are bounded and close cancels pending retry',async()=>{
  const f=fixture();await f.player.connect();f.sockets[0].serverClose();
  for(let i=0;i<1200;i++){f.advance(100);const ws=f.player.ws;if(ws)ws.serverClose();}
  assert.equal(f.sockets.length,13);assert(f.errors.at(-1).includes('retry limit'));assert.equal(f.player.retryTimer,null);
  await f.player.close();assert.equal(f.timers.size,0);
  const closing=fixture();await closing.player.connect();closing.sockets[0].serverClose();await closing.player.close();closing.advance(120000);assert.equal(closing.sockets.length,1);assert.equal(closing.timers.size,0);
  const hung=fixture();await hung.player.connect();hung.advance(130000);assert.equal(hung.player.ws,null);assert(hung.errors.at(-1).includes('retry limit'));await hung.player.close();
});
await test('Stable state resets budget; monitoring does not opt into retries',async()=>{
  const f=fixture();await f.player.connect();f.sockets[0].serverClose();f.advance(500);const ws=f.sockets[1];ws.open();
  for(let i=0;i<11;i++){ws.message(f.state(7,true));f.advance(500);}
  assert.equal(f.player.retryCount,0);assert.equal(f.player.outageStarted,null);ws.serverClose();f.advance(500);assert.equal(f.sockets.length,3);await f.player.close();
  const monitor=fixture('natural',false);await monitor.player.connect();monitor.sockets[0].serverClose();monitor.advance(120000);assert.equal(monitor.sockets.length,1);await monitor.player.close();
});
console.log(JSON.stringify({passed:true,checks:results,physicalMedia:false,network:false},null,2));
