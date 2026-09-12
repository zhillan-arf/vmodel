export const resourceIds = ['home-greeting', 'desk-normal', 'desk-confused', 'desk-surprised', 'desk-excited'] as const;
export type ResourceId = typeof resourceIds[number];
export type RenditionSize = 'small' | 'large';
export interface Asset { url: string; mime: string; codec: string; width: number; height: number; bytes: number; sha256: string }
interface Rect { x: number; y: number; width: number; height: number }
export interface Resource {
  label: string; durationSeconds: number; fps: number; frameCount: number; loop: boolean;
  renderSize: { width: number; height: number }; bounds: Rect; safeRegion: Rect;
  anchor: { kind: 'foot' | 'desk'; x: number; y: number };
  renditions: Record<RenditionSize, { width: number; height: number; webm: Asset; webp: Asset }>;
  posters: Record<RenditionSize, { webp: Asset; png: Asset }>;
}
export interface Manifest {
  schemaVersion: 1; character: { id: string; variant: string; sourceRevision: string };
  credits: { name: string; url: string }[];
  probes: { webmAlpha: Asset & { transparentPixel: [number, number]; opaquePixel: [number, number] } };
  resources: Record<ResourceId, Resource>;
}
export function assetUrl(base: URL, asset: Pick<Asset, 'url'>): string {
  // The generated contract uses plain relative file paths. Reject encoded path
  // separators before Windows/Vite can decode them into directory traversal.
  if (typeof asset.url !== 'string' || asset.url.length > 512 ||
    !/^(?:[A-Za-z0-9_-][A-Za-z0-9._-]*\/)*[A-Za-z0-9_-][A-Za-z0-9._-]*$/.test(asset.url)) {
    throw new Error('A character resource has an invalid relative file path.');
  }
  const result = new URL(asset.url, base);
  if (result.origin !== base.origin || !result.pathname.startsWith(base.pathname) || !/^https?:$/.test(result.protocol)) {
    throw new Error('A character resource points outside its media directory.');
  }
  return result.href;
}
export async function loadManifest(url: string): Promise<{ manifest: Manifest; base: URL }> {
  const manifestUrl = new URL(url, document.baseURI), base = new URL('.', manifestUrl);
  const response = await fetch(manifestUrl);
  if (!response.ok) throw new Error('The character package is unavailable. Restore ene/manifest.json and reload.');
  const manifest = await response.json() as Manifest;
  if (manifest.schemaVersion !== 1 || !manifest.resources || !manifest.probes?.webmAlpha || !manifest.character) {
    throw new Error('This character package has an unsupported manifest.');
  }
  const positive = (n: number) => Number.isFinite(n) && n > 0;
  for (const id of resourceIds) {
    const item = manifest.resources[id];
    if (!item || typeof item.label !== 'string' || !positive(item.durationSeconds) ||
      !positive(item.renderSize?.width) || !positive(item.renderSize?.height) ||
      !Number.isFinite(item.anchor?.x) || !Number.isFinite(item.anchor?.y)) throw new Error(`The ${id} resource is incomplete.`);
    for (const size of ['small', 'large'] as const) {
      if (!positive(item.renditions?.[size]?.width) || !positive(item.renditions[size].height)) throw new Error(`Missing ${id} ${size} rendition.`);
      for (const file of [item.renditions[size].webm, item.renditions[size].webp, item.posters?.[size]?.webp, item.posters?.[size]?.png]) {
        if (!file || typeof file.url !== 'string' || !positive(file.bytes)) throw new Error(`Missing ${id} media file.`);
        assetUrl(base, file);
      }
    }
  }
  const probe = manifest.probes.webmAlpha;
  if (!positive(probe.width) || !positive(probe.height) || probe.width > 128 || probe.height > 128 ||
    ![probe.transparentPixel, probe.opaquePixel].every(point => Array.isArray(point) && point.length === 2 && point.every((n, i) => Number.isInteger(n) && n >= 0 && n < (i ? probe.height : probe.width)))) {
    throw new Error('The transparency probe is invalid.');
  }
  assetUrl(base, probe);
  return { manifest, base };
}
