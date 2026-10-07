import { Vector3 } from 'three';
import type { Object3D } from 'three';
// Face width includes cheeks; this fits the vine around the upper skull while
// allowing the outer petals/leaves to sit around its contour.
export const HEAD_CROWN_WIDTH_FACTOR = 1.26;
export const HEAD_CROWN_LIFT = .30;
export const HEAD_CROWN_DEPTH_SCALE = .86;
const offset = new Vector3();
export function fitHeadOccluder(mask:Object3D,crown:Object3D):void {
  // Share the rendered pose, including its filtering, instead of tracking an
  // unrelated face-centre sphere. The skull surface sits inside the vine.
  offset.set(0,-.72,0).multiply(crown.scale).applyQuaternion(crown.quaternion);
  mask.position.copy(crown.position).add(offset);
  mask.quaternion.copy(crown.quaternion);
  mask.scale.set(crown.scale.x*1.10,crown.scale.y*1.40,crown.scale.z*1.05);
}
