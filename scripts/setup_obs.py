"""Provision project-owned portable OBS profiles without replacing saved user edits."""
import configparser
import json
from pathlib import Path
import secrets
import uuid

ROOT = Path(__file__).resolve().parents[1]
OBS = ROOT / '.tools/obs'
CONFIG = OBS / 'config/obs-studio'

def write_new(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        path.write_text(text, encoding='utf-8')

def setup():
    if not (OBS / 'bin/64bit/obs64.exe').is_file():
        raise SystemExit('OBS is missing. Run python scripts/provision_tools.py first.')
    recording_dir = ROOT / 'recordings'
    recording_dir.mkdir(exist_ok=True)
    for orientation, width, height in [('Landscape', 1280, 720), ('Portrait', 720, 1280)]:
        profile = CONFIG / 'basic/profiles' / ('Ene' + orientation)
        ini = f'''[General]
Name=Ene {orientation}

[Video]
BaseCX={width}
BaseCY={height}
OutputCX={width}
OutputCY={height}
FPSType=0
FPSCommon=30
ScaleType=bicubic
ColorFormat=NV12
ColorSpace=709
ColorRange=Partial

[Output]
Mode=Advanced
FilenameFormatting=Ene-{orientation}-%CCYY-%MM-%DD_%hh-%mm-%ss

[AdvOut]
RecType=Standard
RecFilePath={recording_dir.as_posix()}
RecFormat2=mkv
RecTracks=1
RecEncoder=obs_x264
RecUseRescale=false
Encoder=obs_x264
TrackIndex=1

[Audio]
SampleRate=48000
ChannelSetup=Stereo
'''
        write_new(profile / 'basic.ini', ini)
        write_new(profile / 'recordEncoder.json', json.dumps({'rate_control': 'CRF', 'crf': 23, 'preset': 'veryfast', 'profile': 'high', 'keyint_sec': 2}, indent=2))
    scene_path = CONFIG / 'basic/scenes/EneStudio.json'
    scenes = []
    for name in ['Ene Landscape', 'Ene Portrait']:
        scenes.append({'name': name, 'uuid': str(uuid.uuid5(uuid.NAMESPACE_URL, 'vmodel:scene:' + name)),
                       'id': 'scene', 'versioned_id': 'scene', 'settings': {'id_counter': 0, 'custom_size': False, 'items': []},
                       'mixers': 0, 'enabled': True, 'muted': False, 'volume': 1.0, 'balance': .5,
                       'canvas_uuid': '6c69626f-6273-4c00-9d88-c5136d61696e'})
    collection = {'name': 'Ene Studio', 'sources': scenes, 'groups': [], 'scene_order': [{'name': x['name']} for x in scenes],
                  'current_scene': 'Ene Landscape', 'current_program_scene': 'Ene Landscape', 'canvases': [],
                  'current_transition': 'Fade', 'transition_duration': 200, 'transitions': [], 'quick_transitions': [], 'saved_projectors': [], 'modules': {}, 'version': 2}
    write_new(scene_path, json.dumps(collection, indent=2))
    # No default desktop/microphone devices are present in this collection.
    websocket = CONFIG / 'plugin_config/obs-websocket/config.json'
    config = json.loads(websocket.read_text(encoding='utf-8-sig')) if websocket.exists() else {}
    config.update({'server_enabled': True, 'server_port': 4455, 'auth_required': True, 'ipv4_only': True,
                   'alerts_enabled': False, 'first_load': False})
    if not config.get('server_password'):
        config['server_password'] = secrets.token_urlsafe(32)
    websocket.parent.mkdir(parents=True, exist_ok=True)
    websocket.write_text(json.dumps(config, indent=2), encoding='utf-8')
    user = CONFIG / 'user.ini'
    parser = configparser.ConfigParser(interpolation=None)
    parser.optionxform = str
    if user.exists(): parser.read(user, encoding='utf-8-sig')
    if not parser.has_section('General'): parser.add_section('General')
    # OBS uses true to mean initial startup has already been handled.
    parser['General']['FirstRun'] = 'true'
    if not parser.has_section('Basic'): parser.add_section('Basic')
    parser['Basic']['ConfigOnNewProfile'] = 'false'
    parser['General']['ConfirmOnExit'] = 'false'
    with user.open('w', encoding='utf-8') as handle: parser.write(handle, space_around_delimiters=False)
    print('Portable Ene Landscape/Portrait profiles and empty video-only scenes are ready. Saved scene/profile edits were preserved.')

if __name__ == '__main__': setup()
