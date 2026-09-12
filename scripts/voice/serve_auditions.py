"""Serve only the local audition UI and four cataloged WAV files on loopback."""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import re
import threading
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[2]
UI = Path(__file__).parent / 'audition'
DEFAULT_DATA = ROOT / 'assets/voice/auditions/reference-v1'
SCORES = {'intelligibility', 'naturalness', 'characterFit'}
VOICES = {'bright', 'soft', 'cool'}


def validate_ratings(data: dict, manifest: dict) -> dict:
    if not isinstance(data, dict) or data.get('schemaVersion') != 1 or data.get('auditionId') != 'reference-v1':
        raise ValueError('Unknown audition')
    if data.get('provisional') is not True or data.get('liveDefaultAccepted') is not False:
        raise ValueError('Reference listening cannot accept a live default')
    if data.get('preference') not in (None, 'none', *VOICES):
        raise ValueError('Unknown preference')
    notes = data.get('notes')
    if not isinstance(notes, str) or len(notes) > 2000:
        raise ValueError('Notes must be at most 2000 characters')
    ratings = data.get('ratings', {})
    if not isinstance(ratings, dict) or set(ratings) != VOICES:
        raise ValueError('Expected the three candidates')
    for voice in VOICES:
        if not isinstance(ratings[voice], dict) or set(ratings[voice]) != SCORES:
            raise ValueError('Unexpected score fields')
        for score in ratings[voice].values():
            if score is not None and (type(score) is not int or not 1 <= score <= 5):
                raise ValueError('Scores must be null or integers 1 through 5')
    hashes = {item['id']: item['sha256'] for item in manifest['items']}
    if data.get('audioHashes') != hashes:
        raise ValueError('These notes refer to different audio')
    starts = data.get('playbackStarts', {})
    if not isinstance(starts, dict) or set(starts) != set(hashes):
        raise ValueError('Expected playback metadata')
    if any(type(count) is not int or not 0 <= count <= 1000000 for count in starts.values()):
        raise ValueError('Invalid playback counts')
    return {'schemaVersion': 1, 'auditionId': 'reference-v1', 'provisional': True,
            'speechSource': 'Public-domain LJ Speech reference, not the user',
            'trainedEnglishControlIncluded': False, 'liveDefaultAccepted': False,
            'savedAt': datetime.now(timezone.utc).isoformat(), 'preference': data['preference'],
            'notes': notes, 'ratings': ratings, 'playbackStarts': starts, 'audioHashes': hashes}


def make_server(port: int, data_dir: Path = DEFAULT_DATA) -> ThreadingHTTPServer:
    manifest = json.loads((data_dir / 'manifest.json').read_text(encoding='utf-8'))
    audio_files = {}
    for item in manifest['items']:
        file = (ROOT / item['path']).resolve()
        file.relative_to(DEFAULT_DATA)
        if hashlib.sha256(file.read_bytes()).hexdigest() != item['sha256']:
            raise ValueError('Audition audio hash mismatch; regenerate the reference pack')
        audio_files[item['url']] = file
    permitted_hosts = {f'127.0.0.1:{port}', f'localhost:{port}'}
    permitted_origins = {f'http://{host}' for host in permitted_hosts}
    ratings_file = data_dir / 'ratings.json'
    save_lock = threading.Lock()

    class Handler(BaseHTTPRequestHandler):
        server_version = 'VModelAudition/1'

        def send_headers(self, code: int, content_type: str, length: int, extra: dict | None = None) -> None:
            self.send_response(code)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', str(length))
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('Referrer-Policy', 'no-referrer')
            self.send_header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
            self.send_header('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; media-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'")
            for key, value in (extra or {}).items():
                self.send_header(key, value)
            self.end_headers()

        def json_response(self, code: int, value: dict, head: bool = False) -> None:
            body = json.dumps(value, ensure_ascii=False).encode('utf-8')
            self.send_headers(code, 'application/json; charset=utf-8', len(body))
            if not head:
                self.wfile.write(body)

        def allowed_host(self) -> bool:
            return self.headers.get('Host', '').lower() in permitted_hosts

        def do_HEAD(self) -> None:
            self.get(True)

        def do_GET(self) -> None:
            self.get(False)

        def get(self, head: bool) -> None:
            if not self.allowed_host():
                return self.json_response(421, {'error': 'Loopback host required'}, head)
            path = urlsplit(self.path).path
            if path == '/manifest.json':
                return self.json_response(200, manifest, head)
            if path == '/health':
                return self.json_response(200, {'status': 'ready', 'audition': manifest['id'], 'microphone': False}, head)
            if path == '/ratings':
                if ratings_file.exists():
                    return self.json_response(200, json.loads(ratings_file.read_text(encoding='utf-8')), head)
                return self.json_response(200, {}, head)
            static = {'/': (UI / 'index.html', 'text/html; charset=utf-8'),
                      '/app.js': (UI / 'app.js', 'text/javascript; charset=utf-8'),
                      '/style.css': (UI / 'style.css', 'text/css; charset=utf-8')}
            if path in audio_files:
                file, content_type = audio_files[path], 'audio/wav'
            elif path in static:
                file, content_type = static[path]
            else:
                return self.json_response(404, {'error': 'Not found'}, head)
            total = file.stat().st_size
            start, end = 0, total - 1
            code = 200
            extra = {'Accept-Ranges': 'bytes'}
            requested = self.headers.get('Range')
            if requested:
                match = re.fullmatch(r'bytes=(\d*)-(\d*)', requested)
                if not match or not any(match.groups()):
                    self.send_headers(416, content_type, 0, {'Content-Range': f'bytes */{total}'})
                    return
                first, last = match.groups()
                if first:
                    start = int(first)
                    end = min(total - 1, int(last)) if last else total - 1
                else:
                    start = max(0, total - int(last))
                if start > end or start >= total:
                    self.send_headers(416, content_type, 0, {'Content-Range': f'bytes */{total}'})
                    return
                code = 206
                extra['Content-Range'] = f'bytes {start}-{end}/{total}'
            self.send_headers(code, content_type, end - start + 1, extra)
            if not head:
                with file.open('rb') as stream:
                    stream.seek(start)
                    self.wfile.write(stream.read(end - start + 1))

        def do_POST(self) -> None:
            if not self.allowed_host() or self.headers.get('Origin') not in permitted_origins:
                return self.json_response(403, {'error': 'Same-origin loopback request required'})
            if urlsplit(self.path).path != '/ratings':
                return self.json_response(404, {'error': 'Not found'})
            try:
                length = int(self.headers.get('Content-Length', '0'))
                if not 0 < length <= 16384 or self.headers.get('Content-Type') != 'application/json':
                    raise ValueError('JSON body must be at most 16 KiB')
                result = validate_ratings(json.loads(self.rfile.read(length)), manifest)
            except (ValueError, TypeError, KeyError):
                return self.json_response(400, {'error': 'Invalid reference notes'})
            # Save to one predetermined private file, never a client-supplied path.
            with save_lock:
                temporary = ratings_file.with_suffix('.pending.json')
                temporary.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding='utf-8')
                temporary.replace(ratings_file)
            self.json_response(200, {'saved': True, 'provisional': True})

        def log_message(self, *_args):
            pass

    return ThreadingHTTPServer(('127.0.0.1', port), Handler)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=5081)
    args = parser.parse_args()
    if not 1024 <= args.port <= 65535:
        parser.error('port must be between 1024 and 65535')
    server = make_server(args.port)
    print(f'Voice comparison ready: http://127.0.0.1:{args.port}/ (no microphone access)', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
