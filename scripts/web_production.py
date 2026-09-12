"""Private, content-addressed master plans shared by Blender and encoders."""
from pathlib import Path
import hashlib
import json
import struct
import zlib

ROOT = Path(__file__).resolve().parents[1]
IDS = ('home-greeting', 'desk-normal', 'desk-confused', 'desk-surprised', 'desk-excited')
WORK = ROOT / 'assets/work/ene-web'
PAUSE = WORK / 'production.pause'
SETTINGS = {'engine': 'BLENDER_EEVEE', 'samples': 32, 'fps': 24,
            'format': 'PNG', 'colorMode': 'RGBA', 'colorDepth': '8', 'compression': 20,
            'transparent': True, 'viewTransform': 'Standard', 'look': 'None',
            'exposure': -0.2, 'gamma': 1, 'cpuThreads': 4}

def read_json(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))

def write_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    temporary.replace(path)

def sha(path):
    with Path(path).open('rb') as handle:
        return hashlib.file_digest(handle, 'sha256').hexdigest()

def relative(path):
    return Path(path).relative_to(ROOT).as_posix()

def plan(resource):
    if resource not in IDS:
        raise ValueError(f'Unknown resource {resource}')
    spec = read_json(ROOT / 'config/web-resources/performances.json')[resource]
    audit = read_json(ROOT / f'ops/reports/{resource}-audit.json')
    scene = WORK / f'{resource}.blend'
    scene_sha = sha(scene)
    if scene_sha != audit['sceneSha256'] or not audit['allVerticesFinite'] or audit['loopEndpointMaxVertexDistanceMeters'] != 0:
        raise ValueError(f'{resource}: accepted all-frame source audit does not match scene')
    recipe = {'resource': resource, 'scene': relative(scene), 'sceneSha256': scene_sha,
              'blenderVersion': '5.1.1', 'blenderBuild': 'b70da489d7f4',
              'size': spec['large'], 'smallSize': spec['small'], 'frameCount': round(spec['seconds'] * 24),
              'durationSeconds': spec['seconds'], 'settings': SETTINGS}
    key = hashlib.sha256(json.dumps(recipe, sort_keys=True, separators=(',', ':')).encode()).hexdigest()[:20]
    return {**recipe, 'buildKey': key, 'masterDirectory': relative(WORK / resource / 'masters' / key)}

def png_info(path, expected_size=None):
    """Verify complete 8-bit RGBA PNG chunks, CRCs and decompressed row lengths."""
    data = Path(path).read_bytes()
    if data[:8] != b'\x89PNG\r\n\x1a\n':
        raise ValueError('Not PNG')
    offset, compressed, width, height, ended = 8, bytearray(), None, None, False
    while offset + 12 <= len(data):
        size = struct.unpack_from('>I', data, offset)[0]
        tag = data[offset + 4:offset + 8]
        end = offset + 8 + size
        if end + 4 > len(data):
            raise ValueError('Truncated PNG')
        payload = data[offset + 8:end]
        if zlib.crc32(tag + payload) & 0xffffffff != struct.unpack_from('>I', data, end)[0]:
            raise ValueError('PNG CRC mismatch')
        if tag == b'IHDR':
            width, height, depth, color, compression, filtering, interlace = struct.unpack('>IIBBBBB', payload)
            if (depth, color, compression, filtering, interlace) != (8, 6, 0, 0, 0):
                raise ValueError('Expected non-interlaced RGBA8 PNG')
        elif tag == b'IDAT':
            compressed.extend(payload)
        elif tag == b'IEND':
            ended = True
            if size or end + 4 != len(data):
                raise ValueError('Invalid PNG end')
        offset = end + 4
    if not ended or not width or not height or expected_size and [width, height] != list(expected_size):
        raise ValueError('PNG dimensions/completion mismatch')
    raw = zlib.decompress(compressed)
    stride = width * 4 + 1
    if len(raw) != stride * height or any(raw[row * stride] > 4 for row in range(height)):
        raise ValueError('Invalid PNG scanlines')
    return {'width': width, 'height': height, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
