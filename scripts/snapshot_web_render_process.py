"""Read-only memory snapshots of this project's production Blender process."""
import json
import subprocess
import time
from web_production import ROOT, read_json, write_json

command = "Get-CimInstance Win32_Process -Filter \"Name = 'blender.exe'\" | Where-Object { $_.CommandLine -like '*scripts/render_web_masters.py*' -or $_.CommandLine -like '*scripts\\render_web_masters.py*' } | ForEach-Object { Get-Process -Id $_.ProcessId | Select-Object Id,WorkingSet64,PrivateMemorySize64,PeakWorkingSet64,CPU } | ConvertTo-Json -Compress"
text = subprocess.check_output(['powershell.exe', '-NoProfile', '-Command', command], text=True).strip()
if not text:
    raise RuntimeError('No project production renderer is currently active')
processes = json.loads(text)
if isinstance(processes, dict):
    processes = [processes]
path = ROOT / 'ops/reports/web-production-process-snapshots.json'
report = read_json(path) if path.exists() else {'scope': 'Read-only owned Blender process snapshots; observed OS peak at snapshot time, not a continuous whole-batch peak sampler.', 'samples': []}
report['samples'].append({'date': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                          'batchCheckpoint': read_json(ROOT / 'ops/reports/web-production-batch.json'),
                          'renderCheckpoint': read_json(ROOT / 'ops/reports/web-production-render.json').get('lastFrame'), 'processes': processes})
write_json(path, report)
print(json.dumps(report['samples'][-1], indent=2))
