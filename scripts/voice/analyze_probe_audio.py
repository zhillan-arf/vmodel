"""Numeric diagnostics for retained probe WAVs; no perceptual quality claim."""
from pathlib import Path
import json
import hashlib

ROOT = Path(__file__).resolve().parents[2]


def main():
    import numpy as np
    import soundfile as sf
    fixture = np.load(ROOT / 'assets/voice/onnx/bright-160ms-v1/fixture.npz', allow_pickle=False)
    reference = fixture['expected'].astype(np.float64)
    def stats(audio):
        window = np.hanning(len(audio))
        magnitude = np.abs(np.fft.rfft(audio * window))
        frequencies = np.fft.rfftfreq(len(audio), 1/40000)
        power = magnitude**2
        bands = {f'{lo}-{hi}Hz': float(power[(frequencies >= lo) & (frequencies < hi)].sum()/max(power.sum(),1e-12))
                 for lo,hi in [(0,300),(300,1000),(1000,4000),(4000,20001)]}
        return {'rms': float(np.sqrt(np.mean(audio**2))), 'peak': float(np.abs(audio).max()),
                'dcMean': float(np.mean(audio)), 'spectralBandPowerFraction': bands}, magnitude
    ref_stats, ref_spectrum = stats(reference)
    results = []
    paths = sorted((ROOT / 'ops/001-zhil/sprint-001/reports/local/voice/openvino').glob('*-converted-window.wav'))
    paths += [ROOT / 'ops/001-zhil/sprint-001/reports/local/voice/onnx/cpu-converted-window.wav']
    for path in paths:
        audio, rate = sf.read(path, dtype='float64')
        if rate != 40000 or len(audio) != len(reference):
            raise RuntimeError('Incomparable probe audio')
        values, spectrum = stats(audio)
        values.update(path=path.relative_to(ROOT).as_posix(), sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
                      rmseVsReference=float(np.sqrt(np.mean((audio-reference)**2))),
                      zeroLagCorrelation=float(np.corrcoef(audio,reference)[0,1]),
                      spectralConvergence=float(np.linalg.norm(spectrum-ref_spectrum)/max(np.linalg.norm(ref_spectrum),1e-12)))
        correlation = []
        for offset in range(-100,101):
            a,b = (audio[offset:], reference[:-offset]) if offset>0 else ((audio[:offset], reference[-offset:]) if offset<0 else (audio,reference))
            correlation.append(float(np.corrcoef(a,b)[0,1]))
        best = int(np.argmax(correlation))
        values['bestOffsetSamplesWithin2_5ms'] = best-100
        values['bestOffsetCorrelation'] = correlation[best]
        results.append(values)
    report = {'schemaVersion':1, 'sampleRate':40000, 'seconds':len(reference)/40000,
              'reference':'Exact eager float waveform, same cached real-speech features and explicit seeded noise',
              'referenceStats':ref_stats,'results':results,
              'boundary':'210 ms fixture, stored PCM16 outputs vs float eager reference. Numeric amplitude/correlation/Hann-FFT diagnostics only. Numerical mismatch is not proof of audible failure or intelligibility; listening remains unperformed.'}
    (ROOT / 'ops/001-zhil/sprint-001/reports/voice-probe-audio-comparison.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps({'reference':ref_stats,'results':[{k:r[k] for k in ['path','rms','rmseVsReference','zeroLagCorrelation','spectralConvergence','bestOffsetSamplesWithin2_5ms','bestOffsetCorrelation']} for r in results]},indent=2))


if __name__ == '__main__':
    main()
