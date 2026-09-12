"""Private face-shape inspection; does not save or modify accepted scenes."""
from pathlib import Path
import json,sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
from blender_bootstrap import ROOT,setup
setup()
import bpy
from mathutils import Vector
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/work/ene-web/desk-excited.blend'));scene=bpy.context.scene;scene.frame_set(1)
arm=next(o for o in bpy.data.objects if o.type=='ARMATURE');mesh=next(o for o in bpy.data.objects if o.type=='MESH' and any(m.type=='ARMATURE' and m.object==arm for m in o.modifiers));keys=mesh.data.shape_keys;keys.animation_data_clear()
target=Vector((0,-.1,1.54));scene.camera.location=(0,-4,1.54);scene.camera.rotation_euler=(target-scene.camera.location).to_track_quat('-Z','Y').to_euler();scene.camera.data.ortho_scale=.45;scene.render.resolution_x=scene.render.resolution_y=320
candidates={'excited-wide-ih':{'にこり':.9,'い':.8,'ω':.35,'笑い':.15},'excited-open-aa':{'にこり':.9,'あ':.55,'ω':.6,'笑い':.12},'excited-omega-box':{'にこり':1,'ω□':1,'笑い':.3},'excited-open-smile':{'にこり':.9,'い':.55,'ω□':.45,'笑い':.18},'confused-strong':{'困る':1,'∧':.7,'じと目':.18},'surprised-strong':{'びっくり':.9,'上':.65,'お':.72,'瞳小':.22}}
candidates.update({'excited-grin-open':{'\u306b\u3053\u308a':.3,'\u3044':.95,'\u03c9':.7,'\u03c9\u25a1':.1,'\u4e0a':.45},'excited-grin-laugh':{'\u306b\u3053\u308a':.6,'\u3044':.85,'\u03c9':.65,'\u7b11\u3044':.65,'\u4e0a':.25},'excited-open-bright':{'\u306b\u3053\u308a':.2,'\u3042':.45,'\u03c9':.9,'\u4e0a':.5}})
requested=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else list(candidates)
folder=ROOT/'ops/reports/local/web-resources/expression-candidates';folder.mkdir(parents=True,exist_ok=True)
for name in requested:
    values=candidates[name]
    for key in keys.key_blocks:
        if not key.name.startswith('mmd_'):key.value=0
    keys.key_blocks['WebCuffRetractLeft'].value=1
    for key,value in values.items():keys.key_blocks[key].value=value
    bpy.context.view_layer.update();scene.render.filepath=str(folder/(name+'.png'));bpy.ops.render.render(write_still=True);print('EXPRESSION_CANDIDATE',name,flush=True)
(ROOT/'ops/reports/web-expression-candidates.json').write_text(json.dumps({'scope':'In-memory mouth/brow candidates under a diagnostic face camera; accepted scene files unchanged','candidates':candidates},ensure_ascii=True,indent=2)+'\n')
