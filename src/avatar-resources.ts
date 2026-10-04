import * as THREE from 'three';
import type { GLTFParser } from 'three/addons/loaders/GLTFLoader.js';

/** Track allocations that can outlive a rejected decoder promise. */
export class AvatarResources {
  private geometries=new Set<THREE.BufferGeometry>();
  private materials=new Set<THREE.Material>();
  private textures=new Set<THREE.Texture>();
  private skeletons=new Set<THREE.Skeleton>();
  private images=new Set<ImageBitmap>();
  private released=new WeakSet<object>();
  private closed=false;
  track(value:unknown){
    const visited=new Set<object>();
    const collect=(item:unknown):void=>{
      if(!item||typeof item!=='object'||visited.has(item))return;
      visited.add(item);
      if(Array.isArray(item)){for(const child of item)collect(child);return;}
      if(item instanceof THREE.Object3D){
        item.traverse(object=>{
          const mesh=object as THREE.Mesh;collect(mesh.geometry);collect(mesh.material);
          const skeleton=(object as THREE.SkinnedMesh).skeleton;if(skeleton){this.skeletons.add(skeleton);collect(skeleton.boneTexture);}
        });
      }else if(item instanceof THREE.BufferGeometry)this.geometries.add(item);
      else if(item instanceof THREE.Texture){this.textures.add(item);collect(item.source?.data);}
      else if(item instanceof THREE.Material){
        this.materials.add(item);
        for(const value of Object.values(item))if(value instanceof THREE.Texture||Array.isArray(value))collect(value);
        for(const uniform of Object.values((item as THREE.ShaderMaterial).uniforms??{}))collect(uniform.value);
      }else if(typeof ImageBitmap!=='undefined'&&item instanceof ImageBitmap)this.images.add(item);
    };
    collect(value);if(this.closed)this.flush();
  }
  watch(parser:GLTFParser){
    const dependency=parser.getDependency.bind(parser);
    parser.getDependency=(type,index)=>dependency(type,index).then(value=>{this.track(value);return value;},error=>{
      this.track([...(parser.associations?.keys()??[])]);throw error;
    });
    const geometries=parser.loadGeometries.bind(parser);
    parser.loadGeometries=primitives=>Promise.all(primitives.map(primitive=>geometries([primitive]).then(([value])=>{this.track(value);return value;})));
  }
  dispose(scene?:THREE.Object3D){if(scene)this.track(scene);this.closed=true;this.flush();}
  private flush(){
    const release=<T extends object>(items:Set<T>,dispose:(item:T)=>void)=>{
      for(const item of items)if(!this.released.has(item)){this.released.add(item);dispose(item);}
      items.clear();
    };
    release(this.geometries,item=>item.dispose());release(this.materials,item=>item.dispose());
    release(this.textures,item=>item.dispose());
    release(this.skeletons,item=>{item.boneTexture=null;item.dispose();});
    release(this.images,item=>item.close());
  }
}
