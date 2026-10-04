"""Guard against ticking a box that needs a person, a device or a listener.

TASK-028 requires that no unperformed microphone, remote or subjective
preference check is marked passed. This project's rules say the same thing more
broadly, and a long session of synthetic evidence is exactly when that rule is
easiest to break by accident.

Every ticked acceptance criterion is scanned for language that implies a
physical device, a live camera, a remote service or a human judgement. Anything
matching is reported for review with the sentence that triggered it, so the
claim has to be defended rather than assumed.

Reads only. Exits non-zero if a ticked box makes an unbacked physical claim.
"""
from __future__ import annotations
import json
from pathlib import Path
import re
import time

ROOT = Path(__file__).resolve().parents[1]
TASKS = [path for folder in ('active', 'archived', 'backlog')
         for path in sorted((ROOT / 'ops/001-zhil/sprint-001/tasks' / folder).glob('TASK-*.md'))]

# Language that can only be honoured by a person, a device or a remote service.
PHYSICAL = {
    'live camera': r'\blive (?:camera|head|mouth|signal|gesture)',
    'operator movement': r'\b(?:a person|the user|operator) (?:fully visible|can demonstrate|following|moving)',
    'microphone': r'\bmicrophone\b',
    'speaker or headphone': r'\b(?:speaker|headphone)s?\b',
    'listening judgement': r'\b(?:listening|audible|intelligible|subjective|preferred default|preference)\b',
    'virtual camera consumer': r'\bvirtual camera\b',
    'remote service': r'\bremote (?:operation|endpoint|service|api)\b',
    'physical latency or sync': r'\b(?:physical latency|residual sync|lip sync)\b',
    'final recording': r'\bfinal recordings?\b',
}
# Phrases that explicitly disclaim the physical half, so a tick is defensible.
DISCLAIMERS = [
    r'stays? open', r'remains? open', r'not (?:claimed|closed|established|performed)',
    r'no (?:box|acceptance box) is ticked', r'pending the operator', r'needs the operator',
    r'recorded as a measured defect', r'unmeasured and labelled', r'no listening acceptance',
    # A criterion can legitimately be *about* documenting a physical limitation
    # rather than performing a physical check. Those read as documentation, and
    # say plainly that nothing was installed or exercised.
    r'is documented independently', r'limitation is documented',
    r'explicitly unsupported', r'nothing was installed',
]


def criteria(text: str):
    for match in re.finditer(r'^- \[(x| )\] (.+?)(?=\n- \[|\n\n|\n#|\Z)', text, re.M | re.S):
        yield match.group(1) == 'x', ' '.join(match.group(2).split())


def main():
    flagged, ticked, total = [], 0, 0
    for path in TASKS:
        text = path.read_text(encoding='utf-8')
        for checked, sentence in criteria(text):
            total += 1
            if not checked:
                continue
            ticked += 1
            lowered = sentence.lower()
            hits = sorted({label for label, pattern in PHYSICAL.items() if re.search(pattern, lowered)})
            if not hits:
                continue
            disclaimed = [pattern for pattern in DISCLAIMERS if re.search(pattern, lowered)]
            flagged.append({
                'task': path.stem, 'folder': path.parent.name, 'physicalLanguage': hits,
                'disclaimed': bool(disclaimed), 'criterion': sentence[:400],
            })

    undefended = [entry for entry in flagged if not entry['disclaimed']]
    report = {
        'date': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        'question': 'Is any ticked acceptance criterion claiming a physical, remote or subjective check that was never performed?',
        'readOnly': True, 'tasksScanned': len(TASKS), 'criteriaTotal': total, 'criteriaTicked': ticked,
        'ticksMentioningPhysicalWork': flagged, 'ticksNeedingDefence': undefended,
        'passed': not undefended,
        'limits': [
            'A language scan, not a proof: it cannot tell whether a check actually happened, only whether a tick claims one.',
            'A criterion could still be wrongly ticked using wording this does not match.',
            'Disclaimer detection is textual; a tick that disclaims in words but overstates elsewhere would pass.',
        ],
    }
    out = ROOT / 'ops/001-zhil/sprint-001/reports/acceptance-claims-audit.json'
    out.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps({'report': out.relative_to(ROOT).as_posix(), 'passed': report['passed'],
                      'tasksScanned': len(TASKS), 'criteriaTicked': ticked,
                      'ticksMentioningPhysicalWork': len(flagged), 'ticksNeedingDefence': undefended}, indent=2))
    return 0 if report['passed'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
