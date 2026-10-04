import { inspectVRM } from './vrm-inspection';
self.onmessage = async ({ data }) => {
  try { self.postMessage({ result: await inspectVRM(data.blob) }); }
  catch (error) { self.postMessage({ error: error instanceof Error ? error.message : String(error) }); }
};
