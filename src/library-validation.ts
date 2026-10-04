import { normalizeSettings, type StudioSettings } from './types';
import { imageSize } from './vrm-inspection';
import { packageVersion, modelName, sha256, validationVersion, type Attachment, type RegistrationDraft } from './model-types';

export const hashPattern = /^[a-f0-9]{64}$/;
export function recordFields(value: unknown, allowed: readonly string[], required = allowed): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid record.');
  const keys = Object.keys(value);
  if (keys.some(key => !allowed.includes(key)) || required.some(key => !Object.hasOwn(value, key))) throw new Error('Invalid record fields.');
}
export function validDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}
export function validatedSettings(value: unknown): StudioSettings {
  const normalized = normalizeSettings(value);
  recordFields(value, Object.keys(normalized));
  if (Object.entries(normalized).some(([key, expected]) => value[key] !== expected)) throw new Error('Invalid model settings.');
  return normalized;
}
export function sameJSON(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const left = a as Record<string, unknown>, right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every(key => Object.hasOwn(right, key) && sameJSON(left[key], right[key]));
}
export async function validateAttachments(attachments: Attachment[]): Promise<void> {
  if (!Array.isArray(attachments) || attachments.length > 9) throw new Error('Use at most eight terms files and one thumbnail.');
  let terms = 0, thumbnails = 0, termsBytes = 0;
  for (const attachment of attachments) {
    if (!attachment || !(attachment.blob instanceof Blob) || typeof attachment.originalFilename !== 'string' ||
      typeof attachment.mediaType !== 'string' || typeof attachment.encoding !== 'string' || !hashPattern.test(attachment.sha256)) {
      throw new Error('Invalid attachment metadata.');
    }
    if (attachment.kind === 'terms') {
      terms++; termsBytes += attachment.blob.size;
      if (!/\.(txt|md)$/i.test(attachment.originalFilename) || attachment.blob.size > 2 * 1024 * 1024 ||
        !['utf-8', 'shift_jis'].includes(attachment.encoding)) throw new Error('Use TXT or MD terms files of at most 2 MiB.');
    } else if (attachment.kind === 'thumbnail') {
      thumbnails++;
      if (attachment.mediaType !== 'image/png' || attachment.blob.size > 512 * 1024) throw new Error('Invalid thumbnail.');
      const bytes = new Uint8Array(await attachment.blob.slice(0, 24).arrayBuffer());
      const [width, height] = imageSize(bytes);
      if (bytes[0] !== 137 || width !== 320 || height !== 320) throw new Error('Thumbnail must be a 320 by 320 PNG.');
    } else throw new Error('Unsupported attachment kind.');
    if (await sha256(attachment.blob) !== attachment.sha256) throw new Error('Attachment hash does not match.');
  }
  if (terms > 8 || thumbnails > 1 || termsBytes > 8 * 1024 * 1024) throw new Error('Terms attachments exceed the storage limits.');
}
export async function validateRegistration(draft: RegistrationDraft): Promise<void> {
  modelName(draft.displayName);
  packageVersion(draft.packageVersion);
  if (typeof draft.originalFilename !== 'string' || !draft.originalFilename) throw new Error('The original filename is missing.');
  const inspection = draft.inspection;
  if (!inspection || !(inspection.blob instanceof Blob) || !hashPattern.test(inspection.hash) ||
    inspection.capabilities?.validationVersion !== validationVersion || !['0', '1'].includes(inspection.capabilities.vrmVersion)) {
    throw new Error('Inspect the model before save.');
  }
  const acknowledgment = draft.acknowledgment;
  recordFields(acknowledgment, ['acknowledgedAt', 'metadataDigest', 'attachmentHashes']);
  if (!validDate(acknowledgment.acknowledgedAt) || !hashPattern.test(acknowledgment.metadataDigest) ||
    !Array.isArray(acknowledgment.attachmentHashes) || acknowledgment.attachmentHashes.some(hash => typeof hash !== 'string' || !hashPattern.test(hash))) {
    throw new Error('Review the displayed terms before save.');
  }
  const digest = await sha256(new Blob([JSON.stringify(inspection.rawMeta)]));
  if (acknowledgment.metadataDigest !== digest) throw new Error('Model metadata has changed. Review the displayed terms again.');
  await validateAttachments(draft.attachments);
  const hashes = draft.attachments.filter(item => item.kind === 'terms').map(item => item.sha256).sort();
  if (!sameJSON(hashes, [...acknowledgment.attachmentHashes].sort())) throw new Error('Terms have changed. Review the terms again.');
}
