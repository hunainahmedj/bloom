import { Quaternion, Vector3 } from 'three';
import { palmOrientation } from './palm-pose';
import type { Landmark, FingerGrip, Point, Orientation } from './types';

export const FINGERTIP_INDICES = [4, 8, 12, 16, 20];
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export function fingertipAnchor(nodes: Point[], palmCenter?: Point, flatness = 0): Point {
  if (nodes.length !== 5) return nodes[0] ? { ...nodes[0] } : { x: .5, y: .5 };
  // A cupped grip balances thumb/opposing tips; a flat hand centres over its palm.
  const opposite = nodes.slice(1).reduce((sum,p) => ({ x: sum.x + p.x / 4, y: sum.y + p.y / 4 }), { x: 0, y: 0 });
  const cup = { x: (nodes[0].x + opposite.x) / 2, y: (nodes[0].y + opposite.y) / 2 };
  if (!palmCenter) return cup;
  const blend=clamp(flatness,0,1);
  return { x: cup.x*(1-blend)+(palmCenter.x*.7+opposite.x*.3)*blend,
    y: cup.y*(1-blend)+(palmCenter.y*.7+opposite.y*.3)*blend };
}
function palmCenterOf(points: Landmark[]): Landmark {
  const result={x:0,y:0,z:0};
  for(const axis of ['x','y','z'] as const) result[axis]=points[0][axis]*.4+[5,9,13,17].reduce((sum,i)=>sum+points[i][axis]*.15,0);
  return result;
}
export function flatHandBlend(points: Landmark[], aspect=1): number {
  const v=(i:number)=>new Vector3(points[i].x*aspect,points[i].y,points[i].z*aspect);
  const forward=v(9).sub(v(0));if(forward.lengthSq()<1e-8)return 0;forward.normalize();
  const alignment=[5,9,13,17].reduce((sum,i)=>sum+v(i+3).sub(v(i)).normalize().dot(forward),0)/4;
  const t=clamp((alignment-.72)/.21,0,1);
  return t*t*(3-2*t);
}
export function fingerGrip(points: Landmark[], aspect = 1, world?: Landmark[], mirrored = true, handedness?: string): FingerGrip {
  const nodes = FINGERTIP_INDICES.map(i => ({ x: points[i].x, y: points[i].y }));
  const shape = world?.length === 21 ? world : points, scale = shape === world ? 1 : aspect;
  const palmCenter=palmCenterOf(points), flatness=flatHandBlend(shape,scale);
  const point = fingertipAnchor(nodes,palmCenter,flatness);
  const gapRadius = fingertipGapRadius(points, aspect, world);
  const hand = palmOrientation(shape, aspect, mirrored, shape === world, handedness);
  if (!hand) return { point, nodes, gapRadius, palmCenter, flatness };
  const base = new Quaternion(...hand), normal = new Vector3(0, 1, 0).applyQuaternion(base);
  const fallback = { point, nodes, gapRadius, palmCenter, flatness, orientation: hand };
  const vector = (i: number) => new Vector3(shape[i].x * scale * (mirrored ? -1 : 1), -shape[i].y, -shape[i].z * scale);
  const thumb = vector(4), x = vector(8).sub(thumb), across = vector(20).sub(thumb);
  const palmLength = vector(0).distanceTo(vector(9)), tipNormal = new Vector3().crossVectors(across, x);
  const areaRatio = tipNormal.length() / Math.max(x.length() * across.length(), 1e-10);
  if (!Number.isFinite(areaRatio) || x.length() < palmLength * .15 || across.length() < palmLength * .15 || areaRatio < .1)
    return fallback;
  tipNormal.normalize();
  const alignment = tipNormal.dot(normal);
  // Finger curl is a local articulation, not a replacement for rigid hand rotation.
  // Blend its tilt smoothly to zero at ambiguous planes; always keep the hand frame.
  const confidence = clamp((Math.abs(alignment) - .15) / .35, 0, 1) * clamp((areaRatio - .1) / .25, 0, 1);
  if (!confidence) return fallback;
  if (alignment < 0) tipNormal.negate();
  const correction = new Quaternion().setFromUnitVectors(normal, tipNormal);
  const angle = new Quaternion().angleTo(correction);
  const fraction = Math.min(1, (25 * Math.PI / 180) / Math.max(angle, 1e-6)) * confidence;
  const orientation = new Quaternion().slerp(correction, fraction).multiply(base).normalize().toArray() as Orientation;
  return { point, nodes, gapRadius, palmCenter, flatness, orientation };
}

// Fit in the measured 3D grasp, not its 2D silhouette: a sideways hand can
// project several well-separated tips onto the same pixel.
export function fingertipGapRadius(points: Landmark[], aspect: number, world?: Landmark[]): number | undefined {
  const metric = world?.length === 21;
  const shape = metric ? world : points;
  const v = (i: number) => new Vector3(shape![i].x * (metric ? 1 : aspect), shape![i].y, shape![i].z * (metric ? 1 : aspect));
  const opposite = FINGERTIP_INDICES.slice(1).reduce((sum, i) => sum.add(v(i)), new Vector3()).multiplyScalar(.25);
  const center = v(4).add(opposite).multiplyScalar(.5);
  const palm=palmCenterOf(shape!);
  // Apply exactly the same centre and shape blend in metric space for sizing.
  const palmVector=new Vector3(palm.x*(metric?1:aspect),palm.y,palm.z*(metric?1:aspect));
  center.lerp(palmVector.multiplyScalar(.7).addScaledVector(opposite,.3),flatHandBlend(shape!,metric?1:aspect));
  // Estimate image scale using several visible palm bones, excluding ones
  // pointing almost into the camera. This avoids shrinkage on wrist turns.
  const scales = [[0,5],[0,9],[0,17],[5,17]].flatMap(([a,b]) => {
    const d = v(a).sub(v(b)), projected = Math.hypot(d.x,d.y);
    if (projected < Math.max(1e-6,d.length() * .2)) return [];
    return [Math.hypot(points[a].x-points[b].x,(points[a].y-points[b].y)/aspect)/projected];
  }).filter(x => Number.isFinite(x) && x > 0).sort((a,b) => a-b);
  if (!scales.length) return undefined;
  const scale = scales[Math.floor(scales.length/2)];
  const radius = Math.min(...FINGERTIP_INDICES.map(i => v(i).distanceTo(center))) * scale;
  return Number.isFinite(radius) ? radius : undefined;
}
