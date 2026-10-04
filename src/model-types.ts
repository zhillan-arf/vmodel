export type ModelId = string;
export type AssetHash = string;
export const validationVersion = 1;
export interface CapabilityReport {
  validationVersion: number;
  vrmVersion: '0' | '1';
  missingOptionalBones: string[];
  expressions: string[];
  aliases: Record<string, string>;
  springs: boolean;
  warnings: string[];
}
export interface Acknowledgment { acknowledgedAt: string; metadataDigest: string; attachmentHashes: string[] }
export interface LibraryEntry {
  id: ModelId; assetHash: AssetHash; sourceKind: 'bundled' | 'imported'; displayName: string;
  originalFilename: string; packageVersion?: string; vrmVersion: '0' | '1'; rawMeta: Record<string, unknown>;
  capabilities: CapabilityReport; acknowledgment: Acknowledgment | null; createdAt: string; updatedAt: string;
}
export interface Attachment {
  id: string; modelId: ModelId; kind: 'thumbnail' | 'terms'; originalFilename: string;
  mediaType: string; blob: Blob; sha256: string; encoding: string;
}
export interface InspectionResult {
  blob: Blob; hash: AssetHash; rawMeta: Record<string, unknown>; capabilities: CapabilityReport;
  resources: { geometryBytes: number; textureBytes: number; pixels: number };
}
export interface RegistrationDraft {
  inspection: InspectionResult; displayName: string; originalFilename: string; packageVersion?: string;
  acknowledgment: Acknowledgment; attachments: Attachment[];
}
export interface ResolvedAsset { blob: Blob; hash: AssetHash; entryId: ModelId; label: string }
export interface ModelRepository {
  list(): Promise<LibraryEntry[]>;
  inspect(file: Blob, signal: AbortSignal): Promise<InspectionResult>;
  register(draft: RegistrationDraft, signal: AbortSignal): Promise<LibraryEntry>;
  resolve(id: ModelId, signal: AbortSignal): Promise<ResolvedAsset>;
  rename(id: ModelId, name: string): Promise<void>;
  remove(id: ModelId): Promise<void>;
  export(id: ModelId): Promise<Blob>;
}
export function modelName(name: string): string {
  if(typeof name !== 'string')throw new Error('Use a name with 1 through 80 characters.');
  const trimmed = name.trim();
  if (!trimmed || [...trimmed].length > 80) throw new Error('Use a name with 1 through 80 characters.');
  return trimmed;
}
export async function sha256(blob: Blob): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))].map(x => x.toString(16).padStart(2, '0')).join('');
}
export function checkAbort(signal?: AbortSignal) { signal?.throwIfAborted(); }

export function packageVersion(value:unknown):string|undefined {
  if(value===undefined)return undefined;
  if(typeof value!=='string'||!value.trim()||[...value.trim()].length>80)throw new Error('Use a package version with 1 through 80 characters.');
  return value.trim();
}
