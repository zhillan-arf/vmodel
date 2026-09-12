"""Render authored scenes at preview size; full master production stays separate."""
from pathlib import Path
import json,sys,time
sys.path.insert(0,str(Path(__file__).resolve().parent))
from blender_bootstrap import ROOT,setup
setup()
import bpy
args=sys.argv[sys.argv.index('--')+1:];resource=args[0];mode=args[1] if len(args)>1 else 'stills'
config=json.loads((ROOT/'config/web-resources/performances.json').read_text());spec=config[resource]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/f'assets/work/ene-web/{resource}.blend'))
scene=bpy.context.scene;count=round(spec['seconds']*config['fps'])
scene.render.resolution_x,scene.render.resolution_y=spec['small'];scene.render.resolution_percentage=100
scene.render.image_settings.color_mode='RGBA';scene.render.image_settings.file_format='PNG'
if mode=='preview':frames=list(range(1,count+1,2));folder=ROOT/f'assets/work/ene-web/{resource}/preview-frames'
else:
    frames=[int(x) for x in args[2:]] if len(args)>2 else ([1,18,54,70,92,120] if resource=='home-greeting' else [1,20,40,60,72])
    folder=ROOT/f'ops/reports/local/web-resources/{resource}/poses'
folder.mkdir(parents=True,exist_ok=True);records=[];start=time.perf_counter()
for index,frame in enumerate(frames):
    scene.frame_set(frame);bpy.context.view_layer.update()
    path=folder/f'frame-{index if mode=="preview" else frame:04d}.png';scene.render.filepath=str(path);before=time.perf_counter();bpy.ops.render.render(write_still=True)
    records.append({'sourceFrame':frame,'file':str(path.relative_to(ROOT)),'seconds':time.perf_counter()-before})
    print('DRAFT_FRAME',resource,frame,round(records[-1]['seconds'],2),flush=True)
report={'resource':resource,'mode':mode,'sourceFps':config['fps'],'previewFps':12 if mode=='preview' else None,'size':spec['small'],'frames':records,'elapsedSeconds':time.perf_counter()-start,'scene':f'assets/work/ene-web/{resource}.blend'}
(ROOT/f'ops/reports/{resource}-{mode}.json').write_text(json.dumps(report,indent=2)+'\n')
print('DRAFT_RENDERED',resource,mode,flush=True)
