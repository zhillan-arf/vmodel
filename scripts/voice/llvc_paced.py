"""Prepared bounded file pipeline; no network, device or Torch imports."""
from __future__ import annotations
from array import array
from dataclasses import dataclass
import math
import queue
import threading
import time

INPUT_SAMPLES=256
MODEL_SAMPLES=832
OUTPUT_SAMPLES=6400
INPUT_RATE=16000
OUTPUT_RATE=40000
RESERVE_SECONDS=.016


@dataclass
class InputPacket:
    sequence:int
    offset:int
    samples:object
    scheduled:float
    arrived:float
    epoch:int=1


@dataclass
class OutputPacket:
    sequence:int
    samples:object
    valid_samples:int
    ready:float


class IngressFIFO(queue.Queue):
    """Queue calls _put while holding its mutex; consumers cannot hide a peak."""
    def __init__(self):
        super().__init__(maxsize=4)
        self.high_water=0
    def _put(self,item):
        super()._put(item)
        self.high_water=max(self.high_water,self._qsize())


class InputOrder:
    def __init__(self):self.sequence=0;self.offset=0;self.failed=False
    def accept(self,packet):
        if self.failed:raise ValueError('Input epoch is already failed')
        if packet.epoch!=1 or packet.sequence!=self.sequence or packet.offset!=self.offset or not 0<len(packet.samples)<=INPUT_SAMPLES:
            self.failed=True;raise ValueError('Input sequence/epoch/length gap')
        self.sequence+=1;self.offset+=len(packet.samples)


class OutputClock:
    def __init__(self):self.first_due=None;self.next_sequence=0;self.failed=False
    def due(self,packet):
        if self.failed:raise ValueError('Publisher epoch is already failed')
        if packet.sequence!=self.next_sequence:
            self.failed=True;raise ValueError('Output sequence gap')
        if self.first_due is None:self.first_due=packet.ready+RESERVE_SECONDS
        deadline=self.first_due+packet.sequence*.160
        if packet.ready>deadline:
            self.failed=True;raise TimeoutError('Converted packet missed its fixed publication deadline')
        return deadline
    def accept(self,packet):
        self.due(packet);self.next_sequence+=1


class ModeledSink:
    """Ideal continuous sample clock mirroring the existing prefix/cap only."""
    def __init__(self):self.first_start=None;self.tail=None;self.high_water_ms=0.0
    def receive(self,arrived):
        if self.tail is None:
            self.first_start=arrived+.040;self.tail=self.first_start+.160;queued=.200
        else:
            if arrived-self.tail>1e-9:raise TimeoutError('Modeled sink underflow after publisher jitter')
            queued=max(0,self.tail-arrived)+.160
            if queued-.240>1e-9:raise BufferError('Modeled sink exceeded existing240ms cap')
            self.tail+=.160
        self.high_water_ms=max(self.high_water_ms,queued*1000)


class OutputSlot:
    def __init__(self):self.condition=threading.Condition();self.packet=None;self.high_water=0
    def put(self,packet):
        with self.condition:
            if self.packet is not None:raise BufferError('One-slot output publisher overflow')
            self.packet=packet;self.high_water=1;self.condition.notify_all()
    def peek(self,timeout=.020):
        with self.condition:
            if self.packet is None:self.condition.wait(timeout)
            return self.packet
    def take(self,packet):
        with self.condition:
            if self.packet is not packet:raise ValueError('Publisher slot identity changed')
            self.packet=None;self.condition.notify_all();return packet
    def clear(self):
        with self.condition:self.packet=None;self.condition.notify_all()


class PCMAssembler:
    """Converted16k only -> exact160ms40k packets using the existing FIR."""
    def __init__(self):
        import numpy as np
        from natural_pcm import NaturalPCM
        self.np=np;self.resampler=NaturalPCM();self.reset()
    def reset(self):
        self.pending=array('f');self.sequence=0;self.input_samples=0;self.output_valid=0;self.ended=False
        self.resampler.reset()
    def push(self,values,now=time.perf_counter):
        if self.ended:raise ValueError('Converted packetizer already ended')
        values=array('f',values)
        if any(not math.isfinite(x) for x in values):raise ValueError('Nonfinite converted PCM')
        self.input_samples+=len(values);self.pending.extend(values);packets=[]
        while len(self.pending)>=2560:
            block=self.np.frombuffer(self.pending[:2560],dtype=self.np.float32).copy();del self.pending[:2560]
            pcm=self.resampler.process(block)
            packets.append(OutputPacket(self.sequence,pcm,OUTPUT_SAMPLES,now()));self.sequence+=1;self.output_valid+=OUTPUT_SAMPLES
        return packets
    def finish(self,now=time.perf_counter):
        if self.ended:raise ValueError('Converted packetizer already ended')
        self.ended=True
        if not self.pending:return []
        valid=(len(self.pending)*5+1)//2
        block=self.np.zeros(2560,dtype=self.np.float32);block[:len(self.pending)]=self.np.frombuffer(self.pending,dtype=self.np.float32)
        pcm=self.resampler.process(block);self.pending=array('f')
        packet=OutputPacket(self.sequence,pcm,valid,now());self.sequence+=1;self.output_valid+=valid
        return [packet]


def run_paced(source,adapter,on_ready=lambda:None,on_finished=lambda:None,on_thread_start=lambda name:None):
    """One fixed256/832/6400 trial. Failure stops; no catch-up/drop/fallback."""
    import numpy as np
    source=np.asarray(source,dtype=np.float32)
    if source.ndim!=1 or not len(source) or not np.isfinite(source).all():raise ValueError('Invalid paced source')
    ingress=IngressFIFO();slot=OutputSlot();stop=threading.Event();ingress_done=threading.Event();worker_done=threading.Event()
    lock=threading.Lock();failure=[];arrival_records=[];work_records=[];publication_records=[]
    generated=array('f');published=array('f');order=InputOrder();clock=OutputClock();sink=ModeledSink();packer=PCMAssembler()
    sample_start=time.perf_counter()+.250
    expected_outputs=math.ceil(len(source)/2560)
    adapter.reset()
    def fail(stage,error):
        with lock:
            if not failure:failure.append({'stage':stage,'type':type(error).__name__,'message':str(error),'atMs':(time.perf_counter()-sample_start)*1000})
        stop.set()
        with slot.condition:slot.condition.notify_all()
    def wait_until(deadline):return not stop.wait(max(0,deadline-time.perf_counter()))
    def acquire():
        try:
            for sequence,offset in enumerate(range(0,len(source),INPUT_SAMPLES)):
                samples=source[offset:offset+INPUT_SAMPLES].copy();scheduled=sample_start+(offset+len(samples))/INPUT_RATE
                if not wait_until(scheduled):return
                arrived=time.perf_counter();lateness=arrived-scheduled
                arrival_records.append({'sequence':sequence,'offset':offset,'samples':len(samples),'scheduledMs':(scheduled-sample_start)*1000,'arrivedMs':(arrived-sample_start)*1000,'lateMs':lateness*1000})
                if lateness>.016:raise TimeoutError('Input acquisition woke more than one16ms packet late')
                ingress.put_nowait(InputPacket(sequence,offset,samples,scheduled,arrived))
            ingress_done.set()
        except Exception as error:fail('ingress',error)
    def convert():
        try:
            while not stop.is_set():
                if ingress_done.is_set() and ingress.empty():break
                try:packet=ingress.get(timeout=.020)
                except queue.Empty:continue
                order.accept(packet);began=time.perf_counter()
                if began-packet.arrived>.064:raise TimeoutError('Input packet exceeded its64ms bounded queue age')
                converted=adapter.push(packet.samples)
                packets=packer.push(converted)
                generated.extend(converted)
                work_records.append({'sequence':packet.sequence,'queueWaitMs':(began-packet.arrived)*1000,'inputToWorkerReturnMs':(time.perf_counter()-packet.arrived)*1000,'returned16kSamples':len(converted)})
                for output in packets:slot.put(output)
            if stop.is_set():return  # Stop/loss is deliberately not file EOF.
            if order.offset!=len(source):raise ValueError('EOF input count does not match the source')
            # EOF has no further physical arrivals. Drain the existing one-slot
            # packet before generating its short final successor, not into a
            # hidden second complete-output buffer.
            while slot.peek(timeout=0) is not None and not stop.is_set():
                with slot.condition:slot.condition.wait(timeout=.001)
            if stop.is_set():return
            tail=adapter.finish();packets=packer.push(tail);generated.extend(tail)
            for output in packets:slot.put(output)
            # Some file lengths produce a full packet plus a short remainder.
            # Keep only one complete unsent packet even at finite-file EOF.
            while slot.peek(timeout=0) is not None and not stop.is_set():
                with slot.condition:slot.condition.wait(timeout=.001)
            if stop.is_set():return
            for output in packer.finish():slot.put(output)
            if len(generated)!=len(source) or packer.output_valid!=(len(source)*5+1)//2:raise ValueError('EOF converted sample count differs')
            worker_done.set()
        except Exception as error:fail('inference-or-packetizer',error)
    def publish():
        try:
            for sequence in range(expected_outputs):
                packet=None
                while packet is None and not stop.is_set():
                    packet=slot.peek(timeout=0)
                    if packet is not None:break
                    if clock.first_due is not None and time.perf_counter()>clock.first_due+sequence*.160:
                        raise TimeoutError('No complete converted packet at the fixed publication deadline')
                    packet=slot.peek(timeout=.001 if clock.first_due is not None else .020)
                    if packet is None and worker_done.is_set():raise ValueError('EOF reached before all output packets')
                if stop.is_set():return
                due=clock.due(packet)
                if not wait_until(due):return
                now=time.perf_counter();slot.take(packet);clock.accept(packet);sink.receive(now)
                published.extend(np.asarray(packet.samples,dtype=np.float32)[:packet.valid_samples])
                publication_records.append({'sequence':sequence,'readyMs':(packet.ready-sample_start)*1000,'dueMs':(due-sample_start)*1000,
                                            'publishedMs':(now-sample_start)*1000,'readinessMarginMs':(due-packet.ready)*1000,'wakeLateMs':(now-due)*1000,'valid40kSamples':packet.valid_samples})
        except Exception as error:fail('publisher',error)
    # Keep all three threads parked during outside-timing snapshots, so actual
    # process thread count includes the pipeline without counting snapshot cost.
    start_gate=threading.Event();end_gate=threading.Event();finished=[threading.Event() for _ in range(3)]
    def held(index,target):
        on_thread_start(threading.current_thread().name)
        start_gate.wait()
        try:
            if not stop.is_set():target()
        finally:finished[index].set();end_gate.wait()
    jobs=[(acquire,'llvc-file-acquisition'),(convert,'llvc-serial-inference'),(publish,'llvc-file-publisher')]
    threads=[threading.Thread(target=held,args=(index,target),name=name,daemon=True) for index,(target,name) in enumerate(jobs)]
    for thread in threads:thread.start()
    before=after=None
    try:
        before=on_ready();sample_start=time.perf_counter()+.250
        started_wall=time.perf_counter_ns();started_cpu=time.process_time_ns();start_gate.set()
        total_limit=sample_start+len(source)/INPUT_RATE+3
        while not all(event.is_set() for event in finished) and not stop.is_set() and time.perf_counter()<total_limit:
            for event in finished:event.wait(timeout=.010)
        if not all(event.is_set() for event in finished) and not stop.is_set():fail('pipeline-watchdog',TimeoutError('Paced pipeline exceeded file duration plus3seconds'))
        if stop.is_set():
            for event in finished:event.wait(timeout=2)
        elapsed=time.perf_counter_ns()-started_wall;cpu=time.process_time_ns()-started_cpu
        if not all(event.is_set() for event in finished):raise RuntimeError('A stopped native worker did not return; parent must end the owned process')
        after=on_finished()
    finally:
        stop.set();start_gate.set();end_gate.set()
        for thread in threads:thread.join(timeout=2)
    if any(thread.is_alive() for thread in threads):raise RuntimeError('An owned pipeline thread did not close')
    slot.clear()
    while not ingress.empty():ingress.get_nowait()
    adapter.reset();packer.reset()
    expected_valid=(len(source)*5+1)//2
    complete=not failure and len(publication_records)==expected_outputs and len(generated)==len(source) and len(published)==expected_valid
    delay_ms=None if sink.first_start is None else (sink.first_start-sample_start)*1000
    signal_estimate_ms=None if delay_ms is None else delay_ms+.625
    return{'completedWithoutLoss':complete,'failure':failure[0] if failure else None,'inputPackets':len(arrival_records),'consumedInputPackets':order.sequence,'expectedInputPackets':math.ceil(len(source)/INPUT_SAMPLES),
           'inputHighWaterPackets':ingress.high_water,'outputHighWaterPackets':slot.high_water,'modeledSinkHighWaterMs':sink.high_water_ms,
           'inputRecords':arrival_records,'workerRecords':work_records,'outputRecords':publication_records,'generated16k':np.frombuffer(generated,dtype=np.float32).copy(),
           'published40k':np.frombuffer(published,dtype=np.float32).copy(),'expectedOutputPackets':expected_outputs,'expectedOutputSamples':expected_valid,
           'modeledInitialSinkDelayMs':delay_ms,'modeledSignalStartEstimateMs':signal_estimate_ms,'software350msBudgetMet':signal_estimate_ms is not None and signal_estimate_ms<=350,
           'pacedWallMs':elapsed/1e6,'pacedProcessCpuMs':cpu/1e6,'beforeProcess':before,'afterProcess':after,
           'resetAfterTermination':True,'liveAccepted':False}
