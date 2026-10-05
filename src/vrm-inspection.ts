import { sha256, checkAbort, validationVersion, type InspectionResult } from './model-types';
export const requiredBones = ['hips','spine','head','leftUpperArm','rightUpperArm','leftLowerArm','rightLowerArm','leftHand','rightHand','leftUpperLeg','rightUpperLeg','leftLowerLeg','rightLowerLeg','leftFoot','rightFoot'] as const;
const MiB = 1024 * 1024;
export const limits = { input: 150 * MiB, json: 8 * MiB, depth: 64, values: 250000, nodes: 20000, meshes: 4096, primitives: 8192, accessors: 32768, images: 256, dimension: 8192, pixels: 201326592, geometry: 128 * MiB, combined: 1024 * MiB };
const supported = new Set(['VRM','VRMC_vrm','VRMC_springBone','VRMC_materials_mtoon','VRMC_materials_hdr_emissiveMultiplier','VRMC_node_constraint','KHR_materials_unlit','KHR_texture_transform','KHR_materials_emissive_strength','KHR_materials_clearcoat','KHR_materials_transmission','KHR_materials_volume','KHR_materials_ior','KHR_materials_specular','KHR_materials_sheen','KHR_materials_iridescence','KHR_materials_anisotropy','KHR_mesh_quantization']);
function ensure(test: unknown, message: string): asserts test { if (!test) throw new Error(message); }
function integer(value: unknown, max = Number.MAX_SAFE_INTEGER): number {
  ensure(Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= max, 'Invalid resource size or index.'); return value as number;
}
function boundedJSON(value: unknown, depth = 0, counter = { count: 0 }): void {
  ensure(depth <= limits.depth && ++counter.count <= limits.values, 'Model JSON exceeds the inspection limits.');
  if (value && typeof value === 'object') for (const child of Object.values(value)) boundedJSON(child, depth + 1, counter);
}
export function imageSize(bytes: Uint8Array): [number, number] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length >= 24 && [137,80,78,71,13,10,26,10].every((n,i) => bytes[i] === n)) return [view.getUint32(16), view.getUint32(20)];
  if (bytes[0] === 255 && bytes[1] === 216) {
    let offset = 2;
    while (offset + 4 <= bytes.length) {
      ensure(bytes[offset++] === 255, 'Invalid JPEG image.');
      while (bytes[offset] === 255) offset++;
      const marker = bytes[offset++];
      if (marker === 217 || marker === 218) break;
      if (marker === 1 || marker >= 208 && marker <= 215) continue;
      const length = view.getUint16(offset); ensure(length >= 2 && offset + length <= bytes.length, 'Truncated JPEG image.');
      if ([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)) {
        ensure(length >= 7, 'Invalid JPEG dimensions.'); return [view.getUint16(offset + 5), view.getUint16(offset + 3)];
      }
      offset += length;
    }
  }
  throw new Error('Use embedded PNG or JPEG textures. This image format is not supported.');
}
export async function inspectVRM(blob: Blob, signal?: AbortSignal): Promise<InspectionResult> {
  checkAbort(signal); ensure(blob.size <= limits.input && blob.size >= 20, 'VRM size must be at most 150 MiB.');
  const bytes = await blob.arrayBuffer(); checkAbort(signal);
  const view = new DataView(bytes);
  ensure(view.getUint32(0, true) === 0x46546c67 && view.getUint32(4, true) === 2 && view.getUint32(8, true) === bytes.byteLength, 'Invalid GLB header or declared length.');
  let offset = 12, json: any, binary = new Uint8Array(); let chunks = 0;
  while (offset < bytes.byteLength) {
    ensure(offset + 8 <= bytes.byteLength, 'Truncated GLB chunk.');
    const length = view.getUint32(offset, true), type = view.getUint32(offset + 4, true); offset += 8;
    ensure(length % 4 === 0 && offset + length <= bytes.byteLength, 'Invalid GLB chunk boundary.');
    if (chunks === 0) {
      ensure(type === 0x4e4f534a && length <= limits.json, 'GLB must start with bounded JSON.');
      json = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes, offset, length)));
      boundedJSON(json);
    } else { ensure(chunks === 1 && type === 0x004e4942, 'Unsupported GLB chunk.'); binary = new Uint8Array(bytes, offset, length); }
    chunks++; offset += length;
  }
  ensure(json?.asset?.version === '2.0', 'Unsupported glTF version.');
  const extensions = json.extensions ?? {}, vrm0 = extensions.VRM, vrm1 = extensions.VRMC_vrm;
  ensure(!!vrm0 !== !!vrm1, 'Select a file with exactly one supported VRM extension.');
  ensure(!vrm1 || vrm1.specVersion === '1.0', 'Unsupported VRM version.');
  for (const name of json.extensionsRequired ?? []) ensure(supported.has(name), `Unsupported required extension: ${name}`);
  for (const name of json.extensionsUsed ?? []) ensure(!['KHR_draco_mesh_compression','EXT_meshopt_compression','KHR_texture_basisu','EXT_texture_webp','MSFT_texture_dds'].includes(name), `Compressed resources are not supported: ${name}`);
  for (const [key, maximum] of [['nodes',limits.nodes],['meshes',limits.meshes],['accessors',limits.accessors],['images',limits.images]] as const) ensure(Array.isArray(json[key] ?? []) && (json[key]?.length ?? 0) <= maximum, `Model exceeds the ${key} limit.`);
  ensure((json.buffers?.length ?? 0) <= 1, 'Use one embedded GLB buffer.');
  for (const buffer of json.buffers ?? []) ensure(!buffer.uri && integer(buffer.byteLength) <= binary.length && binary.length - buffer.byteLength <= 3, 'External or invalid buffer.');
  const views = json.bufferViews ?? [];
  const bufferLength = json.buffers?.[0]?.byteLength ?? 0;
  for (const item of views) {
    ensure(item.buffer === 0, 'Invalid buffer reference.');
    ensure(integer(item.byteOffset ?? 0) + integer(item.byteLength) <= bufferLength, 'Buffer view is outside the embedded buffer.');
    if (item.byteStride !== undefined) ensure(integer(item.byteStride, 252) >= 4 && item.byteStride % 4 === 0, 'Invalid buffer stride.');
  }
  const nodes = json.nodes ?? [], parents = new Set<number>();
  for (const node of nodes) {
    if(node.mesh!==undefined)ensure(json.meshes?.[integer(node.mesh)],'Invalid node mesh reference.');
    if(node.skin!==undefined)ensure(json.skins?.[integer(node.skin)],'Invalid node skin reference.');
    for(const child of node.children??[]){integer(child,nodes.length-1);ensure(!parents.has(child),'A node has multiple parents.');parents.add(child);}
  }
  const states=new Uint8Array(nodes.length);
  for(let root=0;root<nodes.length;root++){
    if(states[root])continue;
    const stack:{index:number;exit:boolean}[]=[{index:root,exit:false}];
    while(stack.length){const item=stack.pop()!;if(item.exit){states[item.index]=2;continue;}
      ensure(states[item.index]!==1,'Model nodes contain a cycle.');if(states[item.index]===2)continue;
      states[item.index]=1;stack.push({index:item.index,exit:true});
      for(const child of nodes[item.index].children??[])stack.push({index:child,exit:false});
    }
  }
  for(const scene of json.scenes??[])for(const root of scene.nodes??[])ensure(nodes[integer(root)],'Invalid scene node reference.');
  if(json.scene!==undefined)ensure(json.scenes?.[integer(json.scene)],'Invalid default scene.');
  for(const skin of json.skins??[])for(const joint of skin.joints??[])ensure(nodes[integer(joint)],'Invalid skin joint reference.');
  const getView = (index: unknown) => { const item = views[integer(index)]; ensure(item, 'Missing buffer view.'); return item; };
  const componentBytes: Record<number,number> = { 5120:1,5121:1,5122:2,5123:2,5125:4,5126:4 };
  const widths: Record<string,number> = { SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16 };
  let geometryBytes = 0;
  for (const accessor of json.accessors ?? []) {
    const component = componentBytes[accessor.componentType], width = widths[accessor.type];
    ensure(component && width, 'Invalid accessor type.');
    const count = integer(accessor.count), columns = accessor.type.startsWith('MAT') ? Number(accessor.type.slice(3)) : 1;
    const size = columns > 1 ? columns * Math.ceil(columns * component / 4) * 4 : component * width;
    const allocation = count * Math.max(size, width * 4); geometryBytes += allocation;
    ensure(Number.isSafeInteger(geometryBytes) && geometryBytes <= limits.geometry, 'Geometry exceeds 128 MiB.');
    if (accessor.bufferView !== undefined) {
      const item = getView(accessor.bufferView), stride = item.byteStride ?? size;
      const start = integer(accessor.byteOffset ?? 0);
      ensure(stride >= size && ((item.byteOffset??0)+start) % component === 0 && start % component === 0 && start + (count ? (count - 1) * stride + size : 0) <= item.byteLength, 'Accessor is outside its buffer view.');
    } else ensure(accessor.byteOffset === undefined, 'Accessor without a buffer view has a byte offset.');
    if (accessor.sparse) {
      const sparse = accessor.sparse, n = integer(sparse.count, count), indices = getView(sparse.indices.bufferView), values = getView(sparse.values.bufferView);
      const indexBytes = componentBytes[sparse.indices.componentType];
      ensure([5121,5123,5125].includes(sparse.indices.componentType), 'Invalid sparse index type.');
      ensure(integer(sparse.indices.byteOffset ?? 0) + n * indexBytes <= indices.byteLength && integer(sparse.values.byteOffset ?? 0) + n * size <= values.byteLength, 'Sparse accessor is outside its buffer view.');
      const indexView = new DataView(binary.buffer, binary.byteOffset + (indices.byteOffset ?? 0) + (sparse.indices.byteOffset ?? 0), n * indexBytes);
      let previous = -1;
      for (let i = 0; i < n; i++) {
        const value = indexBytes === 1 ? indexView.getUint8(i) : indexBytes === 2 ? indexView.getUint16(i*2,true) : indexView.getUint32(i*4,true);
        ensure(value > previous && value < count, 'Invalid sparse index.'); previous = value;
      }
    }
  }
  let primitives = 0;
  for (const mesh of json.meshes ?? []) for (const primitive of mesh.primitives ?? []) {
    ensure(++primitives <= limits.primitives, 'Too many mesh primitives.');
    for (const index of [...Object.values(primitive.attributes ?? {}), ...Object.values(primitive.targets ?? {}).flatMap((x:any) => Object.values(x)), ...(primitive.indices !== undefined ? [primitive.indices] : [])]) ensure(json.accessors?.[integer(index)], 'Invalid primitive accessor.');
  }
  let pixels = 0;
  for (const item of json.images ?? []) {
    let image: Uint8Array;
    if (item.uri !== undefined) {
      ensure(typeof item.uri === 'string' && /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]*={0,2}$/.test(item.uri), 'External image links are not allowed.');
      image = Uint8Array.from(atob(item.uri.split(',')[1]), c => c.charCodeAt(0));
    } else { const part = getView(item.bufferView); image = binary.subarray(part.byteOffset ?? 0, (part.byteOffset ?? 0) + part.byteLength); }
    const [width,height] = imageSize(image);
    ensure(width > 0 && height > 0 && width <= limits.dimension && height <= limits.dimension, 'Texture dimensions exceed 8192 pixels.');
    pixels += width * height; ensure(pixels <= limits.pixels, 'Decoded textures exceed the pixel limit.');
  }
  const textureBytes = Math.ceil(pixels * 4 * 4 / 3);
  ensure(geometryBytes + textureBytes <= limits.combined, 'Decoded resources exceed 1024 MiB.');
  const vrm = vrm1 ?? vrm0;
  const boneMap: Record<string,{node:number}> = vrm1 ? vrm.humanoid?.humanBones ?? {} : Object.fromEntries((vrm.humanoid?.humanBones ?? []).map((bone:any) => [bone.bone, bone]));
  for (const bone of requiredBones) ensure(boneMap[bone] && json.nodes?.[integer(boneMap[bone].node)], `Missing required bone: ${bone}`);
  const expressions: string[] = vrm1 ? Object.keys({ ...vrm.expressions?.preset, ...vrm.expressions?.custom }) : (vrm.blendShapeMaster?.blendShapeGroups ?? []).map((x:any) => x.presetName === 'unknown' ? x.name : x.presetName).filter((x:unknown) => typeof x === 'string');
  const aliases: Record<string,string> = {};
  if (!expressions.includes('surprised') && expressions.includes('びっくり')) aliases.surprised = 'びっくり';
  checkAbort(signal);
  const hash = await sha256(blob); checkAbort(signal);
  return { blob, hash, rawMeta: vrm.meta ?? {}, resources: { geometryBytes, textureBytes, pixels }, capabilities: {
    validationVersion, vrmVersion: vrm1 ? '1' : '0', expressions, aliases,
    missingOptionalBones: ['neck','chest','upperChest','leftToes','rightToes'].filter(name => !boneMap[name]),
    springs: !!(extensions.VRMC_springBone || vrm.secondaryAnimation), warnings: [],
  } };
}
