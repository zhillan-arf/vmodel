"""Extract matched final decoded frames and RGBA source references for visual review."""
from pathlib import Path
import json
import subprocess
import sys
from web_production import ROOT, IDS, plan, read_json, write_json, relative

ff = ROOT / read_json(ROOT / 'config/web-resources/toolchain.json')['ffmpeg']['installDirectory'] / 'bin/ffmpeg.exe'
large = '--large' in sys.argv[1:]
out = ROOT / ('ops/001-zhil/sprint-001/reports/local/web-production-review-large' if large else 'ops/001-zhil/sprint-001/reports/local/web-production-review')
out.mkdir(parents=True, exist_ok=True)
selected = [arg for arg in sys.argv[1:] if arg != '--large'] or IDS
records = []
for resource in selected:
    recipe = plan(resource)
    public = ROOT / 'web-showcase/public/ene' / resource
    folder = out / resource
    folder.mkdir(parents=True, exist_ok=True)
    # Frame numbers refer to the 1-based accepted 24 fps source timeline.
    chosen = [1, 10, 61, 81, 99, 120] if resource == 'home-greeting' else [1, 20, 37, 40, 55, 72]
    if large:
        chosen = [1, 61, 99] if resource == 'home-greeting' else [1, 37, 55]
    width, height = recipe['size' if large else 'smallSize']
    commands = []
    for frame in chosen:
        for codec in ('source', 'webm', 'webp'):
            name = f'{codec}-{frame:04d}.png'
            if codec == 'source':
                source = ROOT / recipe['masterDirectory'] / f'frame-{frame:04d}.png'
                inputs = ['-i', str(source)]
                filtering = f'scale={width}:{height}:flags=lanczos,format=rgba'
            else:
                source = public / f'{"large" if large else "small"}.{codec}'
                inputs = (['-c:v', 'libvpx-vp9'] if codec == 'webm' else []) + ['-i', str(source)]
                filtering = f'select=eq(n\\,{frame - 1}),format=rgba'
            command = [str(ff), '-hide_banner', '-v', 'error', '-y', '-threads', '1', '-filter_threads', '1', *inputs,
                       '-vf', filtering, '-frames:v', '1', '-pix_fmt', 'rgba', str(folder / name)]
            subprocess.run(command, check=True)
            commands.append(command)
    record = {'resource': resource, 'frames': chosen, 'fps': 24, 'rendition': 'large' if large else 'small', 'size': [width, height], 'commands': commands}
    write_json(folder / 'review.json', record)
    records.append(record)
    print('FINAL_REVIEW_EXTRACTED', resource, flush=True)
write_json(out / 'index.json', {'resources': records, 'scope': 'Matched source/WebM/WebP decoded frame comparison; images preserve RGBA and browser CSS supplies review backgrounds.'})
