/* This processor never monitors the input. Only explicit live mode opens it. */
class VoiceInput extends AudioWorkletProcessor {
  constructor() { super(); this.block = new Float32Array(2560); this.used = 0; }
  process(inputs,outputs) {
    outputs.forEach(channels => channels.forEach(channel => channel.fill(0)));
    const input = inputs[0]?.[0];
    if (!input) return true;
    for (const value of input) {
      this.block[this.used++] = value;
      if (this.used === this.block.length) {
        this.port.postMessage(this.block,[this.block.buffer]);
        this.block = new Float32Array(2560); this.used = 0;
      }
    }
    return true;
  }
}
registerProcessor('voice-input',VoiceInput);
