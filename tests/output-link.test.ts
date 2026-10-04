import { afterEach, expect, it, vi } from 'vitest';
import { OutputLink } from '../src/output-link';
import { defaults } from '../src/types';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
it('ignores late frames and queued handshakes after output channel teardown', async () => {
  vi.useFakeTimers();
  const sent: unknown[] = [];
  vi.stubGlobal('BroadcastChannel', class {
    closed = false;
    postMessage(value: unknown) { if (this.closed) throw new Error('closed'); sent.push(value); }
    close() { this.closed = true; }
  });
  for (const output of [true, false]) {
    const link = new OutputLink(output, 'test', () => ({ avatarId: null, label: 'Ene', settings: defaults, calibration: null, expression: 'neutral', frame: null }), () => {}, () => {}, () => null, () => {});
    link.close(); link.close(); link.frame(null); link.publish();
    await Promise.resolve(); // Constructor's queued first handshake.
    await vi.advanceTimersByTimeAsync(10000);
  }
  expect(sent).toHaveLength(2);
  expect(sent.every((message: any) => message.type === 'bye')).toBe(true);
});
it('accepts only current revision acknowledgments from connected peers',async()=>{
  vi.useFakeTimers();let channel:any;const peerState=vi.fn();
  vi.stubGlobal('BroadcastChannel',class{onmessage:any;constructor(){channel=this;}postMessage(){}close(){}});
  const link=new OutputLink(false,'session',()=>({sessionId:'session',revision:3,avatarId:'hash',label:'model',settings:defaults,calibration:null,expression:'neutral',frame:null}),()=>{},()=>{},()=>null,()=>{},peerState);
  channel.onmessage({data:{type:'hello',client:'peer',avatarId:null}});
  for(const data of [{session:'other',revision:3},{session:'session',revision:2}])channel.onmessage({data:{type:'result',client:'peer',state:'error',...data}});
  expect(peerState).not.toHaveBeenCalled();
  channel.onmessage({data:{type:'result',session:'session',client:'peer',revision:3,state:'ready'}});
  expect(peerState).toHaveBeenCalledWith([{client:'peer',revision:3,state:'ready',message:undefined}]);link.close();
});
it('removes stale peer results when heartbeats stop',async()=>{
  vi.useFakeTimers();let channel:any;const peers=vi.fn(),connection=vi.fn();
  vi.stubGlobal('BroadcastChannel',class{onmessage:any;constructor(){channel=this;}postMessage(){}close(){}});
  const link=new OutputLink(false,'session',()=>({sessionId:'session',revision:1,avatarId:'hash',label:'model',settings:defaults,calibration:null,expression:'neutral',frame:null}),()=>{},()=>{},()=>null,connection,peers);
  channel.onmessage({data:{type:'hello',client:'peer',avatarId:null}});
  channel.onmessage({data:{type:'result',session:'session',client:'peer',revision:1,state:'ready'}});
  await vi.advanceTimersByTimeAsync(6000);expect(peers).toHaveBeenLastCalledWith([]);expect(connection).toHaveBeenLastCalledWith(0);link.close();
});
