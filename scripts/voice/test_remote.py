import json
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
import sys
import threading
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parent))
from check_remote import inspect

class RemoteTests(unittest.TestCase):
    def test_credentials_in_url_rejected_before_request(self):
        for url in ['http://user:secret@127.0.0.1:9','http://127.0.0.1:9?key=secret','file:///etc/passwd','']:
            with self.assertRaises(ValueError):inspect(url)
    def test_explicit_mock_models_do_not_claim_rvc_and_no_redirect(self):
        requests=[]
        class Handler(BaseHTTPRequestHandler):
            def log_message(self,*_):pass
            def do_GET(self):
                requests.append(self.path)
                if self.path=='/v1/models':
                    self.send_response(200);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(b'{"data":[{"id":"mock-text-model"}]}')
                else:
                    self.send_response(302);self.send_header('Location','http://127.0.0.1:9/never-follow');self.end_headers()
        server=ThreadingHTTPServer(('127.0.0.1',0),Handler);thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        try:report=inspect(f'http://127.0.0.1:{server.server_port}/v1',api_key='mock-secret')
        finally:server.shutdown();server.server_close();thread.join()
        self.assertEqual(requests,['/v1/models','/openapi.json']);self.assertEqual(report['requests'][1]['status'],302)
        self.assertEqual(report['requests'][0]['modelIds'],['mock-text-model']);self.assertIn('Unverified',report['rvcCompatibility'])
        self.assertNotIn('mock-secret',json.dumps(report));self.assertFalse(report['audioUploaded'])

if __name__=='__main__':unittest.main(verbosity=2)
