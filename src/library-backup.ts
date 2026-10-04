import { type Attachment, type LibraryEntry, type RegistrationDraft, sha256, modelName } from './model-types';
import type { LocalModelRepository } from './model-repository';
import { avatarSettingsKey } from './profiles';
import type { StudioSettings } from './types';
import { hashPattern, recordFields, sameJSON, validDate, validatedSettings } from './library-validation';

const magic = 'VMLIB1\r\n';
export const backupLimits = { file: 512 * 1024 * 1024, manifest: 2 * 1024 * 1024, entries: 100, segments: 1000 };
interface Segment { id: string; kind: 'asset' | 'thumbnail' | 'terms'; offset: number; length: number; sha256: string }
interface BackupEntry {
  sourceId: string; assetSegmentId: string; displayName: string; originalFilename: string; packageVersion?: string;
  metadata: LibraryEntry['rawMeta']; acknowledgment: LibraryEntry['acknowledgment']; capabilityVersion: number;
  attachments: { segmentId: string; originalFilename: string; mediaType: string; encoding: string }[];
}
interface Manifest {
  type: 'vmodel-library'; version: 1; createdAt: string; entries: BackupEntry[]; segments: Segment[];
  settings?: Record<string, StudioSettings>;
}
export type BackupRepository = Pick<LocalModelRepository, 'export' | 'attachments' | 'inspect' | 'duplicate' | 'validateDraft' | 'registerMany'>;
export interface RestorePlan {
  drafts: RegistrationDraft[]; existing: LibraryEntry[]; settings: Record<string, StudioSettings>; bytes: number; needsReview: boolean; reviewHashes: string[];
}

export async function createBackup(repository: BackupRepository, entries: LibraryEntry[], includeSettings = false): Promise<Blob> {
  if (!entries.length || entries.length > backupLimits.entries) throw new Error('Select 1 through 100 entries.');
  const manifest: Manifest = { type: 'vmodel-library', version: 1, createdAt: new Date().toISOString(), entries: [], segments: [] };
  const payload: Blob[] = [], hashes = new Set<string>();
  let offset = 0;
  const append = async (blob: Blob, kind: Segment['kind'], expectedHash?: string) => {
    const id = crypto.randomUUID(), hash = await sha256(blob);
    if (expectedHash && hash !== expectedHash) throw new Error('Saved bytes changed. Reload the library before backup.');
    manifest.segments.push({ id, kind, offset, length: blob.size, sha256: hash });
    payload.push(blob); offset += blob.size;
    if (offset > backupLimits.file) throw new Error('Backup exceeds 512 MiB. Select fewer models.');
    return id;
  };
  for (const entry of entries) {
    if (hashes.has(entry.assetHash)) throw new Error('Select each asset only once.');
    hashes.add(entry.assetHash);
    const assetSegmentId = await append(await repository.export(entry.id), 'asset', entry.assetHash);
    const attachments: BackupEntry['attachments'] = [];
    for (const attachment of entry.sourceKind === 'bundled' ? [] : await repository.attachments(entry.id)) {
      attachments.push({ segmentId: await append(attachment.blob, attachment.kind, attachment.sha256),
        originalFilename: attachment.originalFilename, mediaType: attachment.mediaType, encoding: attachment.encoding });
    }
    manifest.entries.push({ sourceId: entry.id, assetSegmentId, displayName: entry.displayName, originalFilename: entry.originalFilename, ...(entry.packageVersion===undefined?{}:{packageVersion:entry.packageVersion}),
      metadata: entry.rawMeta, acknowledgment: entry.acknowledgment, capabilityVersion: entry.capabilities.validationVersion, attachments });
    if (includeSettings) {
      const saved = localStorage.getItem(avatarSettingsKey(entry.assetHash));
      if (saved !== null) (manifest.settings ??= {})[entry.assetHash] = validatedSettings(JSON.parse(saved));
    }
  }
  const json = new TextEncoder().encode(JSON.stringify(manifest));
  if (json.length > backupLimits.manifest || manifest.segments.length > backupLimits.segments || offset + 12 + json.length > backupLimits.file) {
    throw new Error('Backup exceeds the format limits.');
  }
  const header = new Uint8Array(12);
  header.set(new TextEncoder().encode(magic)); new DataView(header.buffer).setUint32(8, json.length, true);
  return new Blob([header, json, ...payload], { type: 'application/octet-stream' });
}

export async function inspectBackup(blob: Blob, repository: BackupRepository, signal: AbortSignal,
  validateGraphics: (blob: Blob, signal: AbortSignal) => Promise<void>): Promise<RestorePlan> {
  signal.throwIfAborted();
  if (blob.size < 12 || blob.size > backupLimits.file) throw new Error('Backup must be at most 512 MiB.');
  const header = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  if (new TextDecoder().decode(header.subarray(0, 8)) !== magic) throw new Error('Invalid backup header.');
  const length = new DataView(header.buffer).getUint32(8, true), start = 12 + length;
  if (length > backupLimits.manifest || start > blob.size) throw new Error('Invalid backup manifest size.');
  const parsed: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await blob.slice(12, start).arrayBuffer()));
  recordFields(parsed, ['type', 'version', 'createdAt', 'entries', 'segments', 'settings'], ['type', 'version', 'createdAt', 'entries', 'segments']);
  const manifest = parsed as unknown as Manifest;
  if (manifest.type !== 'vmodel-library' || manifest.version !== 1 || !validDate(manifest.createdAt) ||
    !Array.isArray(manifest.entries) || !manifest.entries.length || manifest.entries.length > backupLimits.entries ||
    !Array.isArray(manifest.segments) || manifest.segments.length > backupLimits.segments) throw new Error('Unsupported backup schema or size.');
  const segments = new Map<string, { blob: Blob; segment: Segment }>();
  let offset = 0;
  for (const segment of manifest.segments) {
    recordFields(segment, ['id', 'kind', 'offset', 'length', 'sha256']);
    if (typeof segment.id !== 'string' || !segment.id || segments.has(segment.id) || !['asset', 'terms', 'thumbnail'].includes(segment.kind) ||
      !Number.isSafeInteger(segment.length) || segment.length < 0 || segment.offset !== offset || start + offset + segment.length > blob.size ||
      typeof segment.sha256 !== 'string' || !hashPattern.test(segment.sha256)) throw new Error('Invalid backup segment.');
    const data = blob.slice(start + offset, start + offset + segment.length);
    if (await sha256(data) !== segment.sha256) throw new Error('Backup hash check failed. No entries were saved.');
    signal.throwIfAborted(); segments.set(segment.id, { blob: data, segment }); offset += segment.length;
  }
  if (start + offset !== blob.size) throw new Error('Unexpected bytes after backup payload.');
  const plan: RestorePlan = { drafts: [], existing: [], settings: {}, bytes: blob.size, needsReview: false, reviewHashes: [] };
  const hashes = new Set<string>(), sourceIds = new Set<string>(), usedSegments = new Set<string>();
  for (const entry of manifest.entries) {
    recordFields(entry, ['sourceId', 'assetSegmentId', 'displayName', 'originalFilename', 'metadata', 'acknowledgment', 'capabilityVersion', 'attachments','packageVersion'], ['sourceId', 'assetSegmentId', 'displayName', 'originalFilename', 'metadata', 'acknowledgment', 'capabilityVersion', 'attachments']);
    modelName(entry.displayName);
    const asset = segments.get(entry.assetSegmentId);
    if (typeof entry.sourceId !== 'string' || !entry.sourceId || sourceIds.has(entry.sourceId) || !asset || asset.segment.kind !== 'asset' ||
      !Array.isArray(entry.attachments) || entry.attachments.length > 9 || typeof entry.originalFilename !== 'string' || !entry.originalFilename ||
      !Number.isSafeInteger(entry.capabilityVersion) || entry.capabilityVersion < 1) throw new Error('Invalid backup entry.');
    sourceIds.add(entry.sourceId); usedSegments.add(entry.assetSegmentId);
    const inspection = await repository.inspect(asset.blob, signal);
    if (inspection.hash !== asset.segment.sha256 || hashes.has(inspection.hash)) throw new Error('Invalid or duplicate asset in backup.');
    if (!sameJSON(entry.metadata, inspection.rawMeta)) throw new Error('Backup metadata does not match the original model.');
    hashes.add(inspection.hash);
    const attachments: Attachment[] = [], attachmentIds = new Set<string>();
    for (const attachment of entry.attachments) {
      recordFields(attachment, ['segmentId', 'originalFilename', 'mediaType', 'encoding']);
      const item = segments.get(attachment.segmentId);
      if (!item || item.segment.kind === 'asset' || attachmentIds.has(attachment.segmentId)) throw new Error('Invalid attachment reference.');
      attachmentIds.add(attachment.segmentId); usedSegments.add(attachment.segmentId);
      attachments.push({ id: crypto.randomUUID(), modelId: '', kind: item.segment.kind, blob: item.blob, sha256: item.segment.sha256,
        originalFilename: attachment.originalFilename, mediaType: attachment.mediaType, encoding: attachment.encoding });
    }
    const needsReview = entry.acknowledgment === null;
    const acknowledgment = entry.acknowledgment ?? { acknowledgedAt: new Date().toISOString(),
      metadataDigest: await sha256(new Blob([JSON.stringify(inspection.rawMeta)])), attachmentHashes: attachments.filter(x => x.kind === 'terms').map(x => x.sha256) };
    const draft: RegistrationDraft = { inspection, displayName: entry.displayName, originalFilename: entry.originalFilename, ...(entry.packageVersion===undefined?{}:{packageVersion:entry.packageVersion}), acknowledgment, attachments };
    await repository.validateDraft(draft);
    signal.throwIfAborted();
    const existing = await repository.duplicate(inspection.hash);
    signal.throwIfAborted();
    if (existing) { plan.existing.push(existing); continue; }
    await validateGraphics(asset.blob, signal);
    signal.throwIfAborted();
    plan.needsReview ||= needsReview;
    if(needsReview)plan.reviewHashes.push(inspection.hash);
    plan.drafts.push(draft);
  }
  if (usedSegments.size !== segments.size) throw new Error('Backup contains an unreferenced segment.');
  if (manifest.settings !== undefined) {
    recordFields(manifest.settings, [...hashes], []);
    for (const [hash, settings] of Object.entries(manifest.settings)) plan.settings[hash] = validatedSettings(settings);
  }
  return plan;
}

export async function restoreBackup(plan: RestorePlan, repository: BackupRepository, signal: AbortSignal, termsReviewed = false) {
  signal.throwIfAborted();
  if (plan.needsReview && !termsReviewed) throw new Error('Review the displayed terms before restore.');
  const settings = Object.entries(plan.settings).map(([hash, value]) => {
    if (!hashPattern.test(hash)) throw new Error('Invalid model settings hash.');
    return [avatarSettingsKey(hash), validatedSettings(value)] as const;
  });
  const drafts=plan.drafts.map(draft=>plan.reviewHashes.includes(draft.inspection.hash)
    ? {...draft,acknowledgment:{...draft.acknowledgment,acknowledgedAt:new Date().toISOString()}} : draft);
  // Cancellation after this transaction cannot undo saved entries.
  const entries = plan.drafts.length ? await repository.registerMany(drafts, signal) : [];
  if (!plan.drafts.length) signal.throwIfAborted();
  let settingsFailures = 0;
  for (const [key, value] of settings) {
    try { if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(value)); }
    catch { settingsFailures++; }
  }
  return { entries: [...plan.existing, ...entries], settingsFailures };
}

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob), anchor = document.createElement('a');
  anchor.href = url; anchor.download = name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 160) || 'model.vrm'; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
