"""Isolated 30-second paced LLVC file proof; never opens media or networking."""
from __future__ import annotations
import argparse
import ast
from array import array
import hashlib
import json
import math
import os
from pathlib import Path
import re
import subprocess
import sys
import time
import traceback
import types

ROOT=Path(__file__).resolve().parents[2]
BASE=ROOT/'.tools/voice/llvc'
sys.path.insert(0,str(ROOT/'scripts/voice'))
sys.path.insert(0,str(Path(__file__).parent))
from probe_llvc_stream_adapter import checkpoint,process_snapshot,sha,update,utc
from probe_llvc_affinity import apply_affinity,pin_current_thread,timer_resolution


def paths(label):
    name='llvc-paced-'+label
    folder=ROOT/'ops/reports/local/voice/llvc'
    return {'report':ROOT/'ops/reports'/(name+'.json'),'log':folder/(name+'.log'),
            'input':folder/(name+'-input16k.wav'),'converted':folder/(name+'-converted16k.wav'),
            'published':folder/(name+'-published40k.wav'),'reference':folder/(name+'-upstream16k.wav')}


def worker(args):
    files=paths(args.run_label);report=files['report']
    if not report.exists() or not files['log'].exists():raise ValueError('Parent must reserve report and log first')
    restore_timer=timer_resolution(1) if args.timer_resolution_ms else None
    checkpoint(report,'imports',status='running',workerPid=os.getpid(),appliedInferenceThreadAffinityMask=args.affinity_mask or None)
    import socket
    def deny(*args,**kwargs):raise RuntimeError('The isolated paced LLVC file proof cannot use networking')
    socket.socket.connect=socket.socket.connect_ex=socket.create_connection=socket.getaddrinfo=deny
    import numpy as np
    import soundfile as sf
    import torch
    from scipy.signal import resample_poly,upfirdn
    from llvc_paced import run_paced
    from llvc_stream_adapter import LLVCStreamAdapter
    from natural_pcm import NaturalPCM
    torch.set_num_threads(1);torch.set_num_interop_threads(1);torch.manual_seed(224)
    checkpoint(report,'load',torchVersion=torch.__version__)
    timings=[];adapter=LLVCStreamAdapter(on_timing=timings.append);adapter.load()
    catalog=json.loads((ROOT/'config/voice/assets.json').read_text(encoding='utf-8'))
    source=next(item for item in catalog['assets'] if item['id']=='ljspeech-sample')
    if sha(ROOT/source['path'])!=source['sha256']:raise ValueError('Changed licensed reference input')
    speech,rate=sf.read(ROOT/source['path'],dtype='float32')
    if speech.ndim!=1 or not np.isfinite(speech).all():raise ValueError('Invalid mono reference')
    divisor=math.gcd(rate,16000);speech=resample_poly(speech,16000//divisor,rate//divisor).astype(np.float32)
    unit=np.concatenate([speech,np.zeros(4000,dtype=np.float32)])
    fixture=np.tile(unit,math.ceil(480000/len(unit)))[:480000].copy()
    sf.write(files['input'],fixture,16000,subtype='FLOAT')
    def artifact(key,rate,samples,complete):
        return {'path':files[key].relative_to(ROOT).as_posix(),'sha256':sha(files[key]),'rate':rate,'samples':samples,'complete':complete}
    checkpoint(report,'warmup',source={'path':source['path'],'sha256':source['sha256'],'licensedPublicDomain':True,
               'loopGapSamples':4000,'fixtureSamples':len(fixture),'fixtureFloat32Sha256':hashlib.sha256(fixture.tobytes()).hexdigest()},
               inputAudio=artifact('input',16000,len(fixture),True))
    for start in range(0,16000,256):adapter.push(fixture[start:min(start+256,16000)])
    adapter.finish();adapter.reset();timings.clear()
    checkpoint(report,'paced-pipeline')
    pinned={}
    def on_thread_start(name):
        if args.affinity_mask and name=='llvc-serial-inference':
            pinned[name]={'mask':args.affinity_mask,'previousMask':pin_current_thread(int(args.affinity_mask,16))}
    try:
        result=run_paced(fixture,adapter,on_ready=lambda:process_snapshot(torch),on_finished=lambda:process_snapshot(torch),on_thread_start=on_thread_start)
    finally:
        if restore_timer:restore_timer()
    result['pinnedThreads']=pinned
    measured=list(timings)
    converted=result.pop('generated16k');published=result.pop('published40k')
    sf.write(files['converted'],converted,16000,subtype='FLOAT');sf.write(files['published'],published,40000,subtype='FLOAT')
    expected_calls=math.ceil(len(fixture)/832)
    wall_total=sum(item['wallMs'] for item in measured);cpu_total=sum(item['processCpuMs'] for item in measured)
    call_walls=np.asarray([item['wallMs'] for item in measured],dtype=np.float64)
    timing={'forwardCallCount':len(measured),'expectedNeuralCalls':expected_calls,'countMatches':len(measured)==expected_calls,
            'forwardWallTotalMs':wall_total,'forwardProcessCpuTotalMs':cpu_total,
            'forwardCpuToWallRatio':cpu_total/wall_total if wall_total else None,
            'computeRtf':wall_total/30000,'computeDeadlineMs':52,'computeDeadlineMisses':sum(item['wallMs']>52 for item in measured),
            'medianMs':float(np.median(call_walls)) if len(measured) else None,
            'p95Ms':float(np.percentile(call_walls,95)) if len(measured) else None,
            'maxMs':float(np.max(call_walls)) if len(measured) else None,
            'zeroPerCallCpuReadings':sum(item['processCpuMs']==0 for item in measured),
            'pacedCpuToWallRatio':result['pacedProcessCpuMs']/result['pacedWallMs'] if result['pacedWallMs'] else None}
    complete=result['completedWithoutLoss']
    checkpoint(report,'paced-evidence',pipeline=result,timingTotals=timing,timingSamples=measured,
               convertedAudio=artifact('converted',16000,len(converted),complete),publishedAudio=artifact('published',40000,len(published),complete))
    if not complete:raise AssertionError('Paced pipeline stopped or lost samples; partial WAVs/report retained')
    # Independent exact upstream replay occurs after the paced interval. It is
    # a correctness comparison, not a second timed/parameter experiment.
    checkpoint(report,'outside-timing-reference')
    original=(BASE/'source/infer.py').read_text(encoding='utf-8')
    functions=[node for node in ast.parse(original).body if isinstance(node,ast.FunctionDef) and node.name=='infer_stream']
    if len(functions)!=1:raise ValueError('Expected one pinned upstream infer_stream')
    namespace={'torch':torch,'np':np,'time':types.SimpleNamespace(time=time.perf_counter)}
    exec(compile(ast.Module(body=functions,type_ignores=[]),str(BASE/'source/infer.py'),'exec'),namespace)
    class CountedModel:
        def __init__(self,model):self.model=model;self.calls=0
        def __getattr__(self,name):return getattr(self.model,name)
        def __call__(self,*values,**kwargs):self.calls+=1;return self.model(*values,**kwargs)
    counted=CountedModel(adapter.model)
    with torch.inference_mode():reference,_,_=namespace['infer_stream'](counted,torch.from_numpy(fixture),4,16000)
    reference=reference.detach().cpu().numpy().reshape(-1)
    sf.write(files['reference'],reference,16000,subtype='FLOAT')
    exact=converted.shape==reference.shape and converted.tobytes()==reference.tobytes()
    resampler=NaturalPCM();fir_reference=upfirdn(resampler.taps,converted,up=5,down=2)[:len(published)]
    fir_error=float(np.max(np.abs(published-fir_reference))) if published.shape==fir_reference.shape else None
    fir_match=published.shape==fir_reference.shape and fir_error<=1e-7
    adapter.reset();timings.clear();fresh=array('f')
    prefix=fixture[:3344]
    for start in range(0,len(prefix),256):fresh.extend(adapter.push(prefix[start:start+256]))
    reset=np.frombuffer(fresh,dtype=np.float32)
    reset_exact=len(timings)==4 and len(reset)==3328 and reset.tobytes()==reference[:3328].tobytes()
    adapter.reset()
    parity={'upstreamBitExact':exact,'maxAbs16kError':float(np.max(np.abs(converted-reference))) if converted.shape==reference.shape else None,
            'upstreamNeuralCalls':counted.calls,'upstreamCallCountMatches':counted.calls==expected_calls,
            'causalFir40kMaxAbsError':fir_error,'causalFir40kTolerance':1e-7,'causalFir40kMatches':fir_match,
            'freshResetBitExact':reset_exact,'freshResetNeuralCalls':len(timings),'freshResetSamples':len(reset)}
    counts={'inputPackets':result['inputPackets']==1875,'consumedInputPackets':result['consumedInputPackets']==1875,
            'convertedSamples':len(converted)==480000,'publishedSamples':len(published)==1200000,
            'outputPackets':len(result['outputRecords'])==188,'timedNeuralCalls':len(measured)==577,'upstreamNeuralCalls':counted.calls==577}
    passed=all(counts.values()) and exact and fir_match and reset_exact and timing['computeDeadlineMisses']==0 and result['software350msBudgetMet']
    checkpoint(report,'complete',passed=passed,status='passed' if passed else 'failed',completed=utc(),parity=parity,countChecks=counts,
               upstreamAudio=artifact('reference',16000,len(reference),True),liveAccepted=False)
    if not passed:raise AssertionError('One or more paced/count/parity/reset/compute/software-budget gates failed; all evidence retained')


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--quiet-window',action='store_true');parser.add_argument('--worker',action='store_true');parser.add_argument('--run-label',required=True);parser.add_argument('--affinity-mask',default='');parser.add_argument('--timer-resolution-ms',type=int,default=0)
    args=parser.parse_args()
    if not args.quiet_window or not re.fullmatch(r'[a-z0-9][a-z0-9-]{0,31}',args.run_label):parser.error('Coordinate the quiet window and supply a fresh simple run label')
    files=paths(args.run_label)
    if args.worker:
        try:worker(args);return 0
        except BaseException as error:
            if files['report'].exists():update(files['report'],passed=False,status='failed',completed=utc(),errorType=type(error).__name__,error=str(error))
            traceback.print_exc();return 1
    if any(file.exists() for file in files.values()):parser.error('Choose a fresh label; previous evidence will not be overwritten')
    files['report'].parent.mkdir(parents=True,exist_ok=True);files['log'].parent.mkdir(parents=True,exist_ok=True)
    initial={'date':utc(),'runLabel':args.run_label,'passed':False,'status':'reserved','stage':'before-worker','paced':True,
             'sourceSeconds':30,'inputPacketSamples':256,'inputPacketMs':16,'internalChunkSamples':832,'internalChunkMs':52,
             'outputPacketSamples':6400,'outputPacketMs':160,'publisherInitialReserveMs':16,'inputQueuePacketCap':4,'outputQueuePacketCap':1,
             'receiverModel':{'initialInsertedSilenceMs':40,'queueCapMs':240,'causalFirGroupDelayMs':.625,'realAudioDevice':False},
             'timeoutSeconds':120,'workerThreadEnvironment':{'OMP_NUM_THREADS':'1','MKL_NUM_THREADS':'1','OPENBLAS_NUM_THREADS':'1'},
             'codeSha256':{name:sha(Path(__file__).with_name(name)) for name in ['probe_llvc_paced.py','llvc_paced.py']},
             'baselineSha256':{name:sha(ROOT/'scripts/voice'/name) for name in ['llvc_stream_adapter.py','probe_llvc_stream_adapter.py','natural_pcm.py']},
             'llvcManifestSha256':sha(BASE/'manifest.json'),'log':{'path':files['log'].relative_to(ROOT).as_posix()},
             'physicalMedia':False,'networkInference':False,'liveAccepted':False,
             'inferenceThreadAffinityMask':args.affinity_mask or None,
             'harnessTimerResolutionMs':args.timer_resolution_ms or None,
             'affinityRationale':('Pinned from the measured hybrid-core diagnostic llvc-affinity-hybrid-dc-v2: logical CPUs 0-3 are 100%-frequency P-cores and 4-11 are 50-70% E-cores.' if args.affinity_mask else None),
             'limits':['One synthetic paced file proof: no microphone, browser, OBS, speaker or physical latency measurement.',
                       'One research target; public-domain English source is not the user voice, and listening quality remains unaccepted.',
                       'The ideal sample-clock sink models the installed 40ms prefix and 240ms cap, not browser or hardware behavior.',
                       'Initial sink-start delay is a software scheduling proxy; FIR group delay is listed separately, not measured acoustic alignment.',
                       'Per-call Windows CPU readings may be zero/coarse; use aggregate CPU/wall totals, not individual ratios.',
                       'A synthetic acquisition wake over16ms late stops this proof separately from the four-packet/64ms FIFO bound; it does not prove physical sample loss.',
                       'Neural calls exceeding52ms are retained and reject acceptance after the paced interval; only pipeline/queue/deadline failures stop the running epoch.',
                       'Process CPU includes all owned threads. Whole-paced wall time includes scheduled waiting and the 250ms start lead.',
                       'No power, priority or served-route changes. Any harness timer resolution is recorded in harnessTimerResolutionMs and affects only this sleep-paced test, not the audio-device-clocked real contract. Any worker affinity pin is recorded in workerAffinityMask; an unset mask keeps the original scheduler behaviour. Failed trials keep the original16ms reserve and queue caps.']}
    with files['report'].open('x',encoding='utf-8') as stream:json.dump(initial,stream,indent=2)
    child=None;timed_out=False;code=None
    with files['log'].open('x',encoding='utf-8') as log:
        try:
            python=ROOT/'.tools/voice/venv/Scripts/python.exe'
            env={key:os.environ[key] for key in ['SYSTEMROOT','WINDIR','TEMP','TMP'] if key in os.environ}
            env.update(PATH=str(python.parent),OMP_NUM_THREADS='1',MKL_NUM_THREADS='1',OPENBLAS_NUM_THREADS='1',PYTHONIOENCODING='utf-8')
            child=subprocess.Popen([str(python),'-u','-I',str(Path(__file__).resolve()),'--worker','--quiet-window','--run-label',args.run_label]+(['--affinity-mask',args.affinity_mask] if args.affinity_mask else [])+(['--timer-resolution-ms',str(args.timer_resolution_ms)] if args.timer_resolution_ms else []),cwd=BASE,env=env,stdout=log,stderr=subprocess.STDOUT,creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0)
            try:code=child.wait(timeout=120)
            except subprocess.TimeoutExpired:
                timed_out=True
                if child.poll() is None:
                    if os.name=='nt':subprocess.run([str(Path(os.environ['SYSTEMROOT'])/'System32/taskkill.exe'),'/PID',str(child.pid),'/T','/F'],stdout=log,stderr=subprocess.STDOUT,timeout=5,creationflags=subprocess.CREATE_NO_WINDOW)
                    else:child.kill()
                code=child.wait(timeout=5)
        except BaseException as error:
            traceback.print_exc(file=log);log.flush()
            update(files['report'],passed=False,status='failed',errorType=type(error).__name__,error=str(error),completed=utc())
            if child is not None and child.poll() is None:child.kill();code=child.wait(timeout=5)
    fields={'workerExitCode':code,'timedOut':timed_out,'completed':utc(),'log':{'path':files['log'].relative_to(ROOT).as_posix(),'sha256':sha(files['log']),'bytes':files['log'].stat().st_size}}
    current=json.loads(files['report'].read_text(encoding='utf-8'))
    if timed_out:fields.update(passed=False,status='timed-out',error='Owned paced LLVC proof exceeded120 seconds; partial report/log retained')
    elif code!=0 or not current.get('passed'):fields.update(passed=False,status='failed')
    final=update(files['report'],**fields)
    print(json.dumps({'report':files['report'].relative_to(ROOT).as_posix(),'status':final['status'],'passed':final['passed'],
                      'failure':final.get('pipeline',{}).get('failure'),'error':final.get('error'),
                      'timingTotals':final.get('timingTotals'),'liveAccepted':False},indent=2))
    return 0 if final['passed'] else 1


if __name__=='__main__':raise SystemExit(main())
