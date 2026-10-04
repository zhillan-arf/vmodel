"""Check task lifecycle storage, register status, links and dependency cycles."""
from collections import Counter
import json
from pathlib import Path
import re
from task_scopes import CONTROLLER_SCOPES

ROOT = Path(__file__).resolve().parents[1]
TASKS = ROOT / 'ops/tasks'
LOCATIONS = {'In progress': 'active', 'Blocked': 'active', 'Done': 'archived', 'Ready': 'backlog', 'Todo': 'backlog'}

def audit():
    errors, tasks, dependencies = [], {}, {}
    register = (TASKS / 'backlog/README.md').read_text(encoding='utf-8')
    for path in TASKS.glob('*/TASK-*.md'):
        task = path.stem
        if task in tasks:
            errors.append(f'{task}: duplicate files')
        content = path.read_text(encoding='utf-8')
        match = re.search(r'^- Status: ([^;\n]+)', content, re.M)
        status = match[1].strip() if match else 'Missing'
        tasks[task] = status
        if LOCATIONS.get(status) != path.parent.name:
            errors.append(f'{task}: {status} belongs in {LOCATIONS.get(status)}, found {path.parent.name}')
        if re.fullmatch(r'TASK-\d{3}', task):
            row = re.search(r'^\| \[' + task + r'\]\([^\n]+$', register, re.M)
            if not row or row[0].split('|')[-2].strip() != status:
                errors.append(f'{task}: register status disagrees')
            if status == 'Done' and '- [ ]' in content:
                errors.append(f'{task}: archived with unchecked acceptance')
            line = re.search(r'^- Depends on: (.+)$', content, re.M)
            dependencies[task] = re.findall(r'TASK-\d{3}', line[1]) if line else []
    for number in CONTROLLER_SCOPES['TASK-P01']:
        if f'TASK-{number:03}' not in tasks:
            errors.append(f'TASK-{number:03}: missing')
    for path in [*(ROOT / 'ops').rglob('*.md'), *(ROOT / 'docs').rglob('*.md')]:
        for target in re.findall(r'\]\(([^)]+TASK-[^)]*\.md)(?:#[^)]*)?\)', path.read_text(encoding='utf-8')):
            if not (path.parent / target).resolve().is_file():
                errors.append(f'{path.relative_to(ROOT)}: broken task link {target}')
    def visit(task, stack):
        if task in stack:
            errors.append('Dependency cycle: ' + ' -> '.join([*stack, task]))
            return
        for dependency in dependencies.get(task, []):
            visit(dependency, [*stack, task])
    for task in dependencies:
        visit(task, [])
    counts = Counter(status for task, status in tasks.items() if re.fullmatch(r'TASK-\d{3}', task))
    for controller, numbers in CONTROLLER_SCOPES.items():
        expected = Counter(tasks.get(f'TASK-{number:03}') for number in numbers)
        paths = list(TASKS.glob(f'*/{controller}.md'))
        if len(paths) != 1: continue
        content = paths[0].read_text(encoding='utf-8')
        line = re.search(r'^- Progress: (\d+)/(\d+) Done; (\d+) In progress; (\d+) Blocked; (\d+) Ready; (\d+) Todo\.', content, re.M)
        desired = [expected['Done'], len(numbers), expected['In progress'], expected['Blocked'], expected['Ready'], expected['Todo']]
        if not line or list(map(int, line.groups())) != desired: errors.append(f'{controller}: progress counts disagree with task files')
    return {'counts': dict(counts), 'controllers': {task: status for task, status in tasks.items() if task.startswith('TASK-P')}, 'errors': errors}

if __name__ == '__main__':
    result = audit()
    print(json.dumps(result, indent=2))
    raise SystemExit(bool(result['errors']))
