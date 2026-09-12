"""Encode and fully decode final private masters, then stage completed families.

python scripts/encode_web_production.py [resource ...]
Only completed families appear in partial-manifest.json; manifest.json requires five.
"""
from pathlib import Path
import hashlib
import json
import shutil
import subprocess
import sys
import tempfile
import time
from web_media import webp_info
from web_production import ROOT, IDS, WORK, plan, read_json, write_json, sha, relative, png_info

CONFIG = read_json(ROOT / 'config/web-resources/encoding.json')
TOOLS = read_json(ROOT / 'config/web-resources/toolchain.json')
FF = ROOT / TOOLS['ffmpeg']['installDirectory'] / 'bin/ffmpeg.exe'
FP = FF.with_name('ffprobe.exe')
PUBLIC = ROOT / 'web-showcase/public/ene'
LABELS = {'home-greeting': 'Hello from Ene', 'desk-normal': 'Normal', 'desk-confused': 'Confused',
          'desk-surprised': 'Surprised', 'desk-excited': 'Excited'}

def run(arguments):
    command = [str(FF), '-hide_banner', '-v', 'error', '-y', '-threads', '4', '-filter_threads', '2', *map(str, arguments)]
    started = time.perf_counter()
    subprocess.run(command, check=True)
    return {'arguments': command, 'command': subprocess.list2cmdline(command), 'seconds': time.perf_counter() - started}

def probe(path):
    return json.loads(subprocess.check_output([str(FP), '-v', 'error', '-count_frames', '-show_streams', '-show_format', '-of', 'json', str(path)], text=True))

def decoded_frames(path, width, height, expected_count):
    """Read every actual decoder frame; never infer alpha from container tags."""
    codec = ['-c:v', 'libvpx-vp9'] if path.suffix == '.webm' else []
    command = [str(FF), '-v', 'error', '-threads', '4', *codec, '-i', str(path), '-fps_mode', 'passthrough',
               '-pix_fmt', 'rgba', '-f', 'rawvideo', 'pipe:1']
    stride = width * height * 4
    records, first, last, previous = [], None, None, None
    union = [width, height, 0, 0]
    max_step, last_step = 0, 0
    with tempfile.TemporaryFile() as errors:
        process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=errors)
        try:
            while True:
                raw = process.stdout.read(stride)
                if not raw:
                    break
                if len(raw) != stride:
                    raise RuntimeError(f'Truncated decoded frame: {path.name}')
                alpha = raw[3::4]
                zeros, full = alpha.count(0), alpha.count(255)
                if not zeros or not full or alpha[0] != 0:
                    raise RuntimeError(f'Transparency lost in {path.name} frame {len(records)}')
                bounds = [width, height, 0, 0]
                for y in range(height):
                    row = alpha[y * width:(y + 1) * width]
                    occupied = row.strip(b'\x00')
                    if occupied:
                        bounds[0] = min(bounds[0], width - len(row.lstrip(b'\x00')))
                        bounds[1] = min(bounds[1], y)
                        bounds[2] = max(bounds[2], len(row.rstrip(b'\x00')))
                        bounds[3] = max(bounds[3], y + 1)
                union = [min(union[0], bounds[0]), min(union[1], bounds[1]), max(union[2], bounds[2]), max(union[3], bounds[3])]
                # A fixed sparse premultiplied-RGBA sample makes adjacent/seam checks bounded.
                sample = []
                for pixel in range(0, width * height, max(1, width * height // 4096)):
                    at = pixel * 4
                    a = raw[at + 3]
                    sample.extend((raw[at] * a / 255, raw[at + 1] * a / 255, raw[at + 2] * a / 255, a))
                if first is None:
                    first = sample
                if previous is not None:
                    last_step = sum(abs(a - b) for a, b in zip(previous, sample)) / len(sample)
                    max_step = max(max_step, last_step)
                previous, last = sample, sample
                records.append({'frame': len(records) + 1, 'sha256Rgba': hashlib.sha256(raw).hexdigest(),
                                'transparentPixels': zeros, 'opaquePixels': full, 'partialPixels': len(alpha) - zeros - full,
                                'cornerAlpha': alpha[0], 'boundsPixels': bounds})
            code = process.wait(timeout=60)
            errors.seek(0)
            error_text = errors.read().decode(errors='replace')
            if code or error_text.strip():
                raise RuntimeError(f'Decode failed ({code}) {path.name}: {error_text}')
        finally:
            if process.poll() is None:
                process.kill()
                process.wait()
            process.stdout.close()
    if len(records) != expected_count:
        raise RuntimeError(f'{path.name}: decoded {len(records)} != expected {expected_count}')
    if expected_count > 1 and len({item['sha256Rgba'] for item in records}) < expected_count // 2:
        raise RuntimeError(f'{path.name}: unexpectedly static/repeated sequence')
    return {'command': subprocess.list2cmdline(command), 'decodedFrameCount': len(records), 'allFramesTransparent': True,
            'boundsPixels': union, 'bounds': {'x': union[0] / width, 'y': union[1] / height,
             'width': (union[2] - union[0]) / width, 'height': (union[3] - union[1]) / height},
            'maximumAdjacentSampleMae255': max_step, 'lastAdjacentSampleMae255': last_step,
            'loopSeamSampleMae255': sum(abs(a - b) for a, b in zip(first, last)) / len(first),
            'frames': records}

def asset(path, public_url, width, height, codec, duration=None, count=None, fps=None):
    result = {'url': public_url, 'mime': 'video/webm' if codec == 'vp9' else 'image/png' if codec == 'png' else 'image/webp',
              'codec': codec, 'width': width, 'height': height, 'bytes': path.stat().st_size, 'sha256': sha(path)}
    if duration is not None:
        result.update(durationSeconds=duration, frameCount=count, fps=fps)
    return result

def encoding_key(recipe, index):
    return hashlib.sha256(json.dumps({'recipe': recipe, 'encoding': CONFIG, 'toolchain': TOOLS['ffmpeg'],
        'frames': [index['frames'][str(frame)]['sha256'] for frame in range(1, recipe['frameCount'] + 1)]}, sort_keys=True).encode()).hexdigest()[:20]

def stage_probe():
    PUBLIC.mkdir(parents=True, exist_ok=True)
    source = ROOT / 'ops/reports/local/web-resource-spike/alpha-probe.webm'
    target = PUBLIC / 'alpha-probe.webm'
    shutil.copyfile(source, target)
    measured = probe(target)
    stream = measured['streams'][0]
    if (stream['width'], stream['height'], int(stream['nb_read_frames'])) != (32, 32, 2):
        raise RuntimeError('Known-alpha probe shape/count mismatch')
    raw = subprocess.check_output([str(FF), '-v', 'error', '-c:v', 'libvpx-vp9', '-i', str(target),
                                   '-fps_mode', 'passthrough', '-pix_fmt', 'rgba', '-f', 'rawvideo', 'pipe:1'])
    if len(raw) != 32 * 32 * 4 * 2 or raw[3] != 0 or raw[(24 * 32 + 24) * 4 + 3] != 255:
        raise RuntimeError('Known-alpha probe pixels failed actual decode')
    metadata = asset(target, 'alpha-probe.webm', 32, 32, 'vp9', float(measured['format']['duration']), 2, 24)
    metadata.update(transparentPixel=[0, 0], opaquePixel=[24, 24])
    return metadata

def write_manifests():
    source = read_json(ROOT / 'config/web-resources/source.json')
    manifest = {'schemaVersion': 1, 'character': {'id': 'ene', 'variant': 'cyber-legs',
                'sourceRevision': source['originals']['ops/resources/ENE/ENE Cyber legs ver.pmx']},
                'credits': [{'name': 'AuroraYok / yokkaulove — Ene model edit',
                  'url': 'https://www.deviantart.com/aurorayok/art/MMD--ENE-NEW-VER.-DL!!!-433555045'}],
                'probes': {'webmAlpha': stage_probe()}, 'resources': {}}
    builds = {}
    for resource in IDS:
        report_path = ROOT / f'ops/reports/{resource}-production.json'
        if not report_path.exists():
            continue
        report = read_json(report_path)
        recipe = plan(resource)
        if report['buildKey'] != recipe['buildKey'] or report['state'] != 'complete' or report['encodeKey'] != encoding_key(recipe, read_json(ROOT / report['masterIndex'])):
            continue
        public_resource = report['publicResource']
        files = [public_resource['renditions'][size][codec] for size in ('small', 'large') for codec in ('webm', 'webp')]
        files += [public_resource['posters'][size][codec] for size in ('small', 'large') for codec in ('webp', 'png')]
        if not all((PUBLIC / file['url']).is_file() and sha(PUBLIC / file['url']) == file['sha256'] for file in files):
            continue
        manifest['resources'][resource] = public_resource
        builds[resource] = {'report': relative(report_path), 'buildKey': report['buildKey'], 'masters': report['masterIndex']}
    write_json(PUBLIC / 'partial-manifest.json', manifest)
    write_json(WORK / 'production-build.json', {'schemaVersion': 1, 'resources': builds, 'encoderSettings': CONFIG,
                                              'toolchain': TOOLS, 'publicDirectory': relative(PUBLIC)})
    if len(manifest['resources']) == 5:
        write_json(PUBLIC / 'manifest.json', manifest)
        (PUBLIC / 'partial-manifest.json').unlink(missing_ok=True)
        print('FINAL_MANIFEST_READY', relative(PUBLIC / 'manifest.json'), flush=True)
    else:
        (PUBLIC / 'manifest.json').unlink(missing_ok=True)
    print('STAGED_FAMILIES', ','.join(manifest['resources']), flush=True)

def encode(resource):
    recipe = plan(resource)
    master = ROOT / recipe['masterDirectory']
    index = read_json(master / 'index.json')
    if index['state'] != 'complete' or len(index['frames']) != recipe['frameCount']:
        raise RuntimeError(f'{resource}: complete accepted masters required')
    for frame in range(1, recipe['frameCount'] + 1):
        info = png_info(master / f'frame-{frame:04d}.png', recipe['size'])
        if info['sha256'] != index['frames'][str(frame)]['sha256']:
            raise RuntimeError(f'{resource}: master hash mismatch frame {frame}')
    encode_key = encoding_key(recipe, index)
    folder = WORK / resource / 'encoded' / encode_key
    folder.mkdir(parents=True, exist_ok=True)
    count, seconds = recipe['frameCount'], recipe['durationSeconds']
    audit = read_json(ROOT / f'ops/reports/{resource}-audit.json')
    anchor = audit['deskAnchorTopOrigin'] if resource.startswith('desk-') else [.5, 1 - audit['frames'][0]['wholeUvMin'][1]]
    public_resource = {'label': LABELS[resource], 'durationSeconds': seconds, 'fps': 24, 'frameCount': count, 'loop': True,
       'renderSize': dict(zip(('width', 'height'), recipe['size'])), 'anchor': {'kind': 'desk' if resource.startswith('desk-') else 'foot', 'x': anchor[0], 'y': anchor[1]},
       'safeRegion': {'x': .05, 'y': .05, 'width': .9, 'height': .9}, 'renditions': {}, 'posters': {}}
    records, staged = [], []
    for size_name, dimensions in [('small', recipe['smallSize']), ('large', recipe['size'])]:
        width, height = dimensions
        resize = f'scale={width}:{height}:flags=lanczos,format=rgba'
        rendition = {'width': width, 'height': height}
        posters = {}
        for codec in ('webm', 'webp', 'poster-webp', 'poster-png'):
            animated = codec in ('webm', 'webp')
            suffix = codec if animated else 'webp' if codec == 'poster-webp' else 'png'
            name = f'{size_name}{"" if animated else "-poster"}.{suffix}'
            path = folder / name
            stamp = path.with_suffix(path.suffix + '.json')
            if stamp.exists() and path.exists() and read_json(stamp).get('sha256') == sha(path):
                record = read_json(stamp)
            else:
                base = ['-framerate', '24', '-start_number', '1', '-i', master / 'frame-%04d.png', '-frames:v', count if animated else 1, '-an', '-vf', resize]
                if codec == 'webm':
                    options = ['-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', CONFIG['webm']['crf'], '-deadline', 'good', '-cpu-used', '2', '-row-mt', '1', '-threads', '4', '-auto-alt-ref', '0']
                elif codec == 'webp':
                    options = ['-c:v', 'libwebp_anim', '-pix_fmt', 'yuva420p', '-quality', CONFIG['webp']['quality'], '-compression_level', '4', '-loop', '0']
                elif codec == 'poster-webp':
                    options = ['-c:v', 'libwebp', '-quality', CONFIG['poster']['quality']]
                else:
                    options = ['-c:v', 'png', '-pix_fmt', 'rgba']
                record = run([*base, *options, path])
                metadata = probe(path)
                streams = metadata['streams']
                if len(streams) != 1 or streams[0].get('codec_type') != 'video':
                    raise RuntimeError('Expected one silent video/image stream')
                stream = streams[0]
                if (stream['width'], stream['height']) != (width, height) or int(stream['nb_read_frames']) != (count if animated else 1):
                    raise RuntimeError('Encoded dimensions/frame count mismatch')
                duration = None
                if codec == 'webm':
                    duration = float(metadata['format']['duration'])
                    if abs(duration - seconds) > .002 or stream['r_frame_rate'] != '24/1':
                        raise RuntimeError('WebM timing mismatch')
                elif codec == 'webp':
                    timing = webp_info(path)
                    record['webpAnimation'] = {key: value for key, value in timing.items() if key != 'frames'}
                    duration = timing['durationMs'] / 1000
                    if timing['frameCount'] != count or not timing['alpha'] or not timing['animated'] or timing['loopCount'] != 0 or abs(duration - seconds) > .002:
                        raise RuntimeError('WebP animation/timing mismatch')
                decode = decoded_frames(path, width, height, count if animated else 1)
                record.update(file=relative(path), sha256=sha(path), bytes=path.stat().st_size, codec=codec, size=size_name,
                    width=width, height=height, durationSeconds=duration, frameCount=count if animated else 1, probe=metadata, decoded=decode)
                if animated:
                    budget = CONFIG['greeting' if resource == 'home-greeting' else 'desk']['maxWebmBytes' if codec == 'webm' else 'maxWebpBytes'][0 if size_name == 'large' else 1]
                    record.update(budgetBytes=budget, withinBudget=record['bytes'] <= budget)
                    if not record['withinBudget']:
                        raise RuntimeError(f'{resource}/{name} exceeds approved byte budget: {record["bytes"]} > {budget}')
                write_json(stamp, record)
                print('PRODUCTION_ENCODED', resource, name, record['bytes'], round(record['seconds'], 2), flush=True)
            if codec == 'poster-webp':
                record['budgetBytes'] = (150 if size_name == 'large' else 75) * 1024
                record['withinBudget'] = record['bytes'] <= record['budgetBytes']
                if not record['withinBudget']:
                    raise RuntimeError(f'{resource}/{name} exceeds the approved poster budget')
                write_json(stamp, record)
            public_asset = asset(path, f'{resource}/{name}', width, height, 'vp9' if codec == 'webm' else suffix,
                                 record['durationSeconds'] if animated else None, count if animated else None,
                                 (round(count / record['durationSeconds'], 6) if codec == 'webp' else 24) if animated else None)
            if animated:
                rendition[codec] = public_asset
            else:
                posters[suffix] = public_asset
            if size_name == 'large' and codec == 'webm':
                public_resource['bounds'] = record['decoded']['bounds']
            records.append(record)
            staged.append((path, PUBLIC / resource / name))
        public_resource['renditions'][size_name] = rendition
        public_resource['posters'][size_name] = posters
    # A family becomes visible only after every required file encoded and decoded successfully.
    for source, target in staged:
        target.parent.mkdir(parents=True, exist_ok=True)
        temporary = target.with_suffix(target.suffix + '.tmp')
        shutil.copyfile(source, temporary)
        temporary.replace(target)
    write_json(ROOT / f'ops/reports/{resource}-production.json', {'schemaVersion': 1, 'resource': resource, 'state': 'complete',
        'buildKey': recipe['buildKey'], 'encodeKey': encode_key, 'masterIndex': relative(master / 'index.json'),
        'publicResource': public_resource, 'files': records, 'visualAcceptance': 'Final encoded visual review is recorded separately; automated decode is not subjective acceptance.'})
    write_manifests()

if __name__ == '__main__':
    selected = sys.argv[1:] or list(IDS)
    if selected == ['--probe-only']:
        write_manifests()
    else:
        for resource in selected:
            encode(resource)
