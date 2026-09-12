"""Read bounded WebP container timing for manifests; FFprobe may omit duration."""
from pathlib import Path

def webp_info(path):
    data=Path(path).read_bytes()
    if len(data)<12 or data[:4]!=b'RIFF' or data[8:12]!=b'WEBP' or int.from_bytes(data[4:8],'little')+8!=len(data):
        raise ValueError('Invalid WebP RIFF bounds')
    offset=12;frames=[];result={'alpha':False,'animated':False,'loopCount':None}
    while offset<len(data):
        if offset+8>len(data):raise ValueError('Truncated WebP chunk header')
        tag=data[offset:offset+4];size=int.from_bytes(data[offset+4:offset+8],'little');start=offset+8;end=start+size
        if end>len(data):raise ValueError('WebP chunk exceeds file')
        chunk=data[start:end]
        if tag==b'VP8X':
            if size!=10:raise ValueError('Bad VP8X')
            result.update(alpha=bool(chunk[0]&16),animated=bool(chunk[0]&2),width=int.from_bytes(chunk[4:7],'little')+1,height=int.from_bytes(chunk[7:10],'little')+1)
        elif tag==b'ANIM':
            if size!=6:raise ValueError('Bad ANIM')
            result['loopCount']=int.from_bytes(chunk[4:6],'little')
        elif tag==b'ANMF':
            if size<16:raise ValueError('Bad ANMF')
            frames.append({'x':2*int.from_bytes(chunk[0:3],'little'),'y':2*int.from_bytes(chunk[3:6],'little'),'width':int.from_bytes(chunk[6:9],'little')+1,'height':int.from_bytes(chunk[9:12],'little')+1,'durationMs':int.from_bytes(chunk[12:15],'little'),'flags':chunk[15]})
        offset=end+(size&1)
    if offset!=len(data):raise ValueError('WebP padding exceeds file')
    result.update(frameCount=len(frames),durationMs=sum(f['durationMs'] for f in frames),frames=frames)
    return result
