// Only the OBS pages opt into bounded output reconnection. This class never
// claims a producer, starts a voice mode or opens a microphone.
const RETRY_LIMIT=12, RETRY_WINDOW_MS=120000, CONNECTION_TIMEOUT_MS=5000;
const STATE_TIMEOUT_MS=3000, STABLE_CONNECTION_MS=5000;
const terminalCodes=new Set([1002,1003,1007,1008,1009]);

export class ConvertedPlayer {
  constructor(route,onState=()=>{},onError=()=>{},kind='converted',options={}) {
    if(!['converted','natural'].includes(kind))throw new Error('Unknown audio route');
    this.kind=kind;this.frameKind=kind==='natural'?'VMNA':'VMOA';
    this.label=kind==='natural'?'Natural':'Converted';
    this.route=route;this.onState=onState;this.onError=onError;
    this.epoch=null;this.sequence=-1;this.producer=null;this.lastSeenSequence=-1;
    this.closed=false;this.allow=false;this.monitor=true;
    this.reconnect=options.reconnect===true;
    this.generation=0;this.retryCount=0;this.outageStarted=null;
    this.lastStateAt=null;this.stableSince=null;this.retryTimer=null;this.connectionTimer=null;
    this.audioStats={underflowSamples:0,overflows:0,queuedSamples:0};this.packetAges=[];
  }
  async connect() {
    if(this.closed||this.context)throw new Error('Audio receiver is already connected or closed.');
    this.context=new AudioContext({sampleRate:40000,latencyHint:'interactive'});
    if(this.context.sampleRate!==40000)throw new Error(`This audio device did not accept 40 kHz ${this.kind} audio.`);
    await this.context.audioWorklet.addModule('/pcm-player.js');
    if(this.closed){await this.context.close();return this;}
    this.node=new AudioWorkletNode(this.context,'converted-pcm',{numberOfInputs:0,outputChannelCount:[1]});
    this.gain=this.context.createGain();this.gain.gain.value=this.monitor?1:0;
    this.node.connect(this.gain).connect(this.context.destination);
    this.node.port.onmessage=({data})=>{if(data.type==='stats')this.audioStats=data;if(data.type==='overflow')this.onError(`${this.label} audio queue overflow was muted.`);};
    await this.context.resume();
    if(this.closed){await this.context.close();return this;}
    this.watchdog=setInterval(()=>this.checkConnection(),100);
    this.openSocket();
    return this;
  }
  invalidate() {
    this.allow=false;this.epoch=null;this.producer=null;this.lastSeenSequence=-1;
    this.lastStateAt=null;this.stableSince=null;this.flush();
  }
  openSocket() {
    if(this.closed||this.ws)return;
    this.invalidate();
    const generation=++this.generation;
    const ws=new WebSocket(`ws://${location.host}/ws/${this.kind==='natural'?'natural-output':'output'}`);
    this.ws=ws;ws.binaryType='arraybuffer';
    const current=()=>!this.closed&&this.ws===ws&&this.generation===generation;
    ws.onopen=()=>{if(current())ws.send(JSON.stringify(this.route));};
    ws.onmessage=({data})=>{if(current())this.receive(data);};
    ws.onclose=event=>{if(current())this.lostSocket(ws,event.code,'disconnected');};
    ws.onerror=()=>{if(current())this.lostSocket(ws,0,'connection failed');};
    const remaining=this.outageStarted===null?CONNECTION_TIMEOUT_MS:Math.min(CONNECTION_TIMEOUT_MS,RETRY_WINDOW_MS-(performance.now()-this.outageStarted));
    this.connectionTimer=setTimeout(()=>{if(current())this.lostSocket(ws,0,'did not receive authenticated state in time');},Math.max(1,remaining));
  }
  lostSocket(ws,code,reason) {
    if(this.ws!==ws||this.closed)return;
    this.invalidate();clearTimeout(this.connectionTimer);this.connectionTimer=null;
    this.ws=null;++this.generation;
    ws.onopen=ws.onmessage=ws.onclose=ws.onerror=null;
    if(ws.readyState<2)ws.close();
    if(!this.reconnect||terminalCodes.has(code)) {
      this.onError(`${this.label} audio ${reason}; muted. ${terminalCodes.has(code)?'Verify the private receiver route before refreshing.':'Reconnect explicitly.'}`);
      return;
    }
    this.scheduleRetry(reason);
  }
  scheduleRetry(reason) {
    if(this.closed||this.retryTimer!==null)return;
    const now=performance.now();this.outageStarted??=now;
    const delay=Math.min(10000,500*2**Math.min(this.retryCount,5));
    if(this.retryCount>=RETRY_LIMIT||now-this.outageStarted+delay>=RETRY_WINDOW_MS) {
      this.onError(`${this.label} audio retry limit reached; muted. Start Voice Studio again or refresh this OBS source.`);
      return;
    }
    this.onError(`${this.label} audio ${reason}; muted. Receiver retry ${this.retryCount+1}/${RETRY_LIMIT} in ${delay/1000}s.`);
    this.retryTimer=setTimeout(()=>{this.retryTimer=null;if(this.closed)return;this.retryCount++;this.openSocket();},delay);
  }
  checkConnection() {
    if(this.closed)return;
    if(this.lastPacket&&Date.now()-this.lastPacket>400)this.flush();
    const now=performance.now();
    if(this.ws&&this.lastStateAt!==null&&now-this.lastStateAt>STATE_TIMEOUT_MS) {
      this.lostSocket(this.ws,0,'state heartbeat timed out');return;
    }
    if(this.stableSince!==null&&now-this.stableSince>=STABLE_CONNECTION_MS) {
      this.retryCount=0;this.outageStarted=null;
    }
  }
  invalidState() {
    this.invalidate();
    if(this.ws)this.lostSocket(this.ws,1008,'received an invalid route state');
    else this.onError(`${this.label} audio received an invalid route state; muted.`);
  }
  receive(data) {
    if(this.closed)return;
    if(typeof data==='string') {
      let state;
      try {state=JSON.parse(data);}catch{this.invalidState();return;}
      if(!state||state.type!=='state'||state.routeId!==this.route.routeId||state.outputKind!==this.frameKind||
         !Number.isInteger(state.epoch)||state.epoch<0||state.epoch>0xffffffff||typeof state.muted!=='boolean'||
         !['idle','reference','live','natural'].includes(state.mode)||state.sampleRate!==40000||state.chunkSamples!==6400||
         !(state.producerId===null||typeof state.producerId==='string')||
         (!state.muted&&!(typeof state.producerId==='string'&&state.producerId.length>0))) {this.invalidState();return;}
      if(state.reset||state.epoch!==this.epoch||state.producerId!==this.producer){this.flush();this.lastSeenSequence=-1;}
      if(state.muted)this.flush();
      this.epoch=state.epoch;this.producer=state.producerId;
      this.allow=!state.muted&&(this.kind==='natural'?state.mode==='natural':['reference','live'].includes(state.mode));
      this.lastStateAt=performance.now();this.stableSince??=this.lastStateAt;
      clearTimeout(this.connectionTimer);this.connectionTimer=null;
      this.onState(state);return;
    }
    if(!(data instanceof ArrayBuffer)||data.byteLength!==24+6400*4){this.flush();return;}
    const view=new DataView(data),magic=String.fromCharCode(...new Uint8Array(data,0,4));
    const epoch=view.getUint32(4,true),seq=view.getUint32(8,true),rate=view.getUint32(12,true),issued=view.getFloat64(16,true);
    const age=Date.now()-issued;
    if(!this.allow||magic!==this.frameKind||epoch!==this.epoch||rate!==40000||!Number.isFinite(age)||age< -100||age>400){this.flush();return;}
    if(seq<=this.lastSeenSequence){this.flush();return;}
    if(this.sequence!==-1&&seq!==this.sequence+1)this.flush();
    this.sequence=seq;this.lastSeenSequence=seq;this.lastPacket=Date.now();this.packetAges.push(age);if(this.packetAges.length>100)this.packetAges.shift();
    const samples=new Float32Array(data.slice(24));
    if(samples.some(x=>!Number.isFinite(x))){this.flush();return;}
    this.node.port.postMessage({type:'pcm',samples},[samples.buffer]);
  }
  flush(){this.node?.port.postMessage({type:'reset'});this.sequence=-1;this.lastPacket=0;}
  setMonitoring(enabled){this.monitor=enabled;if(this.gain)this.gain.gain.value=enabled?1:0;}
  async close() {
    if(this.closed)return;
    this.closed=true;clearInterval(this.watchdog);clearTimeout(this.retryTimer);clearTimeout(this.connectionTimer);
    this.retryTimer=this.connectionTimer=null;this.invalidate();++this.generation;
    if(this.ws){this.ws.onopen=this.ws.onmessage=this.ws.onclose=this.ws.onerror=null;this.ws.close();this.ws=null;}
    await this.context?.close();
  }
}

if(['/obs','/obs-natural'].includes(location.pathname)) {
  const natural=location.pathname==='/obs-natural',labelName=natural?'Natural':'Converted';
  const params=new URLSearchParams(location.hash.slice(1));
  const route={routeId:params.get('route'),outputKey:params.get('key')};
  const label=document.querySelector('#status');
  if(!route.routeId||!route.outputKey)label.textContent=`${labelName} voice: missing private route URL`;
  else {
    const player=new ConvertedPlayer(route,s=>{label.textContent=`${labelName} voice: ${s.status}`;},e=>{label.textContent=e;},natural?'natural':'converted',{reconnect:true});
    window.voiceOutput=player;
    player.connect().catch(()=>{label.textContent=`${labelName} voice muted: audio device unavailable`;player.close();});
    addEventListener('pagehide',()=>player.close());
  }
}
