"""Explicit natural speech path: stateful 16 kHz to 40 kHz PCM, no model."""
import numpy as np
from scipy.signal import firwin,upfirdn

class NaturalPCM:
    def __init__(self):
        # Same rational polyphase family as scipy.signal.resample_poly. Keep the
        # 20-input-sample history; the causal FIR contributes 0.625 ms delay.
        self.taps=firwin(101,1/5,window=('kaiser',5.0)).astype(np.float32)*5
        self.reset()
    def reset(self):
        self.history=np.zeros(20,dtype=np.float32)
    def process(self,pcm):
        pcm=np.asarray(pcm,dtype=np.float32)
        if pcm.shape!=(2560,) or not np.isfinite(pcm).all():raise ValueError('Invalid natural input block')
        combined=np.concatenate([self.history,pcm])
        result=upfirdn(self.taps,combined,up=5,down=2)[50:6450].astype(np.float32)
        self.history=combined[-20:].copy()
        if result.shape!=(6400,) or not np.isfinite(result).all():raise ValueError('Invalid natural output block')
        return result
