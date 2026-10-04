"""Read back actual authored actions; inspect every frame and the loop endpoint."""
from pathlib import Path
import hashlib,json,math,sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
from blender_bootstrap import ROOT,setup
setup()
import bpy
import numpy as np
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector
from web_authoring import projected_geometry
config=json.loads((ROOT/'config/web-resources/performances.json').read_text())
profile=json.loads((ROOT/'config/avatars/ene.json').read_text(encoding='utf-8'))
requested=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else ['home-greeting','desk-normal']
for resource in requested:
    is_desk=resource.startswith('desk-')
    path=ROOT/f'assets/work/ene-web/{resource}.blend';bpy.ops.wm.open_mainfile(filepath=str(path));scene=bpy.context.scene
    arm=next(o for o in bpy.data.objects if o.type=='ARMATURE');mesh=next(o for o in bpy.data.objects if o.type=='MESH' and any(m.type=='ARMATURE' and m.object==arm for m in o.modifiers))
    base=mesh.data.shape_keys.key_blocks['Basis'];rest=np.array([v.co[:] for v in base.data]);skin={v for p in mesh.data.polygons if p.material_index in [0,1] for v in p.vertices}
    left=np.array([i for i in skin if rest[i,0]>.39 and .80<rest[i,2]<1.07],dtype=int);right=np.array([i for i in skin if rest[i,0]<-.39 and .80<rest[i,2]<1.07],dtype=int)
    arm_groups={g.index for g in mesh.vertex_groups if '髪' in g.name or any(g.name.startswith(side+prefix) for side in ['左','右'] for prefix in ['腕','ひじ','手','袖','親指','人指','中指','薬指','小指'])}
    lower_groups={g.index for g in mesh.vertex_groups if g.name in [profile['humanoid']['rightLowerArm'],profile['humanoid']['rightHand'],'右袖'] or g.name.startswith('右手捩')}
    moving=np.array([v.index for v in mesh.data.vertices if rest[v.index,2]>1.27 or sum(g.weight for g in v.groups if g.group in arm_groups)>.3],dtype=int)
    forearm=np.array([v.index for v in mesh.data.vertices if sum(g.weight for g in v.groups if g.group in lower_groups)>.5],dtype=int)
    count=scene.frame_end;frames=[];first=None;last=None;wrists=[];max_step=0;previous=None;max_step_detail=None
    for frame in range(1,count+2):
        scene.frame_set(frame);bpy.context.view_layer.update();world,uv=projected_geometry(scene,mesh)
        if first is None:first=world.copy()
        if previous is not None:
            distances=np.linalg.norm(world-previous,axis=1);step=float(distances.max())
            if step>max_step:
                index=int(distances.argmax());max_step=step;max_step_detail={'frameFrom':frame-1,'frameTo':frame,'vertexIndex':index,'sourceRest':rest[index].tolist(),'groups':{mesh.vertex_groups[g.group].name:g.weight for g in mesh.data.vertices[index].groups},'worldFrom':previous[index].tolist(),'worldTo':world[index].tolist()}
        previous=world;last=world
        hand=arm.pose.bones[profile['humanoid']['rightHand']].matrix.translation.copy();wrists.append(list(hand))
        frames.append({'frame':frame,'finite':bool(np.isfinite(world).all()),'leftHandUvMin':uv[left].min(axis=0).tolist(),'leftHandUvMax':uv[left].max(axis=0).tolist(),'rightHandUvMin':uv[right].min(axis=0).tolist(),'rightHandUvMax':uv[right].max(axis=0).tolist(),'movingUvMin':uv[moving].min(axis=0).tolist(),'movingUvMax':uv[moving].max(axis=0).tolist(),'rightForearmMinZ':float(world[forearm,2].min()),'blink':mesh.data.shape_keys.key_blocks[profile['expressions']['blink']].value,'wholeUvMin':uv.min(axis=0).tolist(),'wholeUvMax':uv.max(axis=0).tolist()})
    drift=float(np.linalg.norm(np.asarray(wrists)-np.asarray(wrists[0]),axis=1).max())
    margin=min(min(f['movingUvMin']) for f in frames);maximum=max(max(f['movingUvMax']) for f in frames)
    loop=float(np.linalg.norm(last-first,axis=1).max());forearm_range=[min(f['rightForearmMinZ'] for f in frames),max(f['rightForearmMinZ'] for f in frames)]
    guide=config[resource].get('deskGuideZ');anchor=world_to_camera_view(scene,scene.camera,Vector((0,-.30,guide if guide is not None else frames[0]['wholeUvMin'][1]))) if guide is not None else None
    report={'resource':resource,'scene':str(path.relative_to(ROOT)),'sceneSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'reopened':True,'fps':scene.render.fps,'frameCount':count,'sampledFramesIncludingEndpoint':len(frames),'allVerticesFinite':all(f['finite'] for f in frames),'loopEndpointMaxVertexDistanceMeters':loop,'maximumAdjacentFrameVertexMovementMeters':max_step,'movingExtremityMinimumUv':margin,'movingExtremityMaximumUv':maximum,'restingRightWristDriftMeters':drift if resource=='desk-normal' else None,'restingForearmMinZRange':forearm_range if resource=='desk-normal' else None,'deskGuideZ':guide,'deskAnchorTopOrigin':[.5,1-anchor.y] if anchor is not None else None,'scope':'All-frame geometry/loop/framing and resting-wrist audit; no exhaustive mesh collision certification. Lower seated body is deliberately below desk camera crop.','frames':frames}
    report['maximumAdjacentMovementDetail']=max_step_detail
    if is_desk:
        report['restingRightWristDriftMeters']=drift;report['restingForearmMinZRange']=forearm_range
        baseline=json.loads((ROOT/'config/web-resources/desk-baseline.json').read_text())
        assert max(abs(a-b) for a,b in zip(scene.camera.location,baseline['camera']['location']))<1e-6
        assert abs(scene.camera.data.ortho_scale-baseline['camera']['orthoScale'])<1e-6
        assert abs(report['deskAnchorTopOrigin'][1]-baseline['deskAnchor'][1])<1e-6
        assert margin>=baseline['safeInset'] and maximum<=1-baseline['safeInset']
        report['matchesLockedDeskCameraAndAnchor']=True
    assert report['allVerticesFinite'] and loop<1e-5
    if resource=='home-greeting':assert all(min(f['wholeUvMin'])>=.05 and max(f['wholeUvMax'])<=.95 for f in frames)
    else:assert drift<1e-5
    assert margin>.01 and maximum<.99
    (ROOT/f'ops/001-zhil/sprint-001/reports/{resource}-audit.json').write_text(json.dumps(report,indent=2)+'\n');print('PERFORMANCE_AUDIT_PASSED',resource,loop,margin,maximum,forearm_range,flush=True)
