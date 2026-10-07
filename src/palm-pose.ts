import { Matrix4, Quaternion, Vector3 } from 'three';
import type { Landmark, Orientation } from './types';

export function palmOrientation(points: Landmark[], aspect = 1, mirrored = true, world = false, handedness?: string): Orientation | null {
  const scale = world ? 1 : aspect;
  // Camera coordinates point down/away; the renderer points up/toward us.
  // Mirror x here exactly once to match the mirrored video.
  const vector = (i: number) => new Vector3(points[i].x * scale * (mirrored ? -1 : 1), -points[i].y, -points[i].z * scale);
  const wrist = vector(0), middle = vector(9), index = vector(5), pinky = vector(17);
  const z = wrist.sub(middle), x = pinky.sub(index);
  // MediaPipe labels assume a selfie-mirrored image. The lateral bone order
  // reverses between hands; reversing it here keeps +Y outside either palm.
  if ((mirrored && handedness === 'Left') || (!mirrored && handedness === 'Right')) x.negate();
  if (!Number.isFinite(z.lengthSq() + x.lengthSq()) || z.lengthSq() < 1e-8 || x.lengthSq() < 1e-8) return null;
  z.normalize(); x.addScaledVector(z, -x.dot(z));
  if (x.lengthSq() < 1e-8) return null;
  x.normalize();
  // The crown lies in its local XZ plane; local Y is the palm normal.
  const y = new Vector3().crossVectors(z, x).normalize();
  const q = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x, y, z)).normalize();
  return [q.x, q.y, q.z, q.w];
}
