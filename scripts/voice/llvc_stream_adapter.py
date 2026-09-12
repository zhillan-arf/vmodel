"""Experimental LLVC streaming core. No device, network or served UI.

Use only in an isolated owned worker. Torch is imported by load(), never by
module import. The caller owns thread settings, warmup, queues, timing and epoch.
"""
from __future__ import annotations
from array import array
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import sys
import time

ROOT=Path(__file__).resolve().parents[2]
BASE=ROOT/'.tools/voice/llvc'


class LLVCChunker:
    """Online form of the pinned infer_stream global shift/context/EOF rules."""
    L=16
    C=832

    def __init__(self,infer):
        self.infer=infer
        self.reset()

    def reset(self):
        self.front=array('f',[0.0])*(2*self.L)
        self.pending=array('f')
        self.skip=self.L
        self.input_samples=0
        self.output_samples=0
        self.ended=False
        self.failed=False

    def _feed(self,values):
        skip=min(self.skip,len(values));self.skip-=skip
        self.pending.extend(values[skip:])
        output=array('f')
        while len(self.pending)>=self.C:
            chunk=self.pending[:self.C]
            del self.pending[:self.C]
            frame=self.front+chunk
            try:
                converted=array('f',self.infer(frame))
                if len(converted)!=self.C or any(not math.isfinite(x) for x in converted):
                    raise ValueError('Invalid LLVC neural output')
            except Exception:
                self.failed=True
                raise
            self.front=chunk[-2*self.L:]
            output.extend(converted)
        return output

    def push(self,values):
        if self.ended or self.failed:raise ValueError('LLVC stream must reset before further input')
        try:values=array('f',values)
        except (TypeError,ValueError,OverflowError):
            self.failed=True
            raise ValueError('Invalid LLVC input values') from None
        if not 0<len(values)<=2560 or any(not math.isfinite(x) or abs(x)>2 for x in values):
            self.failed=True
            raise ValueError('Invalid or oversized LLVC input packet')
        self.input_samples+=len(values)
        output=self._feed(values)
        self.output_samples+=len(output)
        return output

    def finish(self):
        """File EOF only. User Stop/loss must discard, never call this method."""
        if self.ended or self.failed:raise ValueError('LLVC stream already ended or failed')
        self.ended=True
        if not self.input_samples:return array('f')
        padded=((self.input_samples+self.C-1)//self.C)*self.C
        # Pad original x to M, then supply the L trailing zeros needed by the
        # upstream global x[L:] shift. Initial skip may still be pending.
        tail=self._feed(array('f',[0.0])*(padded+self.L-self.input_samples))
        valid=self.input_samples-self.output_samples
        if not 0<=valid<=len(tail):raise ValueError('LLVC EOF accounting mismatch')
        result=tail[:valid]
        self.output_samples+=len(result)
        if self.output_samples!=self.input_samples or self.pending or self.skip:
            raise ValueError('LLVC EOF did not exactly cover the original input')
        return result


class LLVCStreamAdapter:
    """One pinned eager CPU model plus its four persistent state buffers."""
    def __init__(self,on_timing=None):
        self.model=None
        self.on_timing=on_timing

    def load(self):
        manifest=json.loads((BASE/'manifest.json').read_text(encoding='utf-8'))
        if manifest['sourceRevision']!='1627c5d358cf9bb2b92b0ccc513d8b36807c923d' or manifest['modelRevision']!='ebfe8c0fdeb974a7eeb463b3abbc8ce42a0e3851':
            raise ValueError('Unsupported LLVC source/checkpoint revision')
        for item in manifest['artifacts']:
            file=(ROOT/item['path']).resolve();file.relative_to(ROOT)
            if hashlib.sha256(file.read_bytes()).hexdigest()!=item['sha256']:
                raise ValueError('Changed provisioned LLVC artifact: '+file.name)
        # No Torch import occurs until the caller deliberately invokes load().
        import numpy as np
        import torch
        if torch.get_num_threads()!=1 or torch.get_num_interop_threads()!=1:
            raise ValueError('The reviewed LLVC candidate requires an isolated one-thread/one-interop worker')
        self.np,self.torch=np,torch
        runtime=BASE/'runtime'
        for name in ('cached_convnet','llvc_position'):
            if name in sys.modules and Path(sys.modules[name].__file__).resolve()!=(runtime/(name+'.py')).resolve():
                raise ValueError('LLVC requires an isolated worker module namespace')
        previous=list(sys.path)
        try:
            sys.path.insert(0,str(runtime))
            spec=importlib.util.spec_from_file_location('_vmodel_llvc_stream_model',runtime/'model.py')
            module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
        finally:sys.path[:]=previous
        config=json.loads((BASE/'source/experiments/llvc/config.json').read_text(encoding='utf-8'))
        if config['data']['sr']!=16000:raise ValueError('Unexpected LLVC source rate')
        self.model=module.Net(**config['model_params'])
        checkpoint=torch.load(ROOT/manifest['model'],weights_only=True,mmap=True,map_location='cpu')
        self.model.load_state_dict(checkpoint['model'],strict=True)
        self.model.eval()
        if self.model.L!=16 or self.model.dec_chunk_size!=13 or not self.model.lookahead:
            raise ValueError('Unsupported LLVC streaming shape/lookahead')
        if any(not torch.isfinite(parameter).all().item() for parameter in self.model.parameters()):
            raise ValueError('Nonfinite LLVC model weights')
        self.chunker=LLVCChunker(self._infer)
        self.reset()

    def reset(self):
        if self.model is None:raise ValueError('LLVC model is not loaded')
        with self.torch.inference_mode():
            self.enc,self.dec,self.out=self.model.init_buffers(1,self.torch.device('cpu'))
            self.pre=self.model.convnet_pre.init_ctx_buf(1,self.torch.device('cpu'))
        self.chunker.reset()

    def _infer(self,frame):
        tensor=self.torch.from_numpy(self.np.frombuffer(frame,dtype=self.np.float32).copy()).reshape(1,1,-1)
        if tuple(tensor.shape)!=(1,1,864):raise ValueError('Wrong LLVC model frame')
        started=time.perf_counter_ns();cpu_started=time.process_time_ns()
        with self.torch.inference_mode():
            audio,self.enc,self.dec,self.out,self.pre=self.model(tensor,self.enc,self.dec,self.out,self.pre,pad=False)
        cpu_ns=time.process_time_ns()-cpu_started;wall_ns=time.perf_counter_ns()-started
        result=audio.detach().cpu().numpy().reshape(-1).copy()
        if self.on_timing:self.on_timing({'wallMs':wall_ns/1e6,'processCpuMs':cpu_ns/1e6})
        return result

    def push(self,values):
        return self.chunker.push(values)

    def finish(self):
        return self.chunker.finish()
