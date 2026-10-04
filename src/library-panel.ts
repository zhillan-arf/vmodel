import { AvatarViewer } from './viewer';
import { captureModelThumbnail } from './model-thumbnail';
import { defaults } from './types';
import { LocalModelRepository } from './model-repository';
import { sha256, type InspectionResult, type Attachment, type LibraryEntry, type RegistrationDraft } from './model-types';
import { createBackup, download, inspectBackup, restoreBackup, type RestorePlan } from './library-backup';
import { ModelOperation, prepareSelection } from './model-selection';
export class LibraryPanel {
  readonly element = document.createElement('section');
  private preview: AvatarViewer | null = null;

  private candidate: InspectionResult | null = null;
  private attachments: Attachment[] = [];
  private filename = '';
  private entries: LibraryEntry[] = [];
  private restore: RestorePlan | null = null;
  private persistenceRequested = false;
  private persistenceGeneration = 0;
  private requestedEntry:string|null=null;
  private useGeneration=0;
  private persistenceStatus = 'Storage persistence is unavailable.';
  private visible = false;
  private termsGeneration=0;
  private termsValid=true;
  private lastDraw = 0;
  private frame = 0;
  private thumbnailURLs: string[] = [];
  private refreshGeneration = 0;
  constructor(readonly repository: LocalModelRepository,
    private select: (asset: {blob:Blob;hash:string;entryId:string|null;label:string}) => Promise<void>,
    private active: () => { id: string|null; requested: string|null; temporaryLabel?:string|null }, private operation = new ModelOperation()) {
    this.element.className = 'feature-panel'; this.element.dataset.studioPanel = 'library'; this.element.hidden = true;
    this.element.innerHTML = `<h1>Model library</h1><p id="library-storage"></p><p id="library-persistence"></p>
      <div class="toolbar"><button id="import-model" class="primary">Import VRM</button><input id="library-file" type="file" accept=".vrm" hidden>
      <button id="backup-models">Back up selected entries</button><button id="restore-models">Restore backup</button><input id="backup-file" type="file" accept=".vmlib" hidden></div>
      <label class="check"><input id="backup-settings" type="checkbox"> Include model settings</label>
      <p>Models stay in this browser. Keep original files and a backup outside browser storage.</p>
      <div class="library-status" role="region" aria-label="Library status" tabindex="0"><p id="library-current" role="status" hidden></p><p id="library-message" role="status" aria-live="polite"></p><progress id="library-progress" aria-label="Model operation" hidden></progress></div><div id="library-grid" class="model-grid"></div>
      <section id="import-panel" hidden><h2>Import model</h2><button id="cancel-import">Cancel</button>
      <div class="import-layout"><div><div id="model-preview"></div><div class="toolbar"><button data-preview="neutral">Neutral</button><button data-preview="happy">Smile</button><button data-preview="surprised">Surprise</button></div></div>
      <div><label>Model name<input id="model-name" maxlength="160"></label><p id="embedded-version"></p><label>Supplied package version (optional)<input id="package-version" maxlength="80"></label><pre id="model-capabilities"></pre><h3>Original terms and metadata</h3><pre id="model-terms"></pre>
      <label>Terms files (TXT or MD)<input id="terms-files" type="file" accept=".txt,.md" multiple></label><label>Text encoding<select id="terms-encoding"><option value="utf-8">UTF-8</option><option value="shift_jis">CP932</option></select></label><pre id="attachment-terms"></pre>
      <label class="check"><input id="acknowledge-terms" type="checkbox"> I have reviewed the displayed terms</label>
      <div class="toolbar"><button id="save-model" class="primary" disabled>Save to library</button><button id="try-model" disabled>Try without saving</button></div></div></div></section>
      <section id="restore-panel" hidden><h2>Restore summary</h2><p id="restore-summary"></p><pre id="restore-terms"></pre><label class="check"><input id="restore-acknowledgment" type="checkbox"> I have reviewed the displayed terms</label><button id="commit-restore" class="primary">Restore entries</button><button id="cancel-restore">Cancel restore</button></section>`;
    const file = this.get<HTMLInputElement>('library-file');
    this.get('import-model').onclick = () => file.click();
    file.onchange = () => { const selected = file.files?.[0]; file.value=''; if (selected) void this.inspect(selected); };
    this.get('cancel-import').onclick = () => { this.cancel();this.message('Import canceled.');this.get('import-model').focus(); };
    this.get('acknowledge-terms').onchange = () => { this.get<HTMLButtonElement>('save-model').disabled = !this.candidate || !this.termsValid || !this.get<HTMLInputElement>('acknowledge-terms').checked; };
    this.get('save-model').onclick = () => void this.save();
    this.get('try-model').onclick = () => { const candidate=this.candidate; if (!candidate) return; const label=this.get<HTMLInputElement>('model-name').value; this.cancel(); void this.select({blob:candidate.blob,hash:candidate.hash,entryId:null,label:`${label} · Temporary`}).catch(e=>this.message(String(e),'error')); };
    this.get<HTMLInputElement>('terms-files').onchange = () => void this.readTerms();
    this.get('terms-encoding').onchange = () => void this.readTerms();
    this.get('backup-models').onclick = () => void this.backup();
    const backupFile=this.get<HTMLInputElement>('backup-file');
    this.get('restore-models').onclick=()=>backupFile.click();
    backupFile.onchange=()=>{const selected=backupFile.files?.[0];backupFile.value='';if(selected)void this.inspectRestore(selected);};
    this.get('commit-restore').onclick=()=>void this.commitRestore();
    this.get('cancel-restore').onclick=()=>{this.operation.cancel();this.restore=null;this.get('restore-panel').hidden=true;this.message('Restore canceled.');this.get('restore-models').focus();};
    for(const id of ['library-file','model-name','package-version','terms-files','terms-encoding','backup-file'])this.get(id).setAttribute('aria-describedby','library-message');
    repository.changes.addEventListener('change',this.refresh);
    window.addEventListener('focus',this.refresh);
    void this.refresh();
    void this.readPersistence();
  }
  private get<T extends HTMLElement = HTMLElement>(id:string) { return this.element.querySelector<T>(`#${id}`)!; }
  private async readPersistence(request = false) {
    const generation=++this.persistenceGeneration;
    let status:string;
    try {
      const storage = navigator.storage;
      const granted = request ? await storage?.persist?.() : await storage?.persisted?.();
      status = granted === true ? 'Persistent storage is granted. Keep a backup.'
        : granted === false ? 'The browser can remove saved data. Keep a backup.' : 'Storage persistence is unavailable.';
    } catch { status = 'Storage persistence is unavailable.'; }
    if(generation!==this.persistenceGeneration)return;this.persistenceStatus=status;
    this.get('library-persistence').textContent = this.persistenceStatus;
  }
  private message(text:string, state:'ready'|'busy'|'error'='ready') {
    const message=this.get('library-message');
    message.setAttribute('role',state==='error'?'alert':'status');
    message.setAttribute('aria-live',state==='error'?'assertive':'polite');
    message.textContent=text;
    this.get('library-progress').hidden=state!=='busy';
  }
  readonly refresh = async () => {
    const generation = ++this.refreshGeneration;
    let entries: LibraryEntry[];
    try { entries = await this.repository.list(); }
    catch (error) { this.message(`Saved entries are unavailable. ${String(error)}`,'error'); entries = await this.repository.bundledEntries().catch(()=>[]); }
    if (generation !== this.refreshGeneration) return;
    this.entries=entries;
    const nextURLs:string[]=[],fragment=document.createDocumentFragment();
    const grid=this.get('library-grid');
    for(const entry of entries) {
      const card=document.createElement('article');card.className='model-card';card.dataset.entryId=entry.id;
      const pick=document.createElement('input');pick.type='checkbox';pick.dataset.entry=entry.id;pick.setAttribute('aria-label',`Back up ${entry.displayName}`);
      const title=document.createElement('h2');title.textContent=entry.displayName;
      const summary=document.createElement('p');summary.textContent=`${entry.sourceKind} · VRM ${entry.vrmVersion} · ${entry.capabilities.expressions.length} expressions${this.active().id===entry.id?' · Selected':''}`;
      summary.textContent+=` · Embedded version: ${typeof entry.rawMeta.version==='string'?entry.rawMeta.version:'Unavailable'} · Package version: ${entry.packageVersion??'Unavailable'}`;
      const use=document.createElement('button');use.textContent='Use model';use.onclick=()=>void this.use(entry);
      const details=document.createElement('details'), label=document.createElement('summary');label.textContent='Entry actions';details.append(label);
      const exportButton=document.createElement('button');exportButton.textContent='Export original VRM';exportButton.onclick=()=>void this.repository.export(entry.id).then(blob=>download(blob,entry.originalFilename)).catch(e=>this.message(String(e),'error'));details.append(exportButton);
      if(entry.sourceKind==='bundled'){const img=document.createElement('img');img.src=`/avatars/thumbnails/${entry.assetHash}.png`;img.alt=`${entry.displayName} preview`;card.append(img);}
      if(entry.sourceKind==='imported') {
        const rename=document.createElement('button');rename.textContent='Rename';rename.onclick=()=>{const name=prompt('Model name',entry.displayName);if(name!==null)void this.repository.rename(entry.id,name).catch(e=>this.message(String(e),'error'));};details.append(rename);
        const remove=document.createElement('button');remove.textContent='Remove';remove.disabled=[this.active().id,this.active().requested,this.requestedEntry].includes(entry.id);remove.title=remove.disabled?'Select another model before removal.':'';
        remove.onclick=()=>{if([this.active().id,this.active().requested,this.requestedEntry].includes(entry.id))return;if(confirm(`Remove ${entry.displayName}? Hash-based settings will remain.`))void this.repository.remove(entry.id).catch(e=>this.message(String(e),'error'));};details.append(remove);
        const attachments=await this.repository.attachments(entry.id).catch(()=>[]);
        if(generation!==this.refreshGeneration){for(const url of nextURLs)URL.revokeObjectURL(url);return;}
        const thumbnail=attachments.find(x=>x.kind==='thumbnail');
        if(thumbnail){const img=document.createElement('img');const url=URL.createObjectURL(thumbnail.blob);nextURLs.push(url);img.src=url;img.alt=`${entry.displayName} preview`;card.append(img);}
        for(const attachment of attachments.filter(x=>x.kind==='terms')){const button=document.createElement('button');button.textContent=`Export ${attachment.originalFilename}`;button.onclick=()=>download(attachment.blob,attachment.originalFilename);details.append(button);}
      }
      const image=card.querySelector('img');
      const missing=document.createElement('div');missing.className='thumbnail-unavailable';missing.textContent='Preview unavailable.';
      if(image)image.onerror=()=>image.replaceWith(missing);else card.append(missing);
      card.append(pick,title,summary,use,details);
      [...card.querySelectorAll<HTMLElement>('input,button,summary')].forEach((control,index)=>{control.dataset.focusKey=String(index);});
      fragment.append(card);
    }
    const open=new Set<string>(),checked=new Set<string>();
    for(const card of grid.querySelectorAll<HTMLElement>('[data-entry-id]')){
      if(card.querySelector('details')?.open)open.add(card.dataset.entryId!);
      if(card.querySelector<HTMLInputElement>('input[type=checkbox]')?.checked)checked.add(card.dataset.entryId!);
    }
    const focused=document.activeElement as HTMLElement|null;
    const focusEntry=focused&&grid.contains(focused)?focused.closest<HTMLElement>('[data-entry-id]')?.dataset.entryId:undefined;
    const focusKey=focused?.dataset.focusKey;
    for(const card of fragment.querySelectorAll<HTMLElement>('[data-entry-id]')){
      card.querySelector('details')!.open=open.has(card.dataset.entryId!);
      card.querySelector<HTMLInputElement>('input[type=checkbox]')!.checked=checked.has(card.dataset.entryId!);
    }
    for(const url of this.thumbnailURLs)URL.revokeObjectURL(url);this.thumbnailURLs=nextURLs;
    grid.replaceChildren(fragment);
    if(focusEntry&&focusKey!==undefined){
      const card=[...grid.querySelectorAll<HTMLElement>('[data-entry-id]')].find(card=>card.dataset.entryId===focusEntry);
      const control=card?.querySelector<HTMLElement>(`[data-focus-key="${focusKey}"]`);
      (control??this.get('import-model')).focus({preventScroll:true});
    }
    const state=this.active(),current=this.get('library-current');
    const activeText=state.temporaryLabel?`Temporary model: ${state.temporaryLabel}. This model is not saved.`:state.id&&!entries.some(entry=>entry.id===state.id)?'The active model is no longer saved. It remains active for this session.':'';
    if(current.textContent!==activeText)current.textContent=activeText;current.hidden=!activeText;
    if(state.id&&!entries.some(x=>x.id===state.id))this.message('The active entry is no longer saved. Its model remains active for this session.');
    try { const estimate=await navigator.storage?.estimate();this.get('library-storage').textContent=`${entries.filter(x=>x.sourceKind==='imported').length} saved models · ${location.origin} · ${estimate&&Number.isFinite(estimate.quota)?`${Math.round((estimate.usage??0)/1048576)} / ${Math.round(estimate.quota!/1048576)} MiB used`:'Storage status unavailable'}`; }catch{this.get('library-storage').textContent='Storage status unavailable';}
  };
  private async use(entry:LibraryEntry){
    this.cancel();const generation=this.useGeneration;this.requestedEntry=entry.id;void this.refresh();
    try{const signal=this.operation.begin();const asset=await this.repository.resolve(entry.id,signal);signal.throwIfAborted();await this.select(asset);this.operation.finish(signal);}
    catch(e){if(generation===this.useGeneration)this.message(String(e),'error');}
    finally{if(generation===this.useGeneration){this.requestedEntry=null;await this.refresh();}}
  }
  private createPreview() { this.disposePreview();this.preview=new AvatarViewer(this.get('model-preview'),{...defaults,framing:'body',quality:'low'},false);return this.preview; }
  importFile(file:File) { void this.inspect(file); }
  private async inspect(file:File) {
    this.cancel();this.filename=file.name;this.get('import-panel').hidden=false;this.message('Inspecting file','busy');
    const signal=this.operation.begin();
    let ownedPreview:AvatarViewer|null=null;
    try {
      const candidate=await this.repository.inspect(file,signal);
      const duplicate=await this.repository.duplicate(candidate.hash).catch(()=>undefined);signal.throwIfAborted();
      if(duplicate){this.cancel();this.message(`Duplicate bytes: ${duplicate.displayName}. Use its card to select or rename the entry.`);return;}
      this.message('Preparing preview','busy');const preview=ownedPreview=this.createPreview();const prepared=await prepareSelection(preview,candidate.blob,signal);signal.throwIfAborted();preview.commitAvatar(prepared);
      candidate.capabilities=prepared.capabilities;this.candidate=candidate;this.operation.finish(signal);
      this.get<HTMLInputElement>('model-name').value=file.name.replace(/\.vrm$/i,'');
      this.get('embedded-version').textContent=`Embedded model version: ${typeof candidate.rawMeta.version==='string'?candidate.rawMeta.version:'Unavailable'}`;
      this.get<HTMLInputElement>('package-version').value='';
      this.get('model-capabilities').textContent=JSON.stringify(candidate.capabilities,null,2);this.get('model-terms').textContent=JSON.stringify(candidate.rawMeta,null,2);
      this.get<HTMLButtonElement>('try-model').disabled=false;
      for(const button of this.element.querySelectorAll<HTMLButtonElement>('[data-preview]')){const name=button.dataset.preview!;const exists=name==='neutral'||!!prepared.vrm.expressionManager?.getExpression(candidate.capabilities.aliases[name]??name);button.disabled=!exists;button.title=exists?'':'This expression is not available.';button.onclick=()=>prepared.retarget.setExpression(name);}
      const draw=(now:number)=>{if(this.preview!==preview)return;if(this.visible&&!document.hidden&&now-this.lastDraw>=1000/30){const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;prepared.retarget.update(null,defaults,reduced?1:1/30,performance.timeOrigin+now);preview.draw(reduced?0:1/30);this.lastDraw=now;}this.frame=requestAnimationFrame(draw);};this.frame=requestAnimationFrame(draw);
      this.message('Ready to save');
    }catch(e){if(this.operation.isCurrent(signal))this.message(`Import failed: ${String(e)}. Select another file or retry.`,'error');if(ownedPreview){ownedPreview.dispose();if(this.preview===ownedPreview)this.preview=null;}}
  }
  private async readTerms(){
    const generation=++this.termsGeneration;this.termsValid=false;const attachments:Attachment[]=[];
    this.get<HTMLInputElement>('acknowledge-terms').checked=false;this.get<HTMLButtonElement>('save-model').disabled=true;this.attachments=[];
    try{const files=[...this.get<HTMLInputElement>('terms-files').files??[]];if(files.length>8||files.reduce((n,x)=>n+x.size,0)>8*1048576)throw new Error('Use at most eight terms files and 8 MiB total.');
      const encoding=this.get<HTMLSelectElement>('terms-encoding').value;const text:string[]=[];
      for(const file of files){if(file.size>2*1048576||!/\.(txt|md)$/i.test(file.name))throw new Error('Use TXT or MD files of at most 2 MiB.');const bytes=await file.arrayBuffer();text.push(`${file.name}\n${new TextDecoder(encoding,{fatal:true}).decode(bytes)}`);attachments.push({id:crypto.randomUUID(),modelId:'',kind:'terms',blob:file,originalFilename:file.name,mediaType:'text/plain',sha256:await sha256(file),encoding});}
      if(generation!==this.termsGeneration)return;this.attachments=attachments;this.termsValid=true;
      this.get('attachment-terms').textContent=text.join('\n\n');
    }catch(e){if(generation!==this.termsGeneration)return;this.attachments=[];this.message(`${String(e)} Select the correct text encoding.`,'error');}
  }
  private async save(){
    if(!this.candidate||!this.termsValid||!this.get<HTMLInputElement>('acknowledge-terms').checked)return;
    const candidate=this.candidate,signal=this.operation.begin();this.message('Saving','busy');this.get<HTMLButtonElement>('save-model').disabled=true;
    try{
      const attachments=[...this.attachments];
      if(this.preview){const blob=await captureModelThumbnail(this.preview);attachments.push({id:crypto.randomUUID(),modelId:'',kind:'thumbnail',blob,originalFilename:'thumbnail.png',mediaType:'image/png',encoding:'',sha256:await sha256(blob)});}
      const draft:RegistrationDraft={inspection:candidate,displayName:this.get<HTMLInputElement>('model-name').value,originalFilename:this.filename,packageVersion:this.get<HTMLInputElement>('package-version').value.trim()||undefined,attachments,acknowledgment:{acknowledgedAt:new Date().toISOString(),metadataDigest:await sha256(new Blob([JSON.stringify(candidate.rawMeta)])),attachmentHashes:this.attachments.map(x=>x.sha256)}};
      const entry=await this.repository.register(draft,signal);const current=this.operation.isCurrent(signal);this.operation.finish(signal);if(current)this.cancel();this.message(`Saved ${entry.displayName}. Select Use model to activate it.`);await this.refresh();
      if(!this.persistenceRequested){this.persistenceRequested=true;await this.readPersistence(true);}
    }catch(e){if(this.operation.isCurrent(signal)){this.message(`Save failed: ${String(e)}. Free storage or use the model without saving.`,'error');this.get<HTMLButtonElement>('save-model').disabled=false;}}
  }
  private async backup(){try{const ids=[...this.element.querySelectorAll<HTMLInputElement>('[data-entry]:checked')].map(x=>x.dataset.entry);const blob=await createBackup(this.repository,this.entries.filter(x=>ids.includes(x.id)),this.get<HTMLInputElement>('backup-settings').checked);if(confirm(`Download a ${Math.ceil(blob.size/1048576)} MiB backup with the selected original model bytes?`))download(blob,'models.vmlib');}catch(e){this.message(String(e),'error');}}
  private async inspectRestore(file:File) {
    this.cancel();
    const signal=this.operation.begin(null);
    this.message('Inspecting backup','busy');
    try {
      const plan=await inspectBackup(file,this.repository,signal,async(blob,signal)=>{
        const viewer=this.createPreview();
        try { const candidate=await prepareSelection(viewer,blob,signal);viewer.disposePreparedAvatar(candidate); }
        finally { viewer.dispose();if(this.preview===viewer)this.preview=null; }
      });
      const terms:string[]=[];
      for(const draft of plan.drafts){
        terms.push(`${draft.displayName}\nSupplied package version: ${draft.packageVersion??'Unavailable'}\n${JSON.stringify(draft.inspection.rawMeta,null,2)}`);
        for(const attachment of draft.attachments.filter(x=>x.kind==='terms')){
          const bytes=await attachment.blob.arrayBuffer();signal.throwIfAborted();
          terms.push(`${attachment.originalFilename} (${attachment.encoding})\n${new TextDecoder(attachment.encoding,{fatal:true}).decode(bytes)}`);
        }
      }
      signal.throwIfAborted();this.restore=plan;this.operation.finish(signal);
      this.get('restore-summary').textContent=`${plan.drafts.length} new entries; ${plan.existing.length} existing entries. The active model will stay selected.`;
      this.get('restore-terms').textContent=terms.join('\n\n');
      this.get<HTMLInputElement>('restore-acknowledgment').checked=false;
      this.get('restore-panel').hidden=false;this.message('Backup is ready for restore.');
    }catch(e){if(this.operation.isCurrent(signal))this.message(`Restore failed: ${String(e)}`,'error');}
  }
  private async commitRestore(){
    const plan=this.restore,button=this.get<HTMLButtonElement>('commit-restore');
    if(!plan||button.disabled)return;
    const signal=this.operation.begin(null);button.disabled=true;
    try{
      const result=await restoreBackup(plan,this.repository,signal,this.get<HTMLInputElement>('restore-acknowledgment').checked);
      this.operation.finish(signal);
      if(this.restore===plan){this.restore=null;this.get('restore-panel').hidden=true;this.get('restore-models').focus();}
      this.message(`Restored ${result.entries.length} entries. Settings failures: ${result.settingsFailures}.`);
      await this.refresh();
    }catch(e){if(this.operation.isCurrent(signal))this.message(`Restore failed: ${String(e)}`,'error');}
    finally{button.disabled=false;}
  }
  setVisible(value:boolean){this.visible=value;if(value)void this.refresh();else this.cancel();}
  private disposePreview(){cancelAnimationFrame(this.frame);this.preview?.dispose();this.preview=null;}
  cancel(){this.get('library-progress').hidden=true;this.useGeneration++;this.requestedEntry=null;this.restore=null;this.get('restore-panel').hidden=true;this.termsGeneration++;this.termsValid=true;this.get<HTMLInputElement>('terms-files').value='';this.get('attachment-terms').textContent='';this.operation.cancel();this.disposePreview();this.candidate=null;this.attachments=[];this.get('import-panel').hidden=true;this.get<HTMLInputElement>('acknowledge-terms').checked=false;this.get<HTMLButtonElement>('save-model').disabled=true;this.get<HTMLButtonElement>('try-model').disabled=true;}
  dispose(){this.cancel();this.refreshGeneration++;for(const url of this.thumbnailURLs)URL.revokeObjectURL(url);this.repository.changes.removeEventListener('change',this.refresh);window.removeEventListener('focus',this.refresh);}
}
