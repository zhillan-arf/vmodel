"""Reconcile final staged bytes/hashes, exact family parity and private evidence."""
from pathlib import Path
import json
from web_production import ROOT, IDS, read_json, write_json, sha, plan

public = ROOT / 'web-showcase/public/ene'
manifest = read_json(public / 'manifest.json')
if manifest['schemaVersion'] != 1 or set(manifest['resources']) != set(IDS):
    raise RuntimeError('Expected schema 1 and exactly five logical resources')
expected_files = {'manifest.json', 'alpha-probe.webm'}
records = []
desk_anchor = manifest['resources']['desk-normal']['anchor']
for resource in IDS:
    recipe = plan(resource)
    item = manifest['resources'][resource]
    report = read_json(ROOT / f'ops/reports/{resource}-production.json')
    if report['state'] != 'complete' or report['buildKey'] != recipe['buildKey'] or report['publicResource'] != item:
        raise RuntimeError(f'{resource}: stale public/private resource evidence')
    if item['fps'] != 24 or item['frameCount'] != recipe['frameCount'] or item['durationSeconds'] != recipe['durationSeconds'] or not item['loop']:
        raise RuntimeError('Timeline does not match accepted source')
    if resource.startswith('desk-') and max(abs(item['anchor'][axis] - desk_anchor[axis]) for axis in ('x', 'y')) > 1e-6:
        raise RuntimeError('Desk anchor mismatch')
    for size in ('small', 'large'):
        dimensions = recipe['smallSize' if size == 'small' else 'size']
        for family, codecs in [('renditions', ('webm', 'webp')), ('posters', ('webp', 'png'))]:
            for codec in codecs:
                asset = item[family][size][codec]
                url = asset['url']
                if '\\' in url or '..' in Path(url).parts or Path(url).is_absolute():
                    raise RuntimeError('Unsafe public media URL')
                path = public / url
                if path.stat().st_size != asset['bytes'] or sha(path) != asset['sha256'] or [asset['width'], asset['height']] != dimensions:
                    raise RuntimeError(f'{url}: metadata does not match actual file')
                evidence = next(file for file in report['files'] if file['sha256'] == asset['sha256'] and file['size'] == size)
                if not evidence['decoded']['allFramesTransparent'] or evidence['decoded']['decodedFrameCount'] != (item['frameCount'] if family == 'renditions' else 1):
                    raise RuntimeError('Incomplete actual decode/alpha evidence')
                if family == 'renditions' and (not evidence['withinBudget'] or abs(asset['durationSeconds'] - item['durationSeconds']) > .002):
                    raise RuntimeError('Timing/byte target failure')
                if family == 'posters' and codec == 'webp' and asset['bytes'] > (150 if size == 'large' else 75) * 1024:
                    raise RuntimeError('Poster byte target failure')
                expected_files.add(url)
                records.append({'resource': resource, 'size': size, 'family': family, 'codec': codec, 'bytes': asset['bytes'],
                                'sha256': asset['sha256'], 'decodedFrames': evidence['decoded']['decodedFrameCount'],
                                'loopSeamSampleMae255': evidence['decoded']['loopSeamSampleMae255']})
    for axis in ('x', 'y', 'width', 'height'):
        if not 0 <= item['bounds'][axis] <= 1:
            raise RuntimeError('Visible bounds outside normalized image')
probe = manifest['probes']['webmAlpha']
if (public / probe['url']).stat().st_size != probe['bytes'] or sha(public / probe['url']) != probe['sha256']:
    raise RuntimeError('Probe metadata mismatch')
actual_files = {path.relative_to(public).as_posix() for path in public.rglob('*') if path.is_file()}
if actual_files != expected_files:
    raise RuntimeError(f'Staging allowlist mismatch: extra={actual_files - expected_files}; missing={expected_files - actual_files}')
large_webm_bytes = sum(item['renditions']['large']['webm']['bytes'] for item in manifest['resources'].values())
if large_webm_bytes > 9 * 1048576:
    raise RuntimeError('Combined large WebM byte target failure')
originals = read_json(ROOT / 'ops/reports/web-performance-baselines.json')['preservedSources']
preserved = {}
for path, evidence in originals.items():
    actual_sha = sha(ROOT / path)
    if actual_sha != evidence['sha256']:
        raise RuntimeError(f'Original source changed: {path}')
    preserved[path] = actual_sha
report = {'passed': True, 'logicalResources': list(IDS), 'familyFiles': len(records), 'stagedFiles': len(actual_files),
          'stagedBytesIncludingManifest': sum(path.stat().st_size for path in public.rglob('*') if path.is_file()),
          'masterFrames': sum(plan(resource)['frameCount'] for resource in IDS), 'combinedLargeWebmBytes': large_webm_bytes,
          'allStagedHashesMatch': True, 'allMediaDecodedWithAlpha': True, 'allBudgetsPass': True,
          'originalPmxVmdHashesUnchanged': True, 'acceptedG1BlendVrmHashesUnchanged': True,
          'preservedSourceHashes': preserved, 'privateSourcesExcluded': True, 'files': records,
          'scope': 'Actual hashes and all-frame decoder evidence; browser visual/lifecycle and real-device coverage are separate.'}
write_json(ROOT / 'ops/reports/web-production-audit.json', report)
print(json.dumps({key: value for key, value in report.items() if key != 'files'}, indent=2))
