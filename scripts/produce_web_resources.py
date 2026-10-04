"""Run one resumable master render and encode at a time, family by family."""
from pathlib import Path
import subprocess
import sys
import time
from web_production import ROOT, IDS, PAUSE, read_json, write_json

selected = sys.argv[1:] or list(IDS)
if any(resource not in IDS for resource in selected):
    raise ValueError('Expected one or more known resource IDs')
blender = read_json(ROOT / 'config/web-resources/toolchain.json')['blender']['executable']
log_folder = ROOT / 'ops/001-zhil/sprint-001/reports/local/web-production-logs'
log_folder.mkdir(parents=True, exist_ok=True)
progress = {'state': 'running', 'selected': selected, 'completed': [], 'startedUtc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}
report = ROOT / 'ops/001-zhil/sprint-001/reports/web-production-batch.json'
write_json(report, progress)
for resource in selected:
    for stage, command in [('render', [blender, '-b', '--python-exit-code', '1', '--python', str(ROOT / 'scripts/render_web_masters.py'), '--', resource]),
                           ('encode', [sys.executable, str(ROOT / 'scripts/encode_web_production.py'), resource])]:
        if PAUSE.exists():
            progress['state'] = 'paused'
            write_json(report, progress)
            print('BATCH_PAUSED', resource, stage, flush=True)
            sys.exit(0)
        progress.update(resource=resource, stage=stage)
        write_json(report, progress)
        print('BATCH_START', resource, stage, flush=True)
        with (log_folder / f'{resource}-{stage}.log').open('a', encoding='utf-8') as log:
            result = subprocess.run(command, cwd=ROOT, stdout=log, stderr=subprocess.STDOUT)
        if result.returncode:
            progress.update(state='failed', exitCode=result.returncode)
            write_json(report, progress)
            raise RuntimeError(f'{resource} {stage} failed; see {log_folder}')
    progress['completed'].append(resource)
    write_json(report, progress)
progress['state'] = 'complete'
write_json(report, progress)
print('BATCH_COMPLETE', ','.join(selected), flush=True)
