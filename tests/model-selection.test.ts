import { afterEach, expect, it, vi } from 'vitest';
import { ModelOperation, prepareSelection } from '../src/model-selection';
import type { AvatarViewer, PreparedAvatar } from '../src/viewer';

afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();});
function fixture(){
  let resolve!:(candidate:PreparedAvatar)=>void;
  const candidate={} as PreparedAvatar;
  const viewer={prepareAvatar:vi.fn(()=>new Promise<PreparedAvatar>(done=>{resolve=done;})),cancelPendingLoad:vi.fn(),disposePreparedAvatar:vi.fn()};
  return {viewer:viewer as unknown as AvatarViewer,mock:viewer,candidate,resolve:()=>resolve(candidate)};
}
it('rejects a prior cancellation without starting the loader',async()=>{
  const {viewer,mock}=fixture(),controller=new AbortController();controller.abort();
  await expect(prepareSelection(viewer,new Blob(),controller.signal)).rejects.toThrow();
  expect(mock.prepareAvatar).not.toHaveBeenCalled();
});
it('disposes a late candidate after cancellation',async()=>{
  const {viewer,mock,resolve,candidate}=fixture(),controller=new AbortController();
  const pending=prepareSelection(viewer,new Blob(),controller.signal),rejected=expect(pending).rejects.toThrow();
  controller.abort();await rejected;resolve();await Promise.resolve();
  expect(mock.cancelPendingLoad).toHaveBeenCalledOnce();expect(mock.disposePreparedAvatar).toHaveBeenCalledWith(candidate);
});
it('limits each preparation when the enclosing operation has no deadline',async()=>{
  vi.useFakeTimers();const operation=new ModelOperation(),{viewer,mock,resolve}=fixture();
  const signal=operation.begin(null),pending=prepareSelection(viewer,new Blob(),signal);
  const rejected=expect(pending).rejects.toThrow('exceeded 30 seconds');
  await vi.advanceTimersByTimeAsync(30000);await rejected;expect(signal.aborted).toBe(false);
  resolve();await Promise.resolve();expect(mock.disposePreparedAvatar).toHaveBeenCalledOnce();operation.cancel();
});
it('rejects synchronous work that exceeds the deadline before the timer runs',async()=>{
  const clock=vi.spyOn(performance,'now').mockReturnValue(0),{viewer,mock,candidate,resolve}=fixture();
  const pending=prepareSelection(viewer,new Blob(),new AbortController().signal);
  clock.mockReturnValue(30001);resolve();await expect(pending).rejects.toThrow('exceeded 30 seconds');
  expect(mock.disposePreparedAvatar).toHaveBeenCalledWith(candidate);
});
it('releases timers after successful preparation',async()=>{
  vi.useFakeTimers();const {viewer,mock,candidate,resolve}=fixture();
  const pending=prepareSelection(viewer,new Blob(),new AbortController().signal);resolve();expect(await pending).toBe(candidate);
  await vi.advanceTimersByTimeAsync(60000);expect(mock.cancelPendingLoad).not.toHaveBeenCalled();expect(mock.disposePreparedAvatar).not.toHaveBeenCalled();
});
