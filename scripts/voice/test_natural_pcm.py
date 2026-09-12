import unittest
import numpy as np
from scipy.signal import upfirdn
from natural_pcm import NaturalPCM

class NaturalPCMTests(unittest.TestCase):
    def test_continuous_tone_level_length_and_chunk_boundaries(self):
        source=(.2*np.sin(2*np.pi*1000*np.arange(2560*3)/16000)).astype(np.float32)
        converter=NaturalPCM()
        streamed=np.concatenate([converter.process(source[i:i+2560]) for i in range(0,len(source),2560)])
        whole=upfirdn(converter.taps,source,up=5,down=2)[:len(streamed)]
        np.testing.assert_allclose(streamed,whole,atol=1e-7)
        self.assertEqual(len(streamed),19200)
        self.assertAlmostEqual(float(np.sqrt(np.mean(streamed[100:]**2))),.2/np.sqrt(2),places=3)
    def test_reset_removes_history_and_invalid_pcm_rejected(self):
        converter=NaturalPCM();converter.process(np.ones(2560,dtype=np.float32));converter.reset()
        self.assertTrue(np.all(converter.process(np.zeros(2560,dtype=np.float32))==0))
        for value in [np.ones(10),np.full(2560,np.nan),np.full(2560,np.inf)]:
            with self.assertRaises(ValueError):converter.process(value)

if __name__=='__main__':unittest.main(verbosity=2)
