import type { AvatarViewer, PreparedAvatar } from './viewer';
export class ModelOperation {
  private controller: AbortController | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  begin(timeoutMs: number | null = 30000) {
    this.cancel();
    const controller = this.controller = new AbortController();
    if(timeoutMs!==null)this.timer = setTimeout(() => controller.abort(new Error('Model preparation exceeded 30 seconds. Retry the operation.')), timeoutMs);
    return controller.signal;
  }
  isCurrent(signal:AbortSignal) { return this.controller?.signal===signal; }
  finish(signal: AbortSignal) { if (this.controller?.signal === signal) clearTimeout(this.timer); }
  cancel() { clearTimeout(this.timer); this.controller?.abort(new DOMException('Operation cancelled.', 'AbortError')); this.controller = null; }
}
export async function prepareSelection(viewer: AvatarViewer, blob: Blob, signal: AbortSignal): Promise<PreparedAvatar> {
  signal.throwIfAborted();
  const controller=new AbortController(),deadline=performance.now()+30000;
  const forward=()=>controller.abort(signal.reason);
  signal.addEventListener('abort',forward,{once:true});
  const timeout=()=>controller.abort(new Error('Model preparation exceeded 30 seconds. Retry the operation.'));
  const timer=setTimeout(timeout,30000);
  let cancelled=false;
  const abort=()=>{cancelled=true;viewer.cancelPendingLoad();};
  controller.signal.addEventListener('abort',abort,{once:true});
  try {
    const pending=viewer.prepareAvatar(blob,controller.signal);
    pending.then(candidate=>{if(cancelled)viewer.disposePreparedAvatar(candidate);},()=>{});
    const candidate=await abortable(pending,controller.signal);
    // Check elapsed time after synchronous loader work, before a timer can run.
    if(performance.now()>=deadline)timeout();
    try { controller.signal.throwIfAborted();return candidate; }
    catch(error){viewer.disposePreparedAvatar(candidate);throw error;}
  } finally {
    clearTimeout(timer);signal.removeEventListener('abort',forward);
    controller.signal.removeEventListener('abort',abort);
  }
}

export function abortable<T>(promise:Promise<T>,signal:AbortSignal):Promise<T>{
  signal.throwIfAborted();
  return new Promise((resolve,reject)=>{
    const abort=()=>reject(signal.reason);
    signal.addEventListener('abort',abort,{once:true});
    promise.then(value=>{signal.removeEventListener('abort',abort);if(signal.aborted)reject(signal.reason);else resolve(value);},error=>{signal.removeEventListener('abort',abort);reject(error);});
  });
}
