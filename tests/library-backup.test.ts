import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { backupLimits, createBackup, inspectBackup, restoreBackup, type BackupRepository } from '../src/library-backup';
import { validateRegistration } from '../src/library-validation';
import { sha256, type Attachment, type LibraryEntry, type RegistrationDraft } from '../src/model-types';
import { inspectVRM } from '../src/vrm-inspection';
import { defaults } from '../src/types';
import { avatarSettingsKey } from '../src/profiles';
import { renderableFixture } from './fixtures/vrm';

let values: Map<string, string>;
beforeEach(() => {
  values = new Map();
  vi.stubGlobal('localStorage', { getItem: vi.fn((key: string) => values.get(key) ?? null), setItem: vi.fn((key: string, value: string) => values.set(key, value)) });
});
afterEach(() => vi.unstubAllGlobals());

async function fixture() {
  const blob = renderableFixture(), inspection = await inspectVRM(blob);
  const terms = new Blob([new Uint8Array([0x82, 0xa0])]);
  const attachment: Attachment = { id: 'terms', modelId: 'source', kind: 'terms', originalFilename: 'terms.txt', mediaType: 'text/plain',
    blob: terms, sha256: await sha256(terms), encoding: 'shift_jis' };
  const draft: RegistrationDraft = { inspection, displayName: 'Original name', originalFilename: 'original.vrm', attachments: [attachment],
    acknowledgment: { acknowledgedAt: new Date().toISOString(), metadataDigest: await sha256(new Blob([JSON.stringify(inspection.rawMeta)])), attachmentHashes: [attachment.sha256] } };
  const entry: LibraryEntry = { id: 'source', sourceKind: 'imported', assetHash: inspection.hash, displayName: draft.displayName,
    originalFilename: draft.originalFilename, vrmVersion: '1', rawMeta: inspection.rawMeta, capabilities: inspection.capabilities,
    acknowledgment: draft.acknowledgment, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  const duplicates = new Map<string, LibraryEntry>();
  const repository: BackupRepository = {
    export: vi.fn(async () => blob), attachments: vi.fn(async () => [attachment]), inspect: vi.fn(inspectVRM),
    duplicate: vi.fn(async hash => duplicates.get(hash)), validateDraft: vi.fn(validateRegistration),
    registerMany: vi.fn(async (drafts: RegistrationDraft[]) => drafts.map(value => ({ ...entry, id: crypto.randomUUID(), displayName: value.displayName }))),
  };
  return { blob, inspection, attachment, draft, entry, repository, duplicates };
}
const signal = () => new AbortController().signal;
async function parts(blob: Blob) {
  const header = await blob.slice(0, 12).arrayBuffer(), length = new DataView(header).getUint32(8, true);
  return { manifest: JSON.parse(await blob.slice(12, 12 + length).text()), payload: blob.slice(12 + length) };
}
function container(manifest: unknown, payload: Blob) {
  const bytes = new TextEncoder().encode(JSON.stringify(manifest)), header = new Uint8Array(12);
  header.set(new TextEncoder().encode('VMLIB1\r\n')); new DataView(header.buffer).setUint32(8, bytes.length, true);
  return new Blob([header, bytes, payload]);
}
async function changed(blob: Blob, change: (manifest: any) => void) {
  const { manifest, payload } = await parts(blob); change(manifest); return container(manifest, payload);
}

it('exports the fixed binary header and preserves asset and CP932 terms bytes', async () => {
  const f = await fixture(), backup = await createBackup(f.repository, [f.entry]);
  expect(new TextDecoder().decode(await backup.slice(0, 8).arrayBuffer())).toBe('VMLIB1\r\n');
  expect(backup.type).toBe('application/octet-stream');
  const plan = await inspectBackup(backup, f.repository, signal(), vi.fn());
  expect(plan.drafts).toHaveLength(1);
  expect(await sha256(plan.drafts[0].inspection.blob)).toBe(f.inspection.hash);
  expect(await plan.drafts[0].attachments[0].blob.arrayBuffer()).toEqual(await f.attachment.blob.arrayBuffer());
  expect(plan.drafts[0].attachments[0].encoding).toBe('shift_jis');
  expect(f.repository.registerMany).not.toHaveBeenCalled();
});

it.each([
  ['unknown schema', (m: any) => { m.version = 2; }],
  ['invalid package version type', (m: any) => { m.entries[0].packageVersion = 2; }],
  ['empty package version', (m: any) => { m.entries[0].packageVersion = ' '; }],
  ['long package version', (m: any) => { m.entries[0].packageVersion = 'a'.repeat(81); }],
  ['missing date', (m: any) => { delete m.createdAt; }],
  ['invalid date', (m: any) => { m.createdAt = 'invalid'; }],
  ['unknown field', (m: any) => { m.upload = 'https://example.test'; }],
  ['too many entries', (m: any) => { m.entries = Array(101).fill(m.entries[0]); }],
  ['too many segments', (m: any) => { m.segments = Array(1001).fill(m.segments[0]); }],
  ['overlap', (m: any) => { m.segments[1].offset = 0; }],
  ['gap', (m: any) => { m.segments[1].offset++; }],
  ['out of bounds', (m: any) => { m.segments.at(-1).length++; }],
  ['negative length', (m: any) => { m.segments[0].length = -1; }],
  ['fractional length', (m: any) => { m.segments[0].length = .5; }],
  ['duplicate segment ID', (m: any) => { m.segments[1].id = m.segments[0].id; }],
  ['bad hash', (m: any) => { m.segments[0].sha256 = '0'.repeat(64); }],
  ['unknown segment kind', (m: any) => { m.segments[1].kind = 'video'; }],
  ['invalid source ID', (m: any) => { m.entries[0].sourceId = null; }],
  ['missing asset', (m: any) => { m.entries[0].assetSegmentId = 'missing'; }],
  ['invalid capability version', (m: any) => { m.entries[0].capabilityVersion = 0; }],
  ['changed metadata', (m: any) => { m.entries[0].metadata.name = 'Changed'; }],
  ['unsafe attachment type', (m: any) => { m.entries[0].attachments[0].originalFilename = 'terms.html'; }],
  ['invalid attachment encoding', (m: any) => { m.entries[0].attachments[0].encoding = 'unknown'; }],
  ['duplicate attachment reference', (m: any) => { m.entries[0].attachments.push(m.entries[0].attachments[0]); }],
  ['missing attachment reference', (m: any) => { m.entries[0].attachments[0].segmentId = 'missing'; }],
  ['extra acknowledgment field', (m: any) => { m.entries[0].acknowledgment.extra = 'unexpected'; }],
  ['invalid acknowledgment hash', (m: any) => { m.entries[0].acknowledgment.metadataDigest = '0'.repeat(64); }],
  ['unrelated settings', (m: any) => { m.settings = { ['0'.repeat(64)]: defaults }; }],
  ['invalid settings value', (m: any) => { m.settings = { [m.segments[0].sha256]: { ...defaults, zoom: 99 } }; }],
  ['calibration in settings', (m: any) => { m.settings = { [m.segments[0].sha256]: { ...defaults, calibration: {} } }; }],
])('rejects %s before any write, including an existing asset', async (_name, change) => {
  const f = await fixture(), backup = await createBackup(f.repository, [f.entry]);
  f.duplicates.set(f.entry.assetHash, f.entry);
  await expect(inspectBackup(await changed(backup, change), f.repository, signal(), vi.fn())).rejects.toThrow();
  expect(f.repository.registerMany).not.toHaveBeenCalled();
  expect(localStorage.setItem).not.toHaveBeenCalled();
});

it('rejects invalid header, manifest length, trailing bytes, and file size', async () => {
  const f = await fixture(), backup = await createBackup(f.repository, [f.entry]);
  const header = new Uint8Array(await backup.slice(0, 12).arrayBuffer());
  header[0] = 0;
  await expect(inspectBackup(new Blob([header, backup.slice(12)]), f.repository, signal(), vi.fn())).rejects.toThrow('header');
  header[0] = 86; new DataView(header.buffer).setUint32(8, backupLimits.manifest + 1, true);
  await expect(inspectBackup(new Blob([header, backup.slice(12)]), f.repository, signal(), vi.fn())).rejects.toThrow('manifest');
  await expect(inspectBackup(new Blob([backup, 'extra']), f.repository, signal(), vi.fn())).rejects.toThrow('after');
  const oversized = new Blob(); Object.defineProperty(oversized, 'size', { value: backupLimits.file + 1 });
  await expect(inspectBackup(oversized, f.repository, signal(), vi.fn())).rejects.toThrow('512 MiB');
});

it('rejects unreferenced segments after verifying their hashes', async () => {
  const f = await fixture(), backup = await createBackup(f.repository, [f.entry]), { manifest, payload } = await parts(backup);
  manifest.segments.push({ id: 'unused', kind: 'terms', offset: payload.size, length: 0, sha256: await sha256(new Blob()) });
  await expect(inspectBackup(container(manifest, payload), f.repository, signal(), vi.fn())).rejects.toThrow('unreferenced');
  expect(f.repository.registerMany).not.toHaveBeenCalled();
});

it('retains existing names and settings when an exact asset already exists', async () => {
  const f = await fixture();
  values.set(avatarSettingsKey(f.entry.assetHash), JSON.stringify(defaults));
  const backup = await createBackup(f.repository, [f.entry], true);
  const existing = { ...f.entry, id: 'existing', displayName: 'Keep this name' };
  f.duplicates.set(f.entry.assetHash, existing);
  values.set(avatarSettingsKey(f.entry.assetHash), JSON.stringify({ ...defaults, zoom: 1.25 }));
  const graphics = vi.fn(), plan = await inspectBackup(backup, f.repository, signal(), graphics);
  const result = await restoreBackup(plan, f.repository, signal());
  expect(result.entries).toEqual([existing]);
  expect(f.repository.registerMany).not.toHaveBeenCalled();
  expect(graphics).not.toHaveBeenCalled();
  expect(JSON.parse(values.get(avatarSettingsKey(f.entry.assetHash))!).zoom).toBe(1.25);
});

it('maps exact bundled bytes to their bundle and imports changed bundled bytes only after terms review', async () => {
  const f = await fixture(), bundled = { ...f.entry, id: 'ene', sourceKind: 'bundled' as const, acknowledgment: null };
  const backup = await createBackup(f.repository, [bundled]);
  f.duplicates.set(f.entry.assetHash, bundled);
  const exact = await inspectBackup(backup, f.repository, signal(), vi.fn());
  expect(exact.existing).toEqual([bundled]); expect(exact.drafts).toEqual([]);
  f.duplicates.clear();
  const different = await inspectBackup(backup, f.repository, signal(), vi.fn());
  expect(different.needsReview).toBe(true); expect(different.drafts).toHaveLength(1);
  await expect(restoreBackup(different, f.repository, signal())).rejects.toThrow('terms');
  expect(f.repository.registerMany).not.toHaveBeenCalled();
  const result = await restoreBackup(different, f.repository, signal(), true);
  expect(result.entries[0].id).not.toBe('ene');
});

it('validates candidates sequentially and saves them with one repository call', async () => {
  const f = await fixture(), other = await inspectVRM(renderableFixture(1));
  const second = { ...f.entry, id: 'second', assetHash: other.hash, rawMeta: other.rawMeta };
  vi.mocked(f.repository.export).mockImplementation(async id => id === 'second' ? other.blob : f.blob);
  const backup = await createBackup(f.repository, [f.entry, second]);
  let active = 0, maximum = 0, count = 0;
  const plan = await inspectBackup(backup, f.repository, signal(), async () => {
    active++; maximum = Math.max(maximum, active); count++;
    await Promise.resolve(); active--;
  });
  await restoreBackup(plan, f.repository, signal());
  expect(count).toBe(2); expect(maximum).toBe(1);
  expect(f.repository.registerMany).toHaveBeenCalledOnce();
  expect(vi.mocked(f.repository.registerMany).mock.calls[0][0]).toHaveLength(2);
});

it('reports settings failure after successful entry commit', async () => {
  const f = await fixture(); values.set(avatarSettingsKey(f.entry.assetHash), JSON.stringify(defaults));
  const backup = await createBackup(f.repository, [f.entry], true); values.clear();
  const plan = await inspectBackup(backup, f.repository, signal(), vi.fn());
  vi.mocked(localStorage.setItem).mockImplementation(() => { throw new DOMException('Storage denied', 'SecurityError'); });
  const result = await restoreBackup(plan, f.repository, signal());
  expect(result.entries).toHaveLength(1); expect(result.settingsFailures).toBe(1);
  expect(f.repository.registerMany).toHaveBeenCalledOnce();
});

it('does not export calibration or settings unless settings are selected', async () => {
  const f = await fixture(); values.set('vmodel-calibration:private', 'private');
  values.set(avatarSettingsKey(f.entry.assetHash), JSON.stringify(defaults));
  const without = await parts(await createBackup(f.repository, [f.entry]));
  expect(without.manifest).not.toHaveProperty('settings');
  const withSettings = await parts(await createBackup(f.repository, [f.entry], true));
  expect(Object.keys(withSettings.manifest.settings)).toEqual([f.entry.assetHash]);
  expect(JSON.stringify(withSettings.manifest)).not.toContain('private');
});

it('cancels before inspection, during graphics, and before an existing-only restore', async () => {
  const f = await fixture(), backup = await createBackup(f.repository, [f.entry]);
  const before = new AbortController(); before.abort();
  await expect(inspectBackup(backup, f.repository, before.signal, vi.fn())).rejects.toThrow();
  expect(f.repository.inspect).not.toHaveBeenCalled();
  const graphics = new AbortController();
  await expect(inspectBackup(backup, f.repository, graphics.signal, async () => { graphics.abort(); })).rejects.toThrow();
  f.duplicates.set(f.entry.assetHash, f.entry);
  const plan = await inspectBackup(backup, f.repository, signal(), vi.fn()); plan.settings[f.entry.assetHash] = defaults;
  await expect(restoreBackup(plan, f.repository, before.signal)).rejects.toThrow();
  expect(f.repository.registerMany).not.toHaveBeenCalled(); expect(localStorage.setItem).not.toHaveBeenCalled();
});

it('does not report rollback when cancellation follows the commit', async () => {
  const f = await fixture(), backup = await createBackup(f.repository, [f.entry]), controller = new AbortController();
  const plan = await inspectBackup(backup, f.repository, controller.signal, vi.fn());
  vi.mocked(f.repository.registerMany).mockImplementation(async () => { controller.abort(); return [f.entry]; });
  await expect(restoreBackup(plan, f.repository, controller.signal)).resolves.toMatchObject({ entries: [f.entry], settingsFailures: 0 });
});

it('preserves the supplied package version without changes to embedded metadata', async () => {
  const f = await fixture();
  f.entry.packageVersion = 'package-2';
  const backup = await createBackup(f.repository, [f.entry]);
  const plan = await inspectBackup(backup, f.repository, signal(), vi.fn());
  expect(plan.drafts[0].packageVersion).toBe('package-2');
  expect(plan.drafts[0].inspection.rawMeta).toEqual(f.inspection.rawMeta);
  await restoreBackup(plan, f.repository, signal());
  expect(vi.mocked(f.repository.registerMany).mock.calls[0][0][0].packageVersion).toBe('package-2');
});
