/* Bounded converted-audio sink. Underflow, reset and overflow produce silence. */
class ConvertedPCM extends AudioWorkletProcessor {
  constructor() {
    super(); this.buffer = new Float32Array(9600); this.read = 0; this.write = 0; this.count = 0;
    this.started=false;this.receiving=false;this.underflowSamples=0;this.overflows=0;this.processedSamples=0;
    this.port.onmessage = ({data}) => {
      if (data.type === 'reset') { this.read = this.write = this.count = 0; this.started=false;this.receiving=false;return; }
      if (data.type !== 'pcm' || !(data.samples instanceof Float32Array)) return;
      const pcm = data.samples;
      if (pcm.length !== 6400 || this.count + pcm.length > this.buffer.length) {
        this.read = this.write = this.count = 0; this.started=false;this.receiving=false;this.overflows++;this.port.postMessage({type:'overflow'}); return;
      }
      // Forty milliseconds of silence before a fresh run absorbs arrival jitter.
      // The 240 ms hard cap still rejects overflow instead of accumulating delay.
      if(!this.started){this.buffer.fill(0,0,1600);this.write=1600;this.count=1600;this.started=true;}
      this.receiving=true;
      for (let i=0;i<pcm.length;i++) {
        this.buffer[this.write] = Number.isFinite(pcm[i]) ? Math.max(-.98,Math.min(.98,pcm[i])) : 0;
        this.write = (this.write + 1) % this.buffer.length;
      }
      this.count += pcm.length;
    };
  }
  process(_inputs, outputs) {
    const out = outputs[0][0];
    for (let i=0;i<out.length;i++) {
      out[i] = this.count ? this.buffer[this.read] : 0;
      if (this.count) { this.read = (this.read+1)%this.buffer.length; this.count--; }
      else if(this.receiving)this.underflowSamples++;
    }
    this.processedSamples+=out.length;
    if(this.processedSamples>=20000){this.processedSamples=0;this.port.postMessage({type:'stats',underflowSamples:this.underflowSamples,overflows:this.overflows,queuedSamples:this.count});}
    return true;
  }
}
registerProcessor('converted-pcm',ConvertedPCM);
