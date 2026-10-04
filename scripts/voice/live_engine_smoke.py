"""One actual engine warmup plus three licensed file blocks; no audio device."""
import argparse
import hashlib
import json
from pathlib import Path
import sys
import time
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(Path(__file__).resolve().parent))
from profiles import defaults
from live_rvc import LiveRVC

if __name__=='__main__':
    import numpy as np
    import soundfile as sf
    from scipy.signal import resample_poly
    source=ROOT/'assets/voice/samples/LJ025-0076.wav'
    if hashlib.sha256(source.read_bytes()).hexdigest()!='b31133c05e9667a27db5be539ca089aa99e95ca7bef52040c902ff781680873a':raise RuntimeError('Reference changed')
    pcm,rate=sf.read(source,dtype='float32');pcm=resample_poly(pcm,320,441).astype(np.float32)
    engine=LiveRVC();started=time.monotonic();engine.load(defaults()['bright']);load=time.monotonic()-started
    blocks=[];durations=[]
    for i in range(3):
        started=time.monotonic();block=engine.process(pcm[i*2560:(i+1)*2560]);durations.append((time.monotonic()-started)*1000)
        assert block.shape==(6400,) and np.isfinite(block).all();blocks.append(block)
    result=np.concatenate(blocks);assert float(np.max(np.abs(result)))>0
    output=ROOT/'ops/001-zhil/sprint-001/reports/local/voice/live-adapter-three-blocks.wav';sf.write(output,result,40000,subtype='FLOAT')
    report={'schemaVersion':1,'passed':True,'source':'Public-domain LJ025-0076.wav','model':'CHIHAYA Bright','deviceCapture':False,'modelLoadAndOneWarmupSeconds':load,'processedBlocks':3,'inputSamplesPerBlock':2560,'outputSamplesPerBlock':6400,'outputSampleRate':40000,'computeMs':durations,'allFinite':True,'peak':float(np.max(np.abs(result))),'output':str(output.relative_to(ROOT)).replace('\\','/'),'outputSha256':hashlib.sha256(output.read_bytes()).hexdigest(),'boundary':'Functional adapter check. Initial 480 ms only, no listening/real-time/physical latency acceptance; timing is incidental to this bounded implementation check.'}
    (ROOT/'ops/001-zhil/sprint-001/reports/voice-live-adapter-smoke.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
