import type { Calibration, StudioSettings, TrackingFrame } from './types';
export interface OutputSnapshot {
  avatarId: string | null; label: string; blob?: Blob; settings: StudioSettings;
  calibration: Calibration | null; expression: string; frame: TrackingFrame | null;
}
export class OutputLink {
  private channel: BroadcastChannel;
  private client = crypto.randomUUID();
  private peers = new Map<string, number>();
  private lastControl = 0;
  private closed = false;
  private timer: ReturnType<typeof setInterval>;
  constructor(private output: boolean, session: string,
    private snapshot: (knownAvatar: string | null) => OutputSnapshot,
    private receive: (snapshot: OutputSnapshot) => void,
    private receiveFrame: (frame: TrackingFrame | null) => void,
    private knownAvatar: () => string | null,
    private connection: (count: number) => void) {
    this.channel = new BroadcastChannel(`vmodel-output-v2:${session}`);
    this.channel.onmessage = ({ data }) => {
      if (this.closed) return;
      if (!this.output && data.type === 'hello') {
        this.peers.set(data.client, Date.now()); this.connection(this.peerCount());
        this.channel.postMessage({ type: 'snapshot', target: data.client, state: this.snapshot(data.avatarId) });
      }
      if (!this.output && data.type === 'bye') { this.peers.delete(data.client); this.connection(this.peerCount()); }
      if (this.output && data.type === 'snapshot' && (!data.target || data.target === this.client)) {
        this.lastControl = Date.now(); this.connection(1); this.receive(data.state);
      }
      if (this.output && data.type === 'frame') { this.lastControl = Date.now(); this.receiveFrame(data.frame); }
    };
    this.timer = setInterval(() => this.pulse(), 1500);
    // Let caller finish initializing its state before the first handshake.
    queueMicrotask(() => this.pulse());
  }
  peerCount() {
    for (const [client, seen] of this.peers) if (Date.now() - seen > 4500) this.peers.delete(client);
    return this.peers.size;
  }
  private pulse() {
    if (this.closed) return;
    if (this.output) {
      this.channel.postMessage({ type: 'hello', client: this.client, avatarId: this.knownAvatar() });
      if (Date.now() - this.lastControl > 4500) { this.receiveFrame(null); this.connection(0); }
    } else this.connection(this.peerCount());
  }
  publish() {
    if (this.output || this.closed) return;
    // Known peers request a missing model; normal changes carry only small state.
    this.channel.postMessage({ type: 'snapshot', state: this.snapshot(this.knownAvatar()) });
  }
  frame(frame: TrackingFrame | null) { if (!this.output && !this.closed) this.channel.postMessage({ type: 'frame', frame }); }
  close() {
    if (this.closed) return;
    this.closed = true; clearInterval(this.timer);
    this.channel.postMessage({ type: 'bye', client: this.client }); this.channel.close();
  }
}
