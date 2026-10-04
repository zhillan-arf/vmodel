import { validateRegistration } from './library-validation';
import { bundledAvatars } from './avatars';
import { requestValue, transact } from './library-db';
import { packageVersion, checkAbort, modelName, sha256, validationVersion, type Attachment, type InspectionResult, type LibraryEntry, type ModelRepository, type RegistrationDraft, type ResolvedAsset } from './model-types';
export class LocalModelRepository implements ModelRepository {
  private inspections = new WeakMap<InspectionResult, { blob: Blob; hash: string; metadata: string }>();
  private bundled = new Map<string, Promise<InspectionResult>>();
  readonly changes = new EventTarget();
  private channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('vmodel-library-v1');
  constructor() { if (this.channel) this.channel.onmessage = () => this.changes.dispatchEvent(new Event('change')); }
  close() { this.channel?.close(); }
  private changed() { this.channel?.postMessage('change'); this.changes.dispatchEvent(new Event('change')); }
  inspect(file: Blob, signal: AbortSignal): Promise<InspectionResult> {
    checkAbort(signal);
    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL('./vrm-inspection.worker.ts', import.meta.url), { type: 'module' });
      const cleanup = () => { clearTimeout(timer); worker.terminate(); signal.removeEventListener('abort', abort); };
      const abort = () => { cleanup(); reject(signal.reason); };
      const timer = setTimeout(() => { cleanup(); reject(new Error('File inspection exceeded 30 seconds. Retry with a smaller model.')); }, 30000);
      signal.addEventListener('abort', abort, { once: true });
      worker.onmessage = ({data}) => {
        cleanup();
        if(data.error){reject(new Error(data.error));return;}
        const result=data.result as InspectionResult;
        this.inspections.set(result,{blob:result.blob,hash:result.hash,metadata:JSON.stringify(result.rawMeta)});
        resolve(result);
      };
      worker.onerror = event => { cleanup(); reject(new Error(event.message)); };
      worker.postMessage({ blob: file });
    });
  }
  private bundle(id: string): Promise<InspectionResult> {
    if (!this.bundled.has(id)) {
      const item = bundledAvatars.find(x => x.id === id);
      if (!item) return Promise.reject(new Error('Bundled model not found.'));
      const promise = fetch(item.url).then(async response => {
        if (!response.ok) throw new Error(`Bundled model unavailable: ${item.name}`);
        return this.inspect(await response.blob(), new AbortController().signal);
      }).catch(error => { this.bundled.delete(id); throw error; });
      this.bundled.set(id, promise);
    }
    return this.bundled.get(id)!;
  }
  async bundledEntries(): Promise<LibraryEntry[]> {
    const results = await Promise.allSettled(bundledAvatars.map(async item => {
      const inspected = await this.bundle(item.id);
      return { id: item.id, assetHash: inspected.hash, sourceKind: 'bundled', displayName: item.label, originalFilename: `${item.id}.vrm`, packageVersion:item.packageVersion,
        vrmVersion: inspected.capabilities.vrmVersion, rawMeta: inspected.rawMeta, capabilities: inspected.capabilities, acknowledgment: null, createdAt: '', updatedAt: '' };
    }));
    return results.flatMap(result=>result.status==='fulfilled'?[result.value as LibraryEntry]:[]);
  }
  async list(): Promise<LibraryEntry[]> {
    const saved = await transact(['models'], 'readonly', tx => requestValue<LibraryEntry[]>(tx.objectStore('models').getAll()));
    return [...await this.bundledEntries(), ...saved];
  }
  async duplicate(hash: string): Promise<LibraryEntry | undefined> {
    const bundled = (await this.bundledEntries()).find(x => x.assetHash === hash);
    if (bundled) return bundled;
    return transact(['models'], 'readonly', tx => requestValue(tx.objectStore('models').index('assetHash').get(hash)));
  }
  async validateDraft(draft: RegistrationDraft): Promise<void> {
    const proof = this.inspections.get(draft.inspection);
    if (!proof || proof.blob !== draft.inspection.blob || proof.hash !== draft.inspection.hash ||
      proof.metadata !== JSON.stringify(draft.inspection.rawMeta)) throw new Error('Inspect the model again before save.');
    await validateRegistration(draft);
  }
  async register(draft: RegistrationDraft, signal: AbortSignal): Promise<LibraryEntry> {
    const entries = await this.registerMany([draft], signal); return entries[0];
  }
  async registerMany(drafts: RegistrationDraft[], signal: AbortSignal): Promise<LibraryEntry[]> {
    for (const draft of drafts) { await this.validateDraft(draft); checkAbort(signal); }
    const bundled = await this.bundledEntries(); checkAbort(signal);
    const entries = await transact(['assets','models','attachments'], 'readwrite', async tx => {
      const result: LibraryEntry[] = [];
      for (const draft of drafts) {
        const { inspection } = draft;
        const duplicate = bundled.find(x => x.assetHash === inspection.hash) ?? await requestValue<LibraryEntry | undefined>(tx.objectStore('models').index('assetHash').get(inspection.hash));
        if (duplicate) { result.push(duplicate); continue; }
        const now = new Date().toISOString(), id = crypto.randomUUID();
        const entry: LibraryEntry = { id, assetHash: inspection.hash, sourceKind: 'imported', displayName: modelName(draft.displayName),
          originalFilename: draft.originalFilename, packageVersion:packageVersion(draft.packageVersion), vrmVersion: inspection.capabilities.vrmVersion, rawMeta: inspection.rawMeta,
          capabilities: inspection.capabilities, acknowledgment: draft.acknowledgment, createdAt: now, updatedAt: now };
        tx.objectStore('assets').add({ hash: inspection.hash, blob: inspection.blob, byteLength: inspection.blob.size, mediaType: 'model/gltf-binary', createdAt: now, validationVersion });
        tx.objectStore('models').add(entry);
        for (const attachment of draft.attachments) tx.objectStore('attachments').add({ ...attachment, id: crypto.randomUUID(), modelId: id });
        result.push(entry);
      }
      return result;
    }, signal);
    this.changed(); return entries;
  }
  async resolve(id: string, signal: AbortSignal): Promise<ResolvedAsset> {
    checkAbort(signal);
    const bundled = bundledAvatars.find(x => x.id === id);
    if (bundled) { const inspected = await this.bundle(id); checkAbort(signal); return { blob: inspected.blob, hash: await sha256(inspected.blob), entryId: id, label: bundled.label }; }
    const result = await transact(['models','assets'], 'readonly', async tx => {
      const entry = await requestValue<LibraryEntry | undefined>(tx.objectStore('models').get(id));
      if (!entry) throw new Error('Saved entry is missing. Select a bundled model or restore a backup.');
      const asset = await requestValue(tx.objectStore('assets').get(entry.assetHash));
      if (!asset?.blob) throw new Error('Saved bytes are missing. Restore a backup.');
      return { blob: asset.blob as Blob, hash: entry.assetHash, entryId: id, label: entry.displayName };
    }, signal);
    if (await sha256(result.blob) !== result.hash) throw new Error('Saved bytes failed the hash check. Restore a backup.');
    checkAbort(signal); return result;
  }
  async rename(id: string, name: string) {
    const displayName = modelName(name);
    await transact(['models'], 'readwrite', async tx => {
      const store = tx.objectStore('models'), entry = await requestValue(store.get(id));
      if (!entry) throw new Error('Imported entry not found. Bundled names cannot change.');
      store.put({ ...entry, displayName, updatedAt: new Date().toISOString() });
    }); this.changed();
  }
  async remove(id: string) {
    await transact(['models','assets','attachments','preferences'], 'readwrite', async tx => {
      const store = tx.objectStore('models'), entry = await requestValue<LibraryEntry | undefined>(store.get(id));
      if (!entry) throw new Error('Imported entry not found.');
      store.delete(id);
      const attachments = await requestValue<Attachment[]>(tx.objectStore('attachments').index('modelId').getAll(id));
      for (const item of attachments) tx.objectStore('attachments').delete(item.id);
      const refs = await requestValue(store.index('assetHash').count(entry.assetHash));
      if (!refs) tx.objectStore('assets').delete(entry.assetHash);
      const selected = await requestValue(tx.objectStore('preferences').get('selectedModelId'));
      if (selected?.value === id) tx.objectStore('preferences').delete('selectedModelId');
    }); this.changed();
  }
  attachments(id: string): Promise<Attachment[]> { return transact(['attachments'], 'readonly', tx => requestValue(tx.objectStore('attachments').index('modelId').getAll(id))); }
  async export(id: string) { return (await this.resolve(id, new AbortController().signal)).blob; }
  async selected(): Promise<string | undefined> { return transact(['preferences'], 'readonly', async tx => (await requestValue(tx.objectStore('preferences').get('selectedModelId')))?.value); }
  async select(id: string) { await transact(['preferences'], 'readwrite', tx => { tx.objectStore('preferences').put({ key: 'selectedModelId', value: id }); }); }
}
