"""Inspect Ene shape keys and sleeve weights without a scene save."""
import hashlib
import json
from pathlib import Path
import sys

import bpy
import numpy as np

ROOT = Path(__file__).resolve().parents[5]
sys.path.insert(0, str(ROOT / 'scripts'))
from blender_bootstrap import setup

setup()
path = ROOT / 'assets/work/ene/vrm-work.blend'
before = hashlib.sha256(path.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(path))
mesh = next(o for o in bpy.data.objects if o.type == 'MESH' and any(m.type == 'ARMATURE' for m in o.modifiers))
count = len(mesh.data.vertices)
base = np.empty(count * 3, dtype=np.float32)
mesh.data.shape_keys.key_blocks[0].data.foreach_get('co', base)
base = base.reshape(-1, 3)
shapes = []
for key in mesh.data.shape_keys.key_blocks[1:]:
    coords = np.empty(count * 3, dtype=np.float32)
    key.data.foreach_get('co', coords)
    delta = coords.reshape(-1, 3) - base
    distance = np.linalg.norm(delta, axis=1)
    changed = distance > 1e-7
    position = base[changed]
    materials = set()
    affected = set(np.flatnonzero(changed).tolist())
    for polygon in mesh.data.polygons:
        if any(v in affected for v in polygon.vertices):
            materials.add(mesh.data.materials[polygon.material_index].name)
    shapes.append({'name': key.name, 'changedVertices': int(changed.sum()),
                   'maximumDeltaMeters': float(distance.max()), 'materials': sorted(materials),
                   'boundsBlender': {'min': position.min(axis=0).tolist(), 'max': position.max(axis=0).tolist()} if len(position) else None})
groups = {}
for group in mesh.vertex_groups:
    if any(part in group.name for part in ['袖', '手首', 'ひじ', '腕捩', '手捩']):
        values = [membership.weight for vertex in mesh.data.vertices for membership in vertex.groups if membership.group == group.index]
        groups[group.name] = {'vertices': len(values), 'maximumWeight': max(values, default=0)}
report = {'date': '2026-10-05', 'blender': bpy.app.version_string,
          'sceneSha256': before, 'sceneUnchanged': before == hashlib.sha256(path.read_bytes()).hexdigest(),
          'vertices': count, 'shapes': shapes, 'sleeveAndArmGroups': groups}
output = ROOT / 'ops/001-zhil/sprint-002/research/ene-v2-local/scene-audit.json'
output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
print('ENE_SCENE_AUDIT', json.dumps({'vertices': count, 'shapes': len(shapes), 'sceneUnchanged': report['sceneUnchanged']}))
