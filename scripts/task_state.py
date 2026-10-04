"""Move a task and preserve links in ops and docs."""
import argparse
from collections import Counter
import os
from pathlib import Path
import re
from task_scopes import CONTROLLER_SCOPES

ROOT = Path(__file__).resolve().parents[1]
TASKS = ROOT / 'ops/001-zhil/sprint-001/tasks'
FOLDERS = {'In progress': 'active', 'Blocked': 'active', 'Done': 'archived', 'Ready': 'backlog', 'Todo': 'backlog'}

def refresh_controller_counts():
    statuses = {}
    for path in TASKS.glob('*/TASK-*.md'):
        if re.fullmatch(r'TASK-\d{3}', path.stem):
            content = path.read_text(encoding='utf-8')
            match = re.search(r'^- Status: ([^\n]+)', content, re.M)
            if match: statuses[int(path.stem[-3:])] = match[1].strip()
    for controller, numbers in CONTROLLER_SCOPES.items():
        counts = Counter(statuses[number] for number in numbers if number in statuses)
        total = sum(counts.values())
        summary = f"- Progress: {counts['Done']}/{total} Done; {counts['In progress']} In progress; {counts['Blocked']} Blocked; {counts['Ready']} Ready; {counts['Todo']} Todo."
        matches = list(TASKS.glob(f'*/{controller}.md'))
        if len(matches) != 1: raise ValueError(f'Expected one {controller}')
        path = matches[0]
        old = path.read_text(encoding='utf-8')
        new, changed = re.subn(r'^- Progress: [^\n.]*\.', lambda _: summary, old, count=1, flags=re.M)
        if not changed: raise ValueError(f'{controller} has no standard progress line')
        if new != old: path.write_text(new, encoding='utf-8')

def transition(task_id, status):
    if not re.fullmatch(r'TASK-(?:P\d{2}|\d{3})', task_id):
        raise ValueError('Invalid task ID')
    matches = list(TASKS.glob(f'*/{task_id}.md'))
    if len(matches) != 1:
        raise ValueError(f'Expected one task file, found {matches}')
    source = matches[0].resolve()
    target = (TASKS / FOLDERS[status] / source.name).resolve()
    if not source.is_relative_to(TASKS.resolve()) or not target.is_relative_to(TASKS.resolve()):
        raise ValueError('Task paths must remain inside ops/001-zhil/sprint-001/tasks')
    if source != target and target.exists():
        raise ValueError(f'Destination already exists: {target}')
    edits = []
    for path in [*(ROOT / 'ops').rglob('*.md'), *(ROOT / 'docs').rglob('*.md')]:
        old = path.read_text(encoding='utf-8')
        output = target if path.resolve() == source else path
        def fix_link(match):
            label, link = match.groups()
            if '://' in link or link.startswith('#'):
                return match[0]
            location, sep, fragment = link.partition('#')
            resolved = (path.parent / location).resolve()
            resolved = target if resolved == source else resolved
            if output != path or (path.parent / location).resolve() == source:
                relative = Path(os.path.relpath(resolved, output.parent)).as_posix()
                return f'[{label}]({relative}{sep}{fragment})'
            return match[0]
        new = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', fix_link, old)
        if path.resolve() == source:
            new = re.sub(r'^- Status:.*$', '- Status: ' + status, new, count=1, flags=re.M)
        if path.name == 'README.md' and path.parent == TASKS / 'backlog':
            new = re.sub(r'(^\| \[' + re.escape(task_id) + r'\].*\| )[^|]+( \|$)', r'\g<1>' + status + r'\2', new, flags=re.M)
        if new != old or output != path:
            edits.append((path, output, new))
    target.parent.mkdir(parents=True, exist_ok=True)
    for path, output, content in edits:
        if path != output:
            path.rename(output)
        output.write_text(content, encoding='utf-8')
    refresh_controller_counts()
    print(f'{task_id}: {status} -> {target.relative_to(ROOT)}; updated {len(edits)} documents; controller counts reconciled')

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('task')
    parser.add_argument('status', choices=list(FOLDERS))
    args = parser.parse_args()
    transition(args.task, args.status)
