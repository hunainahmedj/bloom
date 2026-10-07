import type { Landmark, Point, Size } from './types';
import { fingerGrip } from './fingertip-pose';
import { palmOrientation } from './palm-pose';
import { PINCH_RELEASE } from './interaction';
export function mapVideoPoint(point: Point, video: Size, viewport: Size, mirror: boolean): Point {
  const scale = Math.max(viewport.width / video.width, viewport.height / video.height);
  const renderedWidth = video.width * scale;
  const renderedHeight = video.height * scale;
  return {
    x: ((mirror ? 1 - point.x : point.x) * renderedWidth - (renderedWidth - viewport.width) / 2) / viewport.width,
    y: (point.y * renderedHeight - (renderedHeight - viewport.height) / 2) / viewport.height,
  };
}

export function mapVideoSpan(span: number, video: Size, viewport: Size): number {
  const scale = Math.max(viewport.width / video.width, viewport.height / video.height);
  return span * video.width * scale / viewport.width;
}

export function handGesture(landmarks: Landmark[], aspect: number, worldLandmarks?: Landmark[], mirrored = true, handedness?: string) {
  const a = landmarks[4], b = landmarks[8];
  const shape = worldLandmarks?.length === 21 ? worldLandmarks : landmarks;
  const scale = shape === worldLandmarks ? 1 : aspect;
  const distance = (p: Landmark, q: Landmark) => Math.hypot((p.x - q.x) * scale, p.y - q.y, (p.z - q.z) * scale);
  const handSize = Math.max(distance(shape[0], shape[9]), .0001);
  const knuckles = [5, 9, 13, 17].map(i => landmarks[i]);
  const extension = [5, 9, 13, 17].map(i => {
    const length = distance(shape[i], shape[i + 1]) + distance(shape[i + 1], shape[i + 2]) + distance(shape[i + 2], shape[i + 3]);
    return distance(shape[i], shape[i + 3]) / Math.max(length, .0001);
  });
  const openness=extension.reduce((a,b)=>a+b,0)/4;
  const palmWidth = Math.max(distance(shape[5], shape[17]), .0001);
  const ratio=distance(shape[4],shape[8])/handSize;
  return {
    uiPointing:ratio>=PINCH_RELEASE&&extension[0]>.84&&extension.slice(1).reduce((a,b)=>a+b,0)/3<.70,
    point: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, ratio,
    fingers: fingerGrip(landmarks, aspect, worldLandmarks, mirrored, handedness),
    palm: {
      point: { x: landmarks[0].x * .4 + knuckles.reduce((sum, p) => sum + p.x, 0) * .15,
        y: landmarks[0].y * .4 + knuckles.reduce((sum, p) => sum + p.y, 0) * .15 },
      span: Math.hypot(landmarks[9].x - landmarks[0].x, (landmarks[9].y - landmarks[0].y) / aspect),
      openness, spread: distance(shape[8], shape[20]) / palmWidth * (.35 + .65 * openness),
      roll: Math.atan2((landmarks[9].x - landmarks[0].x) * aspect, landmarks[0].y - landmarks[9].y),
      orientation: palmOrientation(shape, aspect, mirrored, shape === worldLandmarks, handedness) ?? undefined,
    },
  };
}
