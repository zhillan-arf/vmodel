"""Inspect weights, helpers, morph provenance and springs without changing saved assets."""
from pathlib import Path
import sys,json,collections
sys.path.insert(0,str(Path(__file__).resolve().parent))
from blender_bootstrap import ROOT,setup
setup()
import bpy
from io_scene_vrm.editor.extension_accessor import get_armature_extension
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/work/ene/vrm-work.blend'))
arm=next(o for o in bpy.data.objects if o.type=='ARMATURE')
mesh=next(o for o in bpy.data.objects if o.type=='MESH' and any(m.type=='ARMATURE' and m.object==arm for m in o.modifiers))
profile=json.loads((ROOT/'config/avatars/ene.json').read_text(encoding='utf-8'))
inventory=json.loads((ROOT/'ops/001-zhil/sprint-001/reports/asset-inventory.json').read_text(encoding='utf-8'))[0]
weights=collections.Counter();unweighted=[]
for vertex in mesh.data.vertices:
    positive=[g for g in vertex.groups if g.weight>1e-6 and mesh.vertex_groups[g.group].name in arm.data.bones]
    if not positive:unweighted.append(vertex.index)
    for group in positive:weights[mesh.vertex_groups[group.group].name]+=1
mapped=set(profile['humanoid'].values());helpers=[]
for name,count in weights.items():
    if name in mapped:continue
    bone=arm.data.bones.get(name)
    helpers.append(dict(name=name,vertices=count,parent=bone.parent.name if bone and bone.parent else None,
                        nearestHumanoidAncestor=next((p.name for p in bone.parent_recursive if p.name in mapped),None) if bone else None))
ext=get_armature_extension(arm.data)
springs=[]
for spring in ext.spring_bone1.springs:
    springs.append(dict(name=spring.vrm_name,joints=[dict(bone=j.node.bone_name,stiffness=j.stiffness,dragForce=j.drag_force,gravityPower=j.gravity_power,hitRadius=j.hit_radius) for j in spring.joints]))
ancestors=[];parent=mesh.parent
while parent:ancestors.append(parent);parent=parent.parent
report=dict(mesh=mesh.name,vertices=len(mesh.data.vertices),unweightedVertices=unweighted,weightedGroups=len(weights),
            visibility=[dict(name=o.name,type=o.type,visible=o.visible_get(),hideViewport=o.hide_viewport,hideRender=o.hide_render,hidden=o.hide_get(),selected=o.select_get(),collections=[dict(name=c.name,hideViewport=c.hide_viewport,hideRender=c.hide_render) for c in o.users_collection]) for o in [mesh,arm,*ancestors]],
            humanoid=profile['humanoid'],weightedHelpers=helpers,springs=springs,colliders=len(ext.spring_bone1.colliders),
            expressions={name:[b.index for b in expression.morph_target_binds] for name,expression in ext.vrm1.expressions.preset.name_to_expression_dict().items() if expression.morph_target_binds},
            shapeKeys=[k.name for k in mesh.data.shape_keys.key_blocks],sourceMorphs=inventory.get('morphs'))
copy=mesh.data.copy()
before=dict(vertices=len(copy.vertices),edges=len(copy.edges),polygons=len(copy.polygons),loops=len(copy.loops))
changed=copy.validate(verbose=True)
report['meshValidation']=dict(changed=changed,before=before,after=dict(vertices=len(copy.vertices),edges=len(copy.edges),polygons=len(copy.polygons),loops=len(copy.loops)))
bpy.data.meshes.remove(copy)
(ROOT/'ops/001-zhil/sprint-001/reports/rig-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('RIG_AUDIT',json.dumps(dict(vertices=report['vertices'],unweighted=len(unweighted),helpers=len(helpers),springs=len(springs),colliders=report['colliders'])),flush=True)
