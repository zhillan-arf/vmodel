"""One local pinned eager RVC model at a time; no audio-device APIs."""
from __future__ import annotations
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]


def sha(path):
    digest = hashlib.sha256()
    with path.open('rb') as source:
        for block in iter(lambda:source.read(1048576),b''):
            digest.update(block)
    return digest.hexdigest()


class LiveRVC:
    def __init__(self):
        self.model = None
        self.encoder = None
        self.initialized = False

    def load(self, profile):
        import numpy as np
        import torch
        import onnxruntime as ort
        from safetensors.torch import load_file
        assets = json.loads((ROOT / 'config/voice/assets.json').read_text())
        indexed = {a['id']:a for a in assets['assets']}
        source = ROOT / assets['engine']['path']
        git = os.environ.get('VMODEL_VOICE_GIT') or shutil.which('git')
        if not git:
            raise RuntimeError('Git source verification unavailable')
        revision = subprocess.check_output([git,'-C',str(source),'rev-parse','HEAD'],text=True).strip()
        dirty = subprocess.check_output([git,'-C',str(source),'diff','--name-only','HEAD'],text=True).strip()
        if revision != assets['engine']['revision'] or dirty:
            raise RuntimeError('Pinned voice engine changed')
        target = indexed[profile['modelId']]
        content = indexed['contentvec-onnx']
        for asset in [target,content]:
            if sha(ROOT / asset['path']) != asset['sha256']:
                raise RuntimeError('Voice asset verification failed')
        if not self.initialized:
            torch.set_num_threads(3)
            torch.set_num_interop_threads(1)
            sys.path.insert(0,str(source / 'server'))
            self.initialized = True
        from voice_changer.common.deviceManager.DeviceManager import DeviceManager
        from voice_changer.RVC.inferencer.RVCInferencerv2Nono import RVCInferencerv2Nono
        safe_path = (ROOT / target['path']).with_suffix('.safetensors')
        checkpoint = torch.load(ROOT / target['path'],map_location='cpu',weights_only=True)
        safe = load_file(str(safe_path))
        if checkpoint['version'] != 'v2' or checkpoint['f0'] != 0 or safe.keys() != checkpoint['weight'].keys():
            raise RuntimeError('Unsupported safe voice derivative')
        if any(not torch.equal(safe[k],v) for k,v in checkpoint['weight'].items()):
            raise RuntimeError('Safe voice derivative changed')
        del checkpoint,safe
        self.model = None
        DeviceManager.get_instance().initialize(-1,True,True)
        self.model = RVCInferencerv2Nono().load_model(str(safe_path))
        self.model.use_jit = self.model.use_jit_eager
        if self.encoder is None:
            options = ort.SessionOptions()
            options.intra_op_num_threads, options.inter_op_num_threads = 3,1
            options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
            options.log_severity_level = 3
            self.encoder = ort.InferenceSession(str(ROOT / content['path']),sess_options=options,providers=['CPUExecutionProvider'])
        self.profile = profile
        self.context_frames = profile['audio']['contextMs']//10
        self.feature_count = self.context_frames+21
        self.buffer = np.zeros(self.feature_count*160,dtype=np.float32)
        self.overlap = np.zeros(1600,dtype=np.float32)
        self.fade = (np.sin(0.5*np.pi*np.linspace(0,1,1600))**2).astype(np.float32)
        self.process(np.zeros(2560,dtype=np.float32))
        self.reset()

    def reset(self):
        import numpy as np
        if self.model is not None:
            self.buffer = np.zeros(self.feature_count*160,dtype=np.float32)
            self.overlap = np.zeros(1600,dtype=np.float32)

    def process(self, audio):
        import numpy as np
        import torch
        import torch.nn.functional as F
        from scipy.signal import correlate,convolve
        if self.model is None or len(audio) != 2560 or not np.isfinite(audio).all():
            raise RuntimeError('Invalid live input/model state')
        self.buffer = np.concatenate([self.buffer[2560:],audio])
        with torch.inference_mode():
            features = self.encoder.run(['unit12'],{'audio':self.buffer.reshape(1,-1)})[0]
            features = torch.from_numpy(features)
            features = torch.cat([features,features[:,-1:]],dim=1)
            features = F.interpolate(features.permute(0,2,1),scale_factor=2,mode='nearest').permute(0,2,1)[:,:self.feature_count].contiguous()
            out = self.model.infer(features,torch.tensor([self.feature_count]),None,None,torch.tensor([0]),
                                   self.context_frames,21,21).cpu().numpy().copy()
        segment = out[:2000]
        score = correlate(segment,self.overlap,mode='valid',method='direct') / np.sqrt(convolve(segment**2,np.ones(1600,dtype=np.float32),mode='valid',method='direct')+1e-8)
        offset = int(np.argmax(score))
        out = out[offset:]
        out[:1600] = out[:1600]*self.fade + self.overlap*(1-self.fade)
        self.overlap = out[6400:8000].copy()
        result = out[:6400].copy()
        if len(result) != 6400 or not np.isfinite(result).all():
            raise RuntimeError('Invalid converted output')
        return result
