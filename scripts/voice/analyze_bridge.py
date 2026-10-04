"""Match recorded bridge audio to its converted reference, retaining silence checks."""
import hashlib
import json
from pathlib import Path
import numpy as np
import soundfile as sf
from scipy.signal import correlate,fftconvolve
ROOT=Path(__file__).resolve().parents[2]
if __name__=='__main__':
    path=ROOT/'ops/001-zhil/sprint-001/reports/voice-obs-bridge-smoke.json';report=json.loads(path.read_text())
    if not report['passed']:raise RuntimeError('Recording did not finish')
    recorded,rate=sf.read(ROOT/report['wav'],dtype='float64');reference,reference_rate=sf.read(ROOT/'assets/voice/auditions/reference-v1/bright.wav',dtype='float64')
    assert rate==reference_rate==40000 and recorded.ndim==reference.ndim==1
    correlation=correlate(recorded,reference,mode='valid',method='fft')
    energy=fftconvolve(recorded**2,np.ones(len(reference)),mode='valid')
    normalized=correlation/np.sqrt(np.maximum(energy*np.sum(reference**2),1e-20));offset=int(np.argmax(normalized))
    matched=recorded[offset:offset+len(reference)]
    gain=float(np.dot(matched,reference)/np.dot(reference,reference));residual=matched-gain*reference
    analysis={'recordedWavSha256':hashlib.sha256((ROOT/report['wav']).read_bytes()).hexdigest(),'reference':'assets/voice/auditions/reference-v1/bright.wav','bestReferenceOffsetSeconds':offset/rate,'normalizedCorrelation':float(normalized[offset]),'matchedGain':gain,'matchedRms':float(np.sqrt(np.mean(matched**2))),'residualRms':float(np.sqrt(np.mean(residual**2))),'firstSecondRms':float(np.sqrt(np.mean(recorded[:rate]**2))),'lastSecondRms':float(np.sqrt(np.mean(recorded[-rate:]**2))),'interpretation':'Decoded AAC matched against the preconverted reference. Offset locates test playback in the recording; it is not microphone-to-output latency or lip-sync measurement.'}
    analysis['referenceMatchPassed']=analysis['normalizedCorrelation']>.85 and analysis['matchedRms']>.005
    analysis['silenceBeforeAndAfterPassed']=analysis['firstSecondRms']<.001 and analysis['lastSecondRms']<.001
    windows=[];width=int(.3*rate);radius=int(.002*rate)
    for start in range(0,len(reference)-width,int(.4*rate)):
        sample=reference[start:start+width]
        if np.sqrt(np.mean(sample**2))<.025:continue
        excerpt=recorded[offset+start-radius:offset+start+width+radius]
        dot=correlate(excerpt,sample,mode='valid',method='fft')
        energies=fftconvolve(excerpt**2,np.ones(width),mode='valid')
        scores=dot/np.sqrt(np.maximum(energies*np.dot(sample,sample),1e-20));best=int(np.argmax(scores))
        windows.append({'sourceSeconds':start/rate,'localOffsetFromWholeClipMs':(best-radius)*1000/rate,'normalizedCorrelation':float(scores[best])})
    analysis['speechWindows']=windows
    analysis['windowCorrelationP05']=float(np.percentile([w['normalizedCorrelation'] for w in windows],5))
    analysis['windowOffsetRangeMs']=float(np.ptp([w['localOffsetFromWholeClipMs'] for w in windows]))
    analysis['continuousSpeechQualityAccepted']=False
    report['audioAnalysis']=analysis;report['passed']=report['passed'] and analysis['referenceMatchPassed'] and analysis['silenceBeforeAndAfterPassed']
    path.write_text(json.dumps(report,indent=2));print(json.dumps(analysis,indent=2))
    if not report['passed']:raise SystemExit(1)
