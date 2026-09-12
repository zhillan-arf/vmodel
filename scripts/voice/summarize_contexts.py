"""Verify context-comparison artifacts and prepare RMS-matched review WAVs."""
from pathlib import Path
import hashlib
import html
import json

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets/voice/auditions/context-v1'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    import numpy as np
    import soundfile as sf
    reports = [json.loads((ROOT / f'ops/reports/voice-context{c}.json').read_text()) for c in [1600,800,400]]
    source_hashes = {r['sourceReferenceSha256'] for r in reports}
    if len(source_hashes) != 1:
        raise RuntimeError('Context experiments used different source audio')
    files = [('source','Original English reference',OUT/'source.wav')]
    for report in reports:
        p = ROOT / report['output']
        if sha(p) != report['outputSha256']:
            raise RuntimeError('Changed experimental audio')
        if report['blocks'] != len(report['records']) or report['outputSeconds'] != report['inputSeconds']:
            raise RuntimeError('Invalid continuous-file accounting')
        files.append((f"context{report['contextMs']}",f"{report['contextMs']} ms past-context experiment",p))
    decoded, gains = [], []
    for _,_,path in files:
        audio,rate = sf.read(path,dtype='float32')
        if rate != 40000 or not np.isfinite(audio).all() or len(audio) != 339200:
            raise RuntimeError('Unexpected comparison duration/rate/values')
        rms = float(np.sqrt(np.mean(audio**2)))
        if rms < 1e-5:
            raise RuntimeError('Silent comparison audio')
        decoded.append(audio)
        gains.append(0.07/rms)
    headroom = min(1.0,min(0.9/max(float(np.max(np.abs(a)))*g,1e-8) for a,g in zip(decoded,gains)))
    clips = []
    for (key,label,path),audio,gain in zip(files,decoded,gains):
        output = OUT/f'{key}-listen.wav'
        gain *= headroom
        sf.write(output,audio*gain,40000,subtype='PCM_16')
        clips.append({'id':key,'label':label,'rawPath':path.relative_to(ROOT).as_posix(),'rawSha256':sha(path),
                      'listeningPath':output.relative_to(ROOT).as_posix(),'listeningSha256':sha(output),
                      'gain':gain,'seconds':len(audio)/40000,'sampleRate':40000,
                      'rmsAfterGain':float(np.sqrt(np.mean((audio*gain)**2)))})
    result = {'schemaVersion':1,'source':'Same complete public-domain LJ Speech English excerpt, approximately 8.40 seconds, zero-padded at the end to 53 blocks / 8.48 seconds',
              'sourceText':'Many animals of even complex structure which live parasitically within others are wholly devoid of an alimentary cavity.',
              'normalization':'RMS matched at 0.07 with shared 0.9 peak headroom; not LUFS or a dynamic limiter',
              'clips':clips,'reports':[{'contextMs':r['contextMs'],'computeMs':r['computeMs'],'computeRealTimeFactor':r['computeRealTimeFactor'],
                  'blocksSlowerThan160Ms':r['blocksSlowerThan160Ms'],'normalizedBoundaryJump':r['normalizedBoundaryJump'],
                  'report':f"ops/reports/voice-context{r['contextMs']}.json"} for r in reports],
              'qualityAccepted':False,'boundary':'Experimental streaming-window file conversions on one source speaker. No user microphone, trained English control, five-minute speech, true live delay, OBS combined load or listening acceptance.'}
    (OUT/'manifest.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
    (ROOT/'ops/reports/voice-context-comparison.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
    cards = ''.join(f'<section><h2>{html.escape(c["label"])}</h2><audio controls preload="metadata" src="{c["id"]}-listen.wav"></audio></section>' for c in clips)
    page = '''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ene speech quality experiments</title><style>
*{box-sizing:border-box}body{margin:0;background:#09121d;color:#e4f2fa;font:17px/1.65 "Segoe UI",sans-serif}main{max-width:820px;margin:auto;padding:36px 24px}h1{font-size:40px;line-height:1.15}h2{font-size:20px}p{color:#aac4d2}section{padding:20px 24px;margin:18px 0;border:1px solid #305363;border-radius:14px;background:#112330}audio{width:100%}small{color:#8dabbc}button{border:1px solid #6dd3e3;background:#173b49;color:#e4f2fa;padding:12px 20px;border-radius:8px;font:inherit;cursor:pointer}
</style><main><small>ENE / LOCAL SOUND REVIEW</small><h1>Listen for clear English.</h1>
<p>One complete English passage. One bright character voice. Three experimental amounts of past speech history. Listen for missing syllables, repeated sounds, clicks and changes in tone.</p>
<p>These are generated audio files using a public-domain speaker. Their playback timing does not represent microphone delay. No voice or live setting has been accepted.</p>
''' + cards + '''<button type="button">Stop all audio</button><p><small>Volume is matched across clips. The original speech is a source reference, not a trained English control. Your microphone is off and this page makes no network requests.</small></p></main>
<script>const players=[...document.querySelectorAll('audio')];for(const p of players)p.addEventListener('play',()=>{for(const other of players)if(other!==p)other.pause()});document.querySelector('button').onclick=()=>{for(const p of players){p.pause();p.currentTime=0}}</script></html>'''
    (OUT/'review.html').write_text(page,encoding='utf-8')
    print(json.dumps(result,indent=2))


if __name__ == '__main__':
    main()
