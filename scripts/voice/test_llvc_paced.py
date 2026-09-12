"""Fault/bounds/EOF tests for the isolated paced file pipeline. No Torch."""
from array import array
from pathlib import Path
import sys
import unittest
import queue

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'scripts/voice'))
sys.path.insert(0,str(Path(__file__).parent))
from llvc_paced import IngressFIFO,InputOrder,InputPacket,OutputClock,OutputPacket,OutputSlot,ModeledSink,PCMAssembler,run_paced


def output(sequence,ready):return OutputPacket(sequence,[0.0]*6400,6400,ready)


class PacingTests(unittest.TestCase):
    def test_ingress_four_packet_cap_retains_peak_and_never_overwrites(self):
        fifo=IngressFIFO()
        for sequence in range(4):fifo.put_nowait(sequence)
        with self.assertRaises(queue.Full):fifo.put_nowait(99)
        self.assertEqual([fifo.get_nowait() for _ in range(4)],[0,1,2,3])
        self.assertEqual(fifo.qsize(),0);self.assertEqual(fifo.high_water,4)
        fifo.put_nowait(4);self.assertEqual(fifo.high_water,4)
        self.assertEqual(fifo.get_nowait(),4)

    def test_input_gap_duplicate_epoch_and_oversize_poison(self):
        for bad in [InputPacket(2,256,[0.0]*256,0,0),InputPacket(0,256,[0.0]*256,0,0),
                    InputPacket(1,255,[0.0]*256,0,0),InputPacket(1,256,[0.0]*256,0,0,epoch=2),
                    InputPacket(1,256,[0.0]*257,0,0)]:
            order=InputOrder();order.accept(InputPacket(0,0,[0.0]*256,0,0))
            with self.assertRaises(ValueError):order.accept(bad)
            with self.assertRaises(ValueError):order.accept(InputPacket(1,256,[0.0]*256,0,0))
            self.assertEqual(order.sequence,1)

    def test_publisher_fixed_reserve_never_slides_to_hide_late_output(self):
        clock=OutputClock();first=output(0,1.0)
        self.assertAlmostEqual(clock.due(first),1.016);clock.accept(first)
        second=output(1,1.170)
        self.assertAlmostEqual(clock.due(second),1.176);clock.accept(second)
        with self.assertRaises(TimeoutError):clock.due(output(2,1.337))
        with self.assertRaises(ValueError):clock.due(output(2,1.330))
        gap=OutputClock();gap.accept(output(0,1))
        with self.assertRaises(ValueError):gap.due(output(2,1.1))
        with self.assertRaises(ValueError):gap.due(output(1,1.1))

    def test_output_overflow_preserves_pending_packet_and_identity(self):
        slot=OutputSlot();first=output(0,1);slot.put(first)
        with self.assertRaises(BufferError):slot.put(output(1,1.1))
        self.assertIs(slot.peek(timeout=0),first)
        with self.assertRaises(ValueError):slot.take(output(0,1))
        self.assertIs(slot.take(first),first);self.assertIsNone(slot.peek(timeout=0))
        slot.put(output(1,1.2));slot.clear();self.assertIsNone(slot.peek(timeout=0))
        self.assertEqual(slot.high_water,1)

    def test_sink_models_literal_prefix_and_rejects_burst_or_late_arrival(self):
        sink=ModeledSink();sink.receive(1.0)
        self.assertAlmostEqual(sink.first_start,1.04);self.assertAlmostEqual(sink.high_water_ms,200)
        sink.receive(1.160);sink.receive(1.320)
        self.assertLessEqual(sink.high_water_ms,200.00001)
        with self.assertRaises(TimeoutError):sink.receive(1.521)
        burst=ModeledSink();burst.receive(1.0)
        with self.assertRaises(BufferError):burst.receive(1.100)

    def test_causal_resampler_eof_valid_counts_and_stop_discards_history(self):
        import numpy as np
        from scipy.signal import upfirdn
        from natural_pcm import NaturalPCM
        for count in [1,2559,2560,2561,5121]:
            source=np.sin(np.arange(count,dtype=np.float32)*.079)*.2
            packer=PCMAssembler();packets=[]
            for start in range(0,count,832):packets.extend(packer.push(source[start:start+832],now=lambda:1))
            packets.extend(packer.finish(now=lambda:1))
            actual=np.concatenate([packet.samples[:packet.valid_samples] for packet in packets])
            expected=upfirdn(NaturalPCM().taps,source,up=5,down=2)[:(count*5+1)//2]
            self.assertEqual(len(actual),(count*5+1)//2)
            self.assertEqual(sum(packet.valid_samples for packet in packets),packer.output_valid)
            self.assertLessEqual(float(np.max(np.abs(actual-expected))),1e-7)
            self.assertTrue(all(len(packet.samples)==6400 for packet in packets))
            with self.assertRaises(ValueError):packer.push([0])
            packer.reset();packer.push(np.ones(832,dtype=np.float32));packer.reset()
            silence=packer.push(np.zeros(2560,dtype=np.float32))
            self.assertTrue(np.all(silence[0].samples==0));self.assertEqual(silence[0].sequence,0)

    def test_worker_failure_ends_epoch_without_eof_or_raw_fallback(self):
        import numpy as np
        class BrokenAdapter:
            def __init__(self):self.resets=0;self.finishes=0
            def reset(self):self.resets+=1
            def push(self,values):raise RuntimeError('Injected neural failure')
            def finish(self):self.finishes+=1;return array('f',[.9]*256)
        adapter=BrokenAdapter();snapshots=[]
        result=run_paced(np.ones(256,dtype=np.float32)*.5,adapter,
                         on_ready=lambda:snapshots.append('before'),on_finished=lambda:snapshots.append('after'))
        self.assertFalse(result['completedWithoutLoss']);self.assertFalse(result['liveAccepted'])
        self.assertEqual(result['failure']['stage'],'inference-or-packetizer')
        self.assertEqual(result['failure']['message'],'Injected neural failure')
        self.assertEqual(adapter.finishes,0);self.assertEqual(adapter.resets,2)
        self.assertEqual(len(result['published40k']),0);self.assertEqual(result['outputRecords'],[])
        self.assertTrue(result['resetAfterTermination']);self.assertEqual(snapshots,['before','after'])


if __name__=='__main__':unittest.main()
