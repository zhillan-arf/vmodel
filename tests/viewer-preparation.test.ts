import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const mock=vi.hoisted(()=>({parse:vi.fn(),retarget:vi.fn()}));
vi.mock('three',async importOriginal=>{
  const actual=await importOriginal<typeof import('three')>();
  class Renderer {
    domElement={style:{},addEventListener:vi.fn(),remove:vi.fn()};
    setPixelRatio=vi.fn();setSize=vi.fn();render=vi.fn();dispose=vi.fn();forceContextLoss=vi.fn();
  }
  return {...actual,WebGLRenderer:Renderer};
});
vi.mock('three/addons/loaders/GLTFLoader.js',()=>({GLTFLoader:class {
  manager={setURLModifier:vi.fn()};register=vi.fn();parseAsync=mock.parse;
}}));
vi.mock('@pixiv/three-vrm',()=>({VRMLoaderPlugin:class{},VRMUtils:{rotateVRM0:vi.fn()}}));
vi.mock('../src/retarget',()=>({Retargeter:class{constructor(){mock.retarget();}}}));
import {BoxGeometry,Mesh,MeshBasicMaterial,Texture} from 'three';
import {AvatarViewer} from '../src/viewer';
import {createCanonicalRig} from '../src/canonical-rig';
import {defaults} from '../src/types';

const viewers:AvatarViewer[]=[];
beforeEach(()=>{
  mock.parse.mockReset();mock.retarget.mockReset();
  vi.stubGlobal('devicePixelRatio',1);
  vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});
});
afterEach(()=>{for(const viewer of viewers.splice(0))viewer.dispose();vi.unstubAllGlobals();});
function viewer(){const result=new AvatarViewer({clientWidth:640,clientHeight:480,append:vi.fn()} as unknown as HTMLElement,defaults);viewers.push(result);return result;}
function candidate(){
  const rig=createCanonicalRig(),geometry=new BoxGeometry(),texture=new Texture(),material=new MeshBasicMaterial({map:texture});
  const mesh=new Mesh(geometry,material);rig.scene.add(mesh);
  const counts=[vi.spyOn(geometry,'dispose'),vi.spyOn(material,'dispose'),vi.spyOn(texture,'dispose')];
  const vrm={...rig,meta:{metaVersion:'1'},update:vi.fn(),expressionManager:{expressionMap:{}}};
  return{vrm,gltf:{scene:rig.scene,userData:{vrm}},counts};
}
const blob=()=>new Blob(['glTF']);
it('rejects a foreign candidate without taking or disposing its resources',async()=>{
  const a=viewer(),b=viewer(),first=candidate(),second=candidate();
  mock.parse.mockResolvedValueOnce(first.gltf).mockResolvedValueOnce(second.gltf);
  const prepared=await a.prepareAvatar(blob());await b.prepareAvatar(blob());
  expect(()=>b.commitAvatar(prepared)).toThrow('another viewer');b.disposePreparedAvatar(prepared);
  expect(first.counts.every(spy=>spy.mock.calls.length===0)).toBe(true);
  expect(a.commitAvatar(prepared)).toBe(first.vrm);
});
it('releases pending candidates once on supersession and viewer disposal',async()=>{
  const owner=viewer(),first=candidate(),second=candidate();
  mock.parse.mockResolvedValueOnce(first.gltf).mockResolvedValueOnce(second.gltf);
  const stale=await owner.prepareAvatar(blob()),latest=await owner.prepareAvatar(blob());
  expect(stale.disposed).toBe(true);expect(()=>owner.commitAvatar(stale)).toThrow();
  owner.disposePreparedAvatar(stale);owner.dispose();owner.dispose();owner.disposePreparedAvatar(latest);
  expect(owner.renderer.forceContextLoss).toHaveBeenCalledOnce();
  for(const spy of [...first.counts,...second.counts])expect(spy).toHaveBeenCalledOnce();
});
it.each(['decode','missing bone','bone lookup','retarget'])('preserves the active model after %s failure',async failure=>{
  const owner=viewer(),active=candidate(),replacement=candidate();mock.parse.mockResolvedValueOnce(active.gltf);
  owner.commitAvatar(await owner.prepareAvatar(blob()));
  if(failure==='decode')mock.parse.mockRejectedValueOnce(new Error('Decode fixture'));
  else{
    if(failure==='missing bone')replacement.vrm.humanoid.getNormalizedBoneNode=()=>null;
    if(failure==='bone lookup')replacement.vrm.humanoid.getNormalizedBoneNode=()=>{throw new Error('Bone fixture');};
    if(failure==='retarget')mock.retarget.mockImplementationOnce(()=>{throw new Error('Retarget fixture');});
    mock.parse.mockResolvedValueOnce(replacement.gltf);
  }
  await expect(owner.prepareAvatar(blob())).rejects.toThrow();expect(owner.vrm).toBe(active.vrm);
  owner.draw(0);expect(active.vrm.update).toHaveBeenCalled();
  for(const spy of active.counts)expect(spy).not.toHaveBeenCalled();
  if(failure!=='decode')for(const spy of replacement.counts)expect(spy).toHaveBeenCalledOnce();
});
it('disposes a decoded candidate that completes after viewer disposal',async()=>{
  const owner=viewer(),replacement=candidate();let complete!:(value:unknown)=>void;
  mock.parse.mockImplementationOnce(()=>new Promise(resolve=>{complete=resolve;}));
  const pending=owner.prepareAvatar(blob());await vi.waitFor(()=>expect(mock.parse).toHaveBeenCalled());
  owner.dispose();complete(replacement.gltf);await expect(pending).rejects.toThrow('superseded');
  for(const spy of replacement.counts)expect(spy).toHaveBeenCalledOnce();
});
it('restores the active model when commit fails',async()=>{
  const owner=viewer(),active=candidate(),replacement=candidate();
  mock.parse.mockResolvedValueOnce(active.gltf).mockResolvedValueOnce(replacement.gltf);
  owner.commitAvatar(await owner.prepareAvatar(blob()));const prepared=await owner.prepareAvatar(blob());
  const resize=vi.spyOn(owner,'resize').mockImplementationOnce(()=>{throw new Error('Resize fixture');});
  expect(()=>owner.commitAvatar(prepared)).toThrow('Resize fixture');resize.mockRestore();
  expect(owner.vrm).toBe(active.vrm);expect(owner.scene.children).toContain(active.vrm.scene);
  expect(owner.scene.children).not.toContain(replacement.vrm.scene);owner.draw(0);
  owner.disposePreparedAvatar(prepared);
  for(const spy of replacement.counts)expect(spy).toHaveBeenCalledOnce();
  for(const spy of active.counts)expect(spy).not.toHaveBeenCalled();
});
it('releases decoded graphics when the file has no VRM data',async()=>{
  const owner=viewer(),replacement=candidate();
  mock.parse.mockResolvedValueOnce({...replacement.gltf,userData:{}});
  await expect(owner.prepareAvatar(blob())).rejects.toThrow('no supported VRM');
  for(const spy of replacement.counts)expect(spy).toHaveBeenCalledOnce();
});
