"""Measured local VP9/WebP sweep and alpha fixtures from private PNG masters."""
from pathlib import Path
import hashlib, json, subprocess, time
from web_media import webp_info

ROOT=Path(__file__).resolve().parents[1]
config=json.loads((ROOT/'config/web-resources/source.json').read_text())
tool=json.loads((ROOT/'config/web-resources/toolchain.json').read_text())['ffmpeg']
ffmpeg=ROOT/tool['installDirectory']/'bin/ffmpeg.exe'
ffprobe=ROOT/tool['installDirectory']/'bin/ffprobe.exe'
frames=ROOT/config['privateFrames'];out=ROOT/config['privateMedia'];out.mkdir(parents=True,exist_ok=True)
entries=[]
def run(args, data=None):
    command=[str(ffmpeg),'-hide_banner','-loglevel','error','-y',*map(str,args)]
    start=time.perf_counter();subprocess.run(command,input=data,check=True)
    return {'command':subprocess.list2cmdline(command),'seconds':time.perf_counter()-start}
for index in range(1,49):
    if not (frames/f'frame-{index:04d}.png').exists(): raise RuntimeError(f'Missing master {index}')
for size in [480,960]:
    for codec,qualities in [('webm',[28,34,40]),('webp',[65,80])]:
        for quality in qualities:
            path=out/f'ene-spike-{size}-q{quality}.{codec}'
            # Explicit RGBA intermediate keeps zero alpha zero during downscale.
            # Direct Lanczos RGBA -> yuva420p negotiation produced alpha=1 background.
            args=['-framerate','24','-start_number','1','-i',frames/'frame-%04d.png','-frames:v','48','-vf',f'scale={size}:{size}:flags=lanczos,format=rgba','-an']
            args+=['-c:v','libvpx-vp9','-pix_fmt','yuva420p','-b:v','0','-crf',quality,'-deadline','good','-cpu-used','2','-row-mt','1','-threads','4','-auto-alt-ref','0'] if codec=='webm' else ['-c:v','libwebp_anim','-pix_fmt','yuva420p','-quality',quality,'-compression_level','4','-loop','0']
            record=run([*args,path])
            record.update(file=path.name,bytes=path.stat().st_size,sha256=hashlib.sha256(path.read_bytes()).hexdigest(),width=size,height=size,codec=codec,quality=quality)
            # FFmpeg's default native VP9 decoder can discard WebM alpha; force libvpx.
            decode=['-c:v','libvpx-vp9'] if codec=='webm' else []
            raw=subprocess.check_output([str(ffmpeg),'-v','error',*decode,'-i',str(path),'-frames:v','1','-pix_fmt','rgba','-f','rawvideo','pipe:1'])
            if len(raw)!=size*size*4:raise RuntimeError(f'Unexpected decoded frame length: {path.name}')
            alpha=raw[3::4]
            record['decodedAlpha']={'zero':alpha.count(0),'full':alpha.count(255),'partial':len(alpha)-alpha.count(0)-alpha.count(255)}
            if not record['decodedAlpha']['zero'] or not record['decodedAlpha']['partial']:raise RuntimeError('Lost transparency')
            record['probe']=json.loads(subprocess.check_output([str(ffprobe),'-v','error','-show_streams','-show_format','-of','json',str(path)],text=True))
            if codec=='webp':
                record['webpAnimation']=webp_info(path)
                if record['webpAnimation']['frameCount']<2 or not record['webpAnimation']['alpha']:raise RuntimeError('Expected animated alpha WebP')
            entries.append(record);print(path.name,path.stat().st_size,round(record['seconds'],2),flush=True)
    poster=out/f'ene-spike-{size}-poster.webp'
    record=run(['-i',frames/'frame-0001.png','-vf',f'scale={size}:{size}:flags=lanczos,format=rgba','-frames:v','1','-c:v','libwebp','-lossless','0','-quality','85',poster])
    entries.append({'file':poster.name,'bytes':poster.stat().st_size,'sha256':hashlib.sha256(poster.read_bytes()).hexdigest(),'codec':'poster','width':size,'height':size,**record})
run(['-i',frames/'frame-0001.png','-frames:v','1',out/'ene-spike-poster.png'])
# A tiny non-character probe has transparent upper-left and opaque lower-right.
rgba=bytes(v for y in range(32) for x in range(32) for v in ((90,160,220,255) if x>=16 and y>=16 else (0,0,0,0)))
for alpha,name in [(True,'alpha-probe'),(False,'opaque-probe')]:
    run(['-f','rawvideo','-pixel_format','rgba','-video_size','32x32','-framerate','24','-i','pipe:0','-frames:v','2','-an','-c:v','libvpx-vp9','-pix_fmt','yuva420p' if alpha else 'yuv420p','-lossless','1','-auto-alt-ref','0',out/(name+'.webm')],rgba*2)
report={'schemaVersion':1,'date':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'sourceFrames':config['privateFrames'],'frameCount':48,'fps':24,'seconds':2,'entries':entries}
(ROOT/'ops/001-zhil/sprint-001/reports/web-spike-encoding.json').write_text(json.dumps(report,indent=2)+'\n')
print('WEB_SPIKE_ENCODED',flush=True)
