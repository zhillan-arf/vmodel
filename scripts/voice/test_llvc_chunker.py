"""LLVC framing regression tests. No Torch or neural inference."""
from array import array
import math
import unittest
from llvc_stream_adapter import LLVCChunker


class ChunkerTests(unittest.TestCase):
    def test_exact_shift_context_and_eof_for_boundary_lengths(self):
        for length in [0,1,15,16,17,831,832,833,1664,2560,4992]:
            source=array('f',((i%127)/127 for i in range(length)))
            for packet in [128,256,832,2560]:
                calls=[]
                def infer(frame):
                    calls.append(array('f',frame))
                    return frame[32:]
                stream=LLVCChunker(infer);output=array('f')
                for i in range(0,length,packet):output.extend(stream.push(source[i:i+packet]))
                output.extend(stream.finish())
                if not length:self.assertFalse(calls);continue
                padded=math.ceil(length/832)*832
                original=source+array('f',[0.0])*(padded-length)
                shifted=original[16:]+array('f',[0.0])*16
                expected=shifted[:length]
                self.assertEqual(output.tobytes(),expected.tobytes())
                self.assertEqual(len(calls),padded//832)
                for i,frame in enumerate(calls):
                    front=array('f',[0.0])*32 if i==0 else shifted[i*832-32:i*832]
                    self.assertEqual(frame.tobytes(),(front+shifted[i*832:(i+1)*832]).tobytes())
                self.assertEqual(stream.output_samples,length)

    def test_reset_discards_partial_input_and_failure_requires_reset(self):
        stream=LLVCChunker(lambda frame:frame[32:]);stream.push([.5]*255);stream.reset()
        output=stream.push([0.0]*256)+stream.finish()
        self.assertTrue(all(x==0 for x in output));self.assertEqual(len(output),256)
        with self.assertRaises(ValueError):stream.push([0.0])
        stream.reset()
        with self.assertRaises(ValueError):stream.push([float('nan')])
        with self.assertRaises(ValueError):stream.push([0.0])
        stream.reset();self.assertEqual(len(stream.push([0.0]*256)),0)

    def test_160ms_packet_does_not_produce_one_output_packet_initially(self):
        stream=LLVCChunker(lambda frame:frame[32:])
        self.assertEqual(len(stream.push([0.0]*2560)),2496)


if __name__=='__main__':unittest.main()
