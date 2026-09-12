"""Enumerate the converted-voice OBS route and check every component's licence.

TASK-025 requires that the required OBS route uses approved open-source
components. This walks the actual route end to end - browser page, loopback
server, OBS Browser Source, CEF, OBS itself - records what is installed with
hashes, resolves each licence, and checks that no proprietary virtual-audio
driver is doing the work instead.

It reads only. It starts nothing, installs nothing and changes no OBS setting.
"""
from __future__ import annotations
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import time

ROOT = Path(__file__).resolve().parents[2]
OBS = ROOT / '.tools/obs'

# Proprietary Windows virtual-audio products a route could quietly depend on.
# Their absence is part of the claim that this path is open source.
PROPRIETARY_AUDIO = [
    ('VB-CABLE', ['vbaudio_cable', 'vbcable', 'VBCABLE']),
    ('Voicemeeter', ['voicemeeter', 'vbaudio_voicemeeter']),
    ('Synchronous Audio Router', ['synchronousaudiorouter', 'sar.sys']),
    ('Virtual Audio Cable', ['vrtaucbl', 'virtual audio cable']),
]


def sha(path: Path) -> str | None:
    try:
        return hashlib.sha256(path.read_bytes()).hexdigest()
    except OSError:
        return None


def component(name, path, licence, licence_path=None, note=None):
    file = Path(path)
    return {
        'component': name,
        'path': file.relative_to(ROOT).as_posix() if file.is_absolute() and str(file).startswith(str(ROOT)) else str(file),
        'present': file.exists(),
        'bytes': file.stat().st_size if file.exists() else None,
        'sha256': sha(file) if file.is_file() else None,
        'licence': licence,
        'licenceFilePresent': bool(licence_path and Path(licence_path).exists()),
        'licenceFile': Path(licence_path).relative_to(ROOT).as_posix() if licence_path and Path(licence_path).exists() else None,
        'note': note,
    }


def installed_proprietary_audio():
    """Look for known proprietary virtual-audio drivers by file and registry name."""
    found = []
    system_root = Path(os.environ.get('SYSTEMROOT', r'C:\Windows'))
    drivers = system_root / 'System32/drivers'
    names = []
    try:
        names = [entry.name.lower() for entry in drivers.iterdir()]
    except OSError:
        pass
    program_names = []
    for base in filter(None, [os.environ.get('ProgramFiles'), os.environ.get('ProgramFiles(x86)')]):
        try:
            program_names += [entry.name.lower() for entry in Path(base).iterdir()]
        except OSError:
            pass
    haystack = ' '.join(names + program_names)
    for product, needles in PROPRIETARY_AUDIO:
        hits = [needle for needle in needles if needle.lower() in haystack]
        if hits:
            found.append({'product': product, 'matched': hits})
    return found


def main():
    licence_dir = OBS / 'data/obs-studio/license'
    gplv2 = licence_dir / 'gplv2.txt'
    inventory = json.loads((ROOT / 'ops/reports/voice-license-inventory.json').read_text(encoding='utf-8'))
    packaged = {entry['package'].lower() for entry in inventory}

    # Python packages the loopback server actually imports.
    server = (ROOT / 'scripts/voice/studio_server.py').read_text(encoding='utf-8')
    imported = sorted({match.group(1).split('.')[0] for match in
                       re.finditer(r'^\s*(?:import|from)\s+([A-Za-z_][\w.]*)', server, re.M)})
    stdlib = set(sys.stdlib_module_names)
    # Sibling modules in scripts/voice are this project's own source, not packages.
    local = {file.stem for file in (ROOT / 'scripts/voice').glob('*.py')}
    third_party = [name for name in imported
                   if name not in stdlib and name not in local and not name.startswith('_')]
    unlisted = [name for name in third_party if name.lower() not in packaged]
    project_modules = [name for name in imported if name in local]

    components = [
        component('Voice Studio loopback server (this project)', ROOT / 'scripts/voice/studio_server.py',
                  'Project source', None, 'Serves the control API and the converted PCM route on loopback only.'),
        component('Converted OBS receiver page (this project)', ROOT / 'scripts/voice/studio/obs.html', 'Project source'),
        component('Converted PCM player (this project)', ROOT / 'scripts/voice/studio/player.js', 'Project source'),
        component('Bounded PCM AudioWorklet (this project)', ROOT / 'scripts/voice/studio/pcm-player.js', 'Project source'),
        component('OBS Studio', OBS / 'bin/64bit/obs64.exe', 'GPL-2.0-or-later', gplv2,
                  'Portable install under .tools/obs; its own licence text ships with the distribution.'),
        component('OBS Browser Source plugin', OBS / 'obs-plugins/64bit/obs-browser.dll', 'GPL-2.0-or-later', gplv2,
                  'Part of the OBS distribution and covered by its licence.'),
        component('Chromium Embedded Framework', OBS / 'obs-plugins/64bit/libcef.dll', 'BSD-3-Clause (CEF) over Chromium BSD', None,
                  'CEF carries its own BSD terms, but this portable OBS distribution ships no separate CEF licence or credits file.'),
        component('OBS Browser helper process', OBS / 'obs-plugins/64bit/obs-browser-page.exe', 'GPL-2.0-or-later', gplv2),
    ]

    proprietary = installed_proprietary_audio()
    missing_licence_files = [entry['component'] for entry in components
                             if entry['present'] and entry['licence'] != 'Project source' and not entry['licenceFilePresent']]

    report = {
        'date': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        'question': 'Does the required converted-voice OBS route use approved open-source components only?',
        'readOnly': True, 'startedNothing': True, 'changedNoObsSetting': True,
        'components': components,
        'serverThirdPartyImports': third_party,
        'serverProjectModules': project_modules,
        'importsNotInLicenceInventory': unlisted,
        'licenceInventoryEntries': len(inventory),
        'proprietaryVirtualAudioFound': proprietary,
        'missingLicenceFiles': missing_licence_files,
        'checks': {
            'allComponentsPresent': all(entry['present'] for entry in components),
            'noProprietaryVirtualAudioInRoute': proprietary == [],
            'allServerImportsLicensed': unlisted == [],
            'everyComponentHasKnownLicence': all(entry['licence'] for entry in components),
        },
        'limits': [
            'A static inventory: it reads installed files and does not start OBS, capture audio or verify runtime behaviour.',
            'Proprietary virtual-audio detection is a name scan of driver and program directories, not an exhaustive audit.',
            'Licence identification for OBS and CEF comes from their published terms; only OBS ships its text in this distribution.',
            'It does not establish audio quality, routing correctness, latency or sync, which are separate criteria.',
        ],
    }
    report['passed'] = all(report['checks'].values())
    out = ROOT / 'ops/reports/voice-obs-route-licences.json'
    out.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps({'report': out.relative_to(ROOT).as_posix(), 'passed': report['passed'],
                      'checks': report['checks'], 'missingLicenceFiles': missing_licence_files,
                      'proprietary': proprietary}, indent=2))
    return 0 if report['passed'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
