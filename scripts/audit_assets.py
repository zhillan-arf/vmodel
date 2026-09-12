"""Run in Blender: parse both original PMX models using pinned MMD Tools."""
from pathlib import Path
import hashlib
import json
import math
import sys
from collections import Counter

sys.path.insert(0, str(Path(__file__).resolve().parent))
from blender_bootstrap import ROOT, setup

def serialize(value):
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    if isinstance(value, (tuple, list)):
        return [serialize(v) for v in value]
    if isinstance(value, dict):
        return {str(k): serialize(v) for k, v in value.items()}
    if hasattr(value, '__dict__'):
        return serialize(vars(value))
    return str(value)

def audit():
    setup()
    from mmd_tools.core import pmx
    results = []
    for path in sorted((ROOT / 'ops/resources/ENE').glob('*.pmx')):
        model = pmx.load(str(path))
        textures = [dict(index=i, path=Path(t.path).relative_to(ROOT).as_posix(), exists=Path(t.path).exists()) for i,t in enumerate(model.textures)]
        missing = []
        for i, material in enumerate(model.materials):
            for role, index in [('diffuse', material.texture), ('sphere', material.sphere_texture),
                                ('toon', -1 if material.is_shared_toon_texture else material.toon_texture)]:
                if index >= 0 and not textures[index]['exists']:
                    missing.append(dict(materialIndex=i, material=material.name, role=role,
                                        path=Path(textures[index]['path']).name))
        data = dict(file=path.relative_to(ROOT).as_posix(), sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
                    name=model.name, comment=model.comment, vertices=len(model.vertices), triangles=len(model.faces),
                    materials=serialize(model.materials), bones=serialize(model.bones),
                    morphs=[dict(index=i,name=m.name,english=m.name_e,type=type(m).__name__,offsets=len(m.offsets)) for i,m in enumerate(model.morphs)],
                    rigidBodies=serialize(model.rigids), joints=serialize(model.joints),
                    textures=textures, missingMaterialTextures=missing,
                    duplicateMorphNames=[n for n,c in Counter(m.name for m in model.morphs).items() if c>1])
        results.append(data)
        print('AUDIT', path.name, 'bones',len(model.bones),'morphs',len(model.morphs),'rigids',len(model.rigids),'joints',len(model.joints),flush=True)
    report = ROOT / 'ops/reports/asset-inventory.json'
    report.parent.mkdir(parents=True, exist_ok=True)
    # JSON has no NaN: emitting it produced the one report a strict parser
    # rejected. An undefined measurement is written as null instead.
    def finite(value):
        if isinstance(value,float) and not math.isfinite(value):return None
        if isinstance(value,dict):return {key:finite(item) for key,item in value.items()}
        if isinstance(value,list):return [finite(item) for item in value]
        return value
    report.write_text(json.dumps(finite(results),ensure_ascii=False,indent=2,allow_nan=False)+'\n',encoding='utf-8')
    print('AUDIT_WRITTEN', report, flush=True)

if __name__ == '__main__':
    audit()
