"""Validated provisional voice profiles; secrets never belong in profiles."""
from __future__ import annotations
import copy
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
VOICE_IDS = ('bright', 'soft', 'cool')


def fingerprint(profile):
    relevant = {key: profile[key] for key in ['modelId', 'modelSha256', 'engineRevision', 'backend', 'audio', 'inputDeviceId']}
    return hashlib.sha256(json.dumps(relevant, sort_keys=True).encode()).hexdigest()


def defaults():
    assets = json.loads((ROOT / 'config/voice/assets.json').read_text())
    targets = {a['id']: a for a in assets['assets']}
    result = {}
    for voice in VOICE_IDS:
        profile = {'schemaVersion': 1, 'id': voice, 'displayName': voice.title(),
                   'modelId': 'chihaya-' + voice, 'modelSha256': targets['chihaya-' + voice]['sha256'],
                   'engineRevision': assets['engine']['revision'], 'language': 'Japanese-trained; English audition pending',
                   'backend': {'id': 'rvc-cpu-eager', 'location': 'local', 'provider': 'CPUExecutionProvider', 'encoderPrecision': 'fp32'},
                   'audio': {'inputSampleRate': 16000, 'outputSampleRate': 40000, 'chunkMs': 160,
                             'contextMs': 1600, 'crossfadeMs': 40, 'searchMs': 10, 'lateCutoffMs': 160},
                   'f0': False, 'pitchSemitones': None, 'indexRatio': 0,
                   'inputGain': 1.0, 'outputGain': 1.0, 'inputDeviceId': 'default',
                   'monitoring': False, 'provisional': True, 'englishAccepted': False, 'liveAccepted': False,
                   'license': {'target': 'MIT', 'encoder': 'GPL-3.0', 'engine': 'MIT'}}
        profile['sync'] = {'fingerprint': fingerprint(profile), 'verified': False, 'videoDelayMs': None, 'residualMs': None}
        result[voice] = profile
    return result


def validate(profile):
    if not isinstance(profile, dict) or profile.get('id') not in VOICE_IDS:
        raise ValueError('Unknown voice profile')
    canonical = defaults()[profile['id']]
    if set(profile) != set(canonical):
        raise ValueError('Unknown or missing profile fields')
    editable = {'audio', 'inputGain', 'outputGain', 'inputDeviceId', 'monitoring', 'sync'}
    if any(profile[k] != canonical[k] for k in set(profile) - editable):
        raise ValueError('Unsupported model, backend, pitch, license or acceptance claim')
    audio = profile['audio']
    if not isinstance(audio, dict) or set(audio) != set(canonical['audio']):
        raise ValueError('Invalid audio configuration')
    if type(audio['contextMs']) is not int or audio['contextMs'] not in (400,800,1600):
        raise ValueError('Unsupported past context')
    if any(audio[k] != canonical['audio'][k] for k in audio if k != 'contextMs'):
        raise ValueError('Unsupported audio timing or sample rate')
    for key in ['inputGain', 'outputGain']:
        if type(profile[key]) not in (float,int) or not 0 <= profile[key] <= 2:
            raise ValueError('Gain must be between zero and two')
    if not isinstance(profile['inputDeviceId'], str) or not 1 <= len(profile['inputDeviceId']) <= 300:
        raise ValueError('Invalid input device')
    if type(profile['monitoring']) is not bool:
        raise ValueError('Invalid monitoring choice')
    sync = profile['sync']
    if not isinstance(sync,dict) or set(sync) != set(canonical['sync']) or sync['fingerprint'] != fingerprint(profile):
        raise ValueError('Sync calibration belongs to different timing/device settings')
    # This release has no measured physical sync calibration to accept.
    if sync['verified'] is not False or sync['videoDelayMs'] is not None or sync['residualMs'] is not None:
        raise ValueError('No measured live sync calibration is available')
    return copy.deepcopy(profile)


def update(profile, changes):
    allowed = {'contextMs','inputGain','outputGain','inputDeviceId','monitoring'}
    if not isinstance(changes,dict) or set(changes) - allowed:
        raise ValueError('Unsupported profile change')
    result = copy.deepcopy(profile)
    for key,value in changes.items():
        if key == 'contextMs':
            result['audio'][key] = value
        else:
            result[key] = value
    if fingerprint(result) != result['sync']['fingerprint']:
        result['sync'] = {'fingerprint':fingerprint(result),'verified':False,'videoDelayMs':None,'residualMs':None}
    return validate(result)


def load_profiles(path):
    if not path.exists():
        return defaults(), 'bright'
    saved = json.loads(path.read_text())
    if set(saved) != {'schemaVersion','selected','profiles'} or saved.get('schemaVersion') != 1 or saved.get('selected') not in VOICE_IDS or set(saved.get('profiles',{})) != set(VOICE_IDS):
        raise ValueError('Unsupported saved profile file')
    if any(value.get('id') != key for key,value in saved['profiles'].items()):
        raise ValueError('Profile identity does not match its preset slot')
    return {key:validate(value) for key,value in saved['profiles'].items()}, saved['selected']


def save_profiles(path, profiles, selected):
    if selected not in VOICE_IDS:
        raise ValueError('Unknown selected preset')
    data = {'schemaVersion':1,'selected':selected,'profiles':{key:validate(profiles[key]) for key in VOICE_IDS}}
    path.parent.mkdir(parents=True,exist_ok=True)
    temporary = path.with_suffix('.pending.json')
    temporary.write_text(json.dumps(data,indent=2),encoding='utf-8')
    temporary.replace(path)


def natural_fingerprint(profile):
    keys=['mode','backend','audio','inputDeviceId']
    return hashlib.sha256(json.dumps({k:profile[k] for k in keys},sort_keys=True).encode()).hexdigest()


def natural_default():
    value={'schemaVersion':1,'id':'natural','displayName':'Natural voice','mode':'natural',
           'backend':{'location':'local','id':'scipy-polyphase-5:2','neuralInference':False},
           'audio':{'inputSampleRate':16000,'outputSampleRate':40000,'chunkMs':160,'resamplerDelayMs':0.625,'outputPrefillMs':40,'maxOutputQueueMs':240},
           'inputDeviceId':'default','inputGain':1.0,'outputGain':1.0,
           'requiresExplicitStart':True,'activeOnStartup':False,'automaticFallbackAllowed':False,
           'outputKind':'VMNA','routeKind':'natural','physicalSyncAccepted':False}
    value['sync']={'fingerprint':natural_fingerprint(value),'verified':False,'videoDelayMs':None,'residualMs':None}
    return value


def validate_natural(value):
    expected=natural_default()
    if not isinstance(value,dict) or set(value)!=set(expected):raise ValueError('Invalid natural profile')
    if any(value[k]!=expected[k] for k in expected if k not in ['inputDeviceId','inputGain','outputGain','sync']):raise ValueError('Unsupported natural mode or automatic-start/fallback claim')
    if not isinstance(value['inputDeviceId'],str) or not 1<=len(value['inputDeviceId'])<=300:raise ValueError('Invalid natural input device')
    for key in ['inputGain','outputGain']:
        if type(value[key]) not in (int,float) or not 0<=value[key]<=2:raise ValueError('Invalid natural gain')
    required={'fingerprint':natural_fingerprint(value),'verified':False,'videoDelayMs':None,'residualMs':None}
    if value['sync']!=required:raise ValueError('Natural sync is unmeasured or belongs to another device')
    return copy.deepcopy(value)


def update_natural(value,changes):
    if not isinstance(changes,dict) or set(changes)-{'inputDeviceId','inputGain','outputGain'}:raise ValueError('Unsupported natural control')
    result=copy.deepcopy(value);result.update(changes)
    result['sync']={'fingerprint':natural_fingerprint(result),'verified':False,'videoDelayMs':None,'residualMs':None}
    return validate_natural(result)
