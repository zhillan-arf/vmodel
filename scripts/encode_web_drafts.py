"""Produce private animated review files from 12fps draft renders."""
from pathlib import Path
import hashlib,json,shutil,subprocess,sys
from web_media import webp_info
ROOT=Path(__file__).resolve().parents[1]
tool=json.loads((ROOT/'config/web-resources/toolchain.json').read_text())['ffmpeg'];ff=ROOT/tool['installDirectory']/'bin/ffmpeg.exe'
config=json.loads((ROOT/'config/web-resources/performances.json').read_text())
for resource in sys.argv[1:] or ['home-greeting','desk-normal']:
    spec=config[resource];frames=round(spec['seconds']*12);source=ROOT/f'assets/work/ene-web/{resource}/preview-frames';out=ROOT/f'ops/001-zhil/sprint-001/reports/local/web-resources/{resource}';out.mkdir(parents=True,exist_ok=True)
    for i in range(frames):
        if not (source/f'frame-{i:04d}.png').exists():raise RuntimeError(f'Missing {resource} preview frame {i}')
    records=[]
    for codec in ['webm','webp']:
        path=out/f'{resource}-preview.{codec}';args=[str(ff),'-hide_banner','-v','error','-y','-framerate','12','-start_number','0','-i',str(source/'frame-%04d.png'),'-frames:v',str(frames),'-an','-vf','format=rgba']
        args+=['-c:v','libvpx-vp9','-pix_fmt','yuva420p','-b:v','0','-crf','28','-auto-alt-ref','0','-threads','4'] if codec=='webm' else ['-c:v','libwebp_anim','-pix_fmt','yuva420p','-quality','80','-compression_level','4','-loop','0']
        args.append(str(path));subprocess.run(args,check=True);records.append({'file':str(path.relative_to(ROOT)),'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'command':subprocess.list2cmdline(args)})
    report={'resource':resource,'previewOnly':True,'sourceFps':24,'previewFps':12,'seconds':spec['seconds'],'frames':frames,'files':records}
    report['webp']={k:v for k,v in webp_info(out/f'{resource}-preview.webp').items() if k!='frames'}
    shutil.copyfile(source/'frame-0000.png',out/'poster.png')
    selected=[0,4,7,12,18,24,30,34,38,44,52,59] if resource=='home-greeting' else [0,4,8,12,16,19,20,21,24,28,32,35]
    selection='+'.join(f'eq(n\\,{i})' for i in selected)
    command=[str(ff),'-hide_banner','-v','error','-y','-framerate','12','-start_number','0','-i',str(source/'frame-%04d.png'),'-vf',f"select={selection},scale=180:-1:flags=lanczos,format=rgba,tile=6x2:color=0x24364b",'-frames:v','1',str(out/'contact-sheet.png')]
    subprocess.run(command,check=True)
    report['contactSheetPreviewFrames']=selected
    (ROOT/f'ops/001-zhil/sprint-001/reports/{resource}-preview-media.json').write_text(json.dumps(report,indent=2)+'\n');print('DRAFT_ENCODED',resource,flush=True)
shutil.copyfile(ROOT/'scripts/web_draft_review.html',ROOT/'ops/001-zhil/sprint-001/reports/local/web-resources/review.html')
shutil.copyfile(ROOT/'scripts/web_desk_states_review.html',ROOT/'ops/001-zhil/sprint-001/reports/local/web-resources/desk-states-review.html')
