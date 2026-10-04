import {afterEach,expect,it,vi} from 'vitest';
import {BoxGeometry,MeshBasicMaterial,Texture,Mesh,Group} from 'three';
import type {GLTFParser} from 'three/addons/loaders/GLTFLoader.js';
import {AvatarResources} from '../src/avatar-resources';
afterEach(()=>vi.unstubAllGlobals());
it('releases completed and late decoder resources once after rejection',async()=>{
  class Bitmap{close=vi.fn();}vi.stubGlobal('ImageBitmap',Bitmap);
  const image=new Bitmap(),texture=new Texture(image as unknown as TexImageSource);
  const material=new MeshBasicMaterial({map:texture}),geometry=new BoxGeometry();
  const disposed=[vi.spyOn(texture,'dispose'),vi.spyOn(material,'dispose'),vi.spyOn(geometry,'dispose')];
  let finish!:(value:unknown)=>void;
  const parser={getDependency:vi.fn((type:string)=>type==='texture'?new Promise(resolve=>{finish=resolve;}):Promise.resolve(material)),
    loadGeometries:vi.fn(()=>Promise.resolve([geometry]))} as unknown as GLTFParser;
  const resources=new AvatarResources();resources.watch(parser);
  await parser.loadGeometries([{}]);await parser.getDependency('material',0);
  const pending=parser.getDependency('texture',0);
  resources.dispose();finish(texture);await pending;
  const scene=new Group();scene.add(new Mesh(geometry,material));resources.track(scene);resources.dispose(scene);
  for(const spy of disposed)expect(spy).toHaveBeenCalledOnce();expect(image.close).toHaveBeenCalledOnce();
});
it('tracks successful primitives when another primitive fails',async()=>{
  const geometry=new BoxGeometry(),disposed=vi.spyOn(geometry,'dispose');
  const parser={getDependency:vi.fn(),loadGeometries:vi.fn((primitives:any[])=>primitives[0].bad?Promise.reject(new Error('Invalid primitive')):Promise.resolve([geometry]))} as unknown as GLTFParser;
  const resources=new AvatarResources();resources.watch(parser);
  await expect(parser.loadGeometries([{}, {bad:true}])).rejects.toThrow('Invalid primitive');
  resources.dispose();expect(disposed).toHaveBeenCalledOnce();
});
it('retains resources until disposal after successful loading',()=>{
  const geometry=new BoxGeometry(),texture=new Texture(),material=new MeshBasicMaterial({map:texture});
  const disposed=[vi.spyOn(geometry,'dispose'),vi.spyOn(texture,'dispose'),vi.spyOn(material,'dispose')];
  const scene=new Group();scene.add(new Mesh(geometry,material));const resources=new AvatarResources();
  resources.track(scene);expect(disposed.every(spy=>spy.mock.calls.length===0)).toBe(true);
  resources.dispose(scene);resources.dispose(scene);for(const spy of disposed)expect(spy).toHaveBeenCalledOnce();
});
it('releases parser-associated material clones after a dependency rejects',async()=>{
  const material=new MeshBasicMaterial(),dispose=vi.spyOn(material,'dispose');
  const parser={associations:new Map([[material,{}]]),getDependency:()=>Promise.reject(new Error('Mesh failure')),loadGeometries:vi.fn()} as unknown as GLTFParser;
  const resources=new AvatarResources();resources.watch(parser);resources.dispose();
  await expect(parser.getDependency('mesh',0)).rejects.toThrow('Mesh failure');expect(dispose).toHaveBeenCalledOnce();
});
