import type { Landmark } from './types';
export interface TrackingResult {
  timestamp: number;
  face: Landmark[] | null;
  matrix: number[] | null;
  hands: { id: string; landmarks: Landmark[]; worldLandmarks?: Landmark[]; handedness?: string }[];
}
export type WorkerInput = { type: 'init'; base: string } | { type: 'frame'; bitmap: ImageBitmap; timestamp: number };
export type WorkerOutput = { type: 'ready' } | { type: 'result'; result: TrackingResult } | { type: 'error'; message: string };
