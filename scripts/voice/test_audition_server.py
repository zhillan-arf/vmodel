"""Local file/HTTP boundaries for the audition room; never save simulated user notes."""
import copy
import json
from pathlib import Path
import tempfile
import threading
import unittest
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from serve_auditions import DEFAULT_DATA, ROOT, make_server, validate_ratings


class AuditionServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifest = json.loads((DEFAULT_DATA / 'manifest.json').read_text())
        cls.note = {'schemaVersion': 1, 'auditionId': 'reference-v1', 'provisional': True,
                    'liveDefaultAccepted': False, 'preference': 'bright', 'notes': 'Automated fixture',
                    'ratings': {v: {'intelligibility': 4, 'naturalness': None, 'characterFit': None} for v in ['bright', 'soft', 'cool']},
                    'playbackStarts': {i['id']: 1 for i in cls.manifest['items']},
                    'audioHashes': {i['id']: i['sha256'] for i in cls.manifest['items']}}

    def test_reference_cannot_claim_live_acceptance_or_foreign_audio(self):
        for update in ({'liveDefaultAccepted': True}, {'provisional': False}, {'audioHashes': {}}, {'preference': 'foreign'}):
            with self.subTest(update=update), self.assertRaises(ValueError):
                validate_ratings({**self.note, **update}, self.manifest)
        invalid = copy.deepcopy(self.note)
        invalid['ratings']['bright']['intelligibility'] = True
        with self.assertRaises(ValueError):
            validate_ratings(invalid, self.manifest)

    def test_allowlisted_http_and_save_only_in_owned_temp_directory(self):
        parent = ROOT / '.cache/voice-tests'
        parent.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=parent) as temporary:
            directory = Path(temporary).resolve()
            directory.relative_to(parent.resolve())
            (directory / 'manifest.json').write_text(json.dumps(self.manifest))
            server = make_server(5082, directory)
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            base = 'http://127.0.0.1:5082'
            try:
                with urlopen(Request(base + '/audio/bright.wav', headers={'Range': 'bytes=0-43'})) as result:
                    self.assertEqual(result.status, 206)
                    self.assertEqual(len(result.read()), 44)
                    self.assertEqual(result.headers['Permissions-Policy'], 'camera=(), microphone=(), geolocation=()')
                for path, headers, code in [('/assets/voice/chihaya/V2-AISO-SYAKITTO.pth', {}, 404), ('/../config/voice/assets.json', {}, 404), ('/health', {'Host': 'outside.example:5082'}, 421)]:
                    with self.subTest(path=path), self.assertRaises(HTTPError) as error:
                        urlopen(Request(base + path, headers=headers))
                    self.assertEqual(error.exception.code, code)
                    error.exception.close()
                raw = json.dumps(self.note).encode()
                with self.assertRaises(HTTPError) as error:
                    urlopen(Request(base + '/ratings', data=raw, headers={'Content-Type': 'application/json', 'Origin': 'https://outside.example'}))
                self.assertEqual(error.exception.code, 403)
                error.exception.close()
                self.assertFalse((directory / 'ratings.json').exists())
                with urlopen(Request(base + '/ratings', data=raw, headers={'Content-Type': 'application/json', 'Origin': base})) as result:
                    self.assertTrue(json.load(result)['saved'])
                saved = json.loads((directory / 'ratings.json').read_text())
                self.assertEqual(saved['preference'], 'bright')
                self.assertFalse(saved['liveDefaultAccepted'])
                self.assertFalse(saved['trainedEnglishControlIncluded'])
                self.assertTrue(saved['provisional'])
            finally:
                server.shutdown()
                server.server_close()
                thread.join()


if __name__ == '__main__':
    unittest.main()
