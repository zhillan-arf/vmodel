import type { AvatarViewer } from './viewer';
import { Box3, Vector3, MathUtils } from 'three';

export async function captureModelThumbnail(viewer: AvatarViewer): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = 320; canvas.height = 320;
  const original = viewer.camera.clone();
  if (viewer.vrm) {
    viewer.vrm.scene.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(viewer.vrm.scene, true);
    const size = bounds.getSize(new Vector3()), center = bounds.getCenter(new Vector3());
    const distance = Math.max(size.x, size.y) * 1.15 / (2 * Math.tan(MathUtils.degToRad(viewer.camera.fov / 2))) + size.z / 2;
    viewer.camera.position.set(center.x, center.y, center.z + distance);
    viewer.camera.lookAt(center); viewer.camera.updateMatrixWorld(true);
  }
  const source = viewer.renderer.domElement;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#182339'; context.fillRect(0, 0, 320, 320);
  const ratio = Math.max(320 / source.width, 320 / source.height);
  try { viewer.draw(0); context.drawImage(source, (320 - source.width * ratio) / 2, (320 - source.height * ratio) / 2, source.width * ratio, source.height * ratio); }
  finally { viewer.camera.copy(original); viewer.draw(0); }
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Model thumbnail could not be created. Retry the import.');
  return blob;
}
