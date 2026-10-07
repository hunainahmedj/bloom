/// <reference lib="webworker" />
import { FaceLandmarker, FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import type { WorkerInput, WorkerOutput } from './tracking-types';
import { HandIdentityTracker } from './hand-identity';

const scope = self as unknown as DedicatedWorkerGlobalScope;
let face: FaceLandmarker | null = null;
let hands: HandLandmarker | null = null;
const identities = new HandIdentityTracker();
const send = (message: WorkerOutput) => scope.postMessage(message);

scope.onmessage = async ({ data }: MessageEvent<WorkerInput>) => {
  try {
    if (data.type === 'init') {
      const fileset = await FilesetResolver.forVisionTasks(new URL('tracking/wasm', data.base).href, true);
      const { default: factory } = await import(/* @vite-ignore */ fileset.wasmLoaderPath);
      const runtime = scope as DedicatedWorkerGlobalScope & { ModuleFactory?: unknown };
      // Tasks Vision clears ModuleFactory after creating a task. Module imports
      // are cached, so restore the factory explicitly before each task creation.
      // The empty loader path tells Tasks Vision to use the factory already set.
      const loadedFileset = { ...fileset, wasmLoaderPath: '' };
      runtime.ModuleFactory = factory;
      // CPU works in browsers without worker GPU contexts; inference stays off the UI thread.
      face = await FaceLandmarker.createFromOptions(loadedFileset, {
        baseOptions: { modelAssetPath: new URL('tracking/face_landmarker.task', data.base).href, delegate: 'CPU' },
        runningMode: 'VIDEO', numFaces: 1, outputFacialTransformationMatrixes: true,
        minFaceDetectionConfidence: .55, minFacePresenceConfidence: .55, minTrackingConfidence: .55,
      });
      runtime.ModuleFactory = factory;
      hands = await HandLandmarker.createFromOptions(loadedFileset, {
        baseOptions: { modelAssetPath: new URL('tracking/hand_landmarker.task', data.base).href, delegate: 'CPU' },
        runningMode: 'VIDEO', numHands: 1, minHandDetectionConfidence: .55, minHandPresenceConfidence: .55, minTrackingConfidence: .55,
      });
      send({ type: 'ready' });
    } else {
      try {
        if (!face || !hands) throw new Error('Tracking is not ready.');
        const f = face.detectForVideo(data.bitmap, data.timestamp);
        const h = hands.detectForVideo(data.bitmap, data.timestamp);
        send({ type: 'result', result: {
          timestamp: data.timestamp,
          face: f.faceLandmarks[0] ?? null,
          matrix: f.facialTransformationMatrixes[0]?.data ?? null,
          hands: identities.assign(h.landmarks.map((landmarks, i) => ({ label: h.handedness[i]?.[0]?.categoryName ?? '', landmarks, worldLandmarks: h.worldLandmarks[i] })), data.timestamp),
        } });
      } finally { data.bitmap.close(); }
    }
  } catch (error) {
    send({ type: 'error', message: error instanceof Error ? error.message : 'Tracking failed.' });
  }
};
