"""Prepare level-matched versions of the licensed reference and three conversions."""
import hashlib
import json
from math import gcd
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets/voice/auditions/reference-v1'


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    manifest = json.loads((ROOT / 'config/voice/assets.json').read_text(encoding='utf-8'))
    assets = {item['id']: item for item in manifest['assets']}
    inputs = [('source', ROOT / assets['ljspeech-sample']['path'])]
    inputs += [(name, ROOT / f'ops/reports/local/voice/converted-{name}.wav') for name in ['bright', 'soft', 'cool']]
    audio = []
    for name, path in inputs:
        if name == 'source':
            expected = assets['ljspeech-sample']['sha256']
        else:
            report = json.loads(path.with_suffix('.json').read_text(encoding='utf-8'))
            expected = report['outputSha256']
            assert report['inputSha256'] == assets['ljspeech-sample']['sha256']
        assert digest(path) == expected, f'Changed original: {name}'
        data, rate = sf.read(path, dtype='float64', always_2d=True)
        data = data.mean(axis=1)
        divisor = gcd(rate, 40000)
        data = resample_poly(data, 40000 // divisor, rate // divisor)
        assert np.isfinite(data).all()
        rms = float(np.sqrt(np.mean(data * data)))
        peak = float(np.abs(data).max())
        assert rms > 0.0001
        audio.append((name, path, data, rms, peak))
    # Common RMS and one common headroom constraint; no voice-specific limiting.
    # This is RMS matching, not a claim of perceptual LUFS equivalence.
    target_rms = min(0.07, *(0.9 * rms / peak for _, _, _, rms, peak in audio))
    OUT.mkdir(parents=True, exist_ok=True)
    items = []
    for name, path, data, rms, peak in audio:
        gain = target_rms / rms
        normalized = data * gain
        output = OUT / f'{name}.wav'
        sf.write(output, normalized, 40000, subtype='PCM_16')
        items.append({'id': name, 'original': path.relative_to(ROOT).as_posix(), 'originalSha256': digest(path),
                      'path': output.relative_to(ROOT).as_posix(), 'url': f'/audio/{name}.wav',
                      'sha256': digest(output), 'sampleRate': 40000, 'seconds': len(normalized) / 40000,
                      'inputRms': rms, 'gainDb': float(20 * np.log10(gain)), 'outputRms': target_rms,
                      'outputPeak': peak * gain, 'modelId': None if name == 'source' else 'chihaya-' + name,
                      'license': assets['ljspeech-sample']['license'] if name == 'source' else 'MIT target / public-domain input'})
    result = {'schemaVersion': 1, 'id': 'reference-v1', 'language': 'English',
              'transcript': 'Many animals of even complex structure which live parasitically within others are wholly devoid of an alimentary cavity.',
              'inputSpeaker': 'Linda Johnson — public-domain LJ Speech reference',
              'isUserVoice': False, 'trainedEnglishControlIncluded': False, 'levelMatching': 'Common RMS with shared 0.9 peak headroom; no limiter',
              'targetRms': target_rms, 'items': items}
    (OUT / 'manifest.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    (ROOT / 'ops/reports/voice-reference-auditions.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    print(json.dumps({'output': str(OUT), 'items': len(items), 'targetRms': target_rms, 'allPeaksBelow': 0.9}))


if __name__ == '__main__':
    main()
