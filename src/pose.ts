import type { FacePose, Landmark, Size } from './types';
import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import { mapVideoPoint } from './coordinates';
import { HEAD_CROWN_LIFT } from './head-fit';

export function facePose(landmarks: Landmark[], matrix: number[] | null, video: Size, viewport: Size, mirror = true): FacePose {
  const map = (i: number) => mapVideoPoint(landmarks[i], video, viewport, mirror);
  const top = map(10), chin = map(152), left = map(234), right = map(454);
  const height = Math.max(Math.hypot((chin.x - top.x) * viewport.width / viewport.height, chin.y - top.y), .05);
  const width = Math.max(Math.hypot(left.x - right.x, (left.y - right.y) * viewport.height / viewport.width), .05);
  const eyeLeft = map(263), eyeRight = map(33);
  const eyeStart = eyeLeft.x < eyeRight.x ? eyeLeft : eyeRight, eyeEnd = eyeLeft.x < eyeRight.x ? eyeRight : eyeLeft;
  let rotation: [number, number, number] = [0, 0, -Math.atan2((eyeEnd.y - eyeStart.y) * viewport.height, (eyeEnd.x - eyeStart.x) * viewport.width)];
  if (matrix?.length === 16) {
    const m = new Matrix4().fromArray(matrix);
    // Accept both storage layouts; MediaPipe versions expose a flattened matrix.
    if (Math.abs(matrix[3]) + Math.abs(matrix[7]) + Math.abs(matrix[11]) > Math.abs(matrix[12]) + Math.abs(matrix[13]) + Math.abs(matrix[14])) m.transpose();
    const q = new Quaternion(); m.decompose(new Vector3(), q, new Vector3());
    const e = new Euler().setFromQuaternion(q, 'YXZ');
    rotation = [e.x, mirror ? -e.y : e.y, mirror ? -e.z : e.z];
  }
  const center={x:(top.x+chin.x)/2,y:(top.y+chin.y)/2};
  const orientation=new Quaternion().setFromEuler(new Euler(...rotation,'YXZ'));
  const up=new Vector3(0,1,0).applyQuaternion(orientation);
  const across=new Vector3(1,0,0).applyQuaternion(orientation);
  // Lift along the actual head axis. Compensate its projected length so head
  // pitch moves the crown in depth instead of pulling it toward the forehead.
  const projected=Math.max(Math.hypot(up.x,up.y),.65);
  const lift=up.multiplyScalar(height*2*(.5+HEAD_CROWN_LIFT)/projected);
  return {
    center,
    crown: { x:center.x+lift.x/(2*viewport.width/viewport.height),y:center.y-lift.y/2 },
    crownDepth: lift.z,
    width, height, rotation,
    headWidth: width/Math.max(Math.hypot(across.x,across.y),.65),
  };
}
