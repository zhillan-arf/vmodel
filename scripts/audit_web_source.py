"""Reopen isolated web scenes and measure actual keyed deformation controls."""
from pathlib import Path
import hashlib,json,math,sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
from blender_bootstrap import ROOT,setup
setup()
import bpy
profile=json.loads((ROOT/'config/avatars/ene.json').read_text(encoding='utf-8'))
records=[]
for name in ['source','alpha-spike']:
    path=ROOT/f'assets/work/ene-web/{name}.blend'
    bpy.ops.wm.open_mainfile(filepath=str(path))
    arm=next(o for o in bpy.data.objects if o.type=='ARMATURE')
    meshes=[o for o in bpy.data.objects if o.type=='MESH' and any(m.type=='ARMATURE' and m.object==arm for m in o.modifiers)]
    record={'scene':str(path.relative_to(ROOT)),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'reopened':True,'bones':len(arm.pose.bones),'vertices':sum(len(m.data.vertices) for m in meshes),'triangles':sum(len(m.data.polygons) for m in meshes),'samples':[]}
    for frame in [1,12,23]:
        bpy.context.scene.frame_set(frame);bpy.context.view_layer.update()
        hand=arm.pose.bones[profile['humanoid']['leftHand']]
        blink=next(m.data.shape_keys.key_blocks[profile['expressions']['blink']].value for m in meshes if m.data.shape_keys)
        count=0;finite=True
        deps=bpy.context.evaluated_depsgraph_get()
        for mesh in meshes:
            evaluated=mesh.evaluated_get(deps);temp=evaluated.to_mesh()
            count+=len(temp.vertices);finite &= all(math.isfinite(c) for v in temp.vertices for c in v.co)
            evaluated.to_mesh_clear()
        record['samples'].append({'frame':frame,'leftHandQuaternion':list(hand.rotation_quaternion),'blink':blink,'evaluatedVertices':count,'finite':finite})
    if name=='alpha-spike':
        assert record['samples'][0]['blink']==0 and record['samples'][2]['blink']==1
        assert record['samples'][0]['leftHandQuaternion']!=record['samples'][1]['leftHandQuaternion']
    assert all(s['finite'] for s in record['samples'])
    records.append(record)
(ROOT/'ops/001-zhil/sprint-001/reports/web-source-audit.json').write_text(json.dumps(records,indent=2)+'\n')
print('WEB_SOURCE_AUDIT_PASSED',flush=True)
