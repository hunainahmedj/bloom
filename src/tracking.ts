import type { TrackingResult, WorkerOutput } from './tracking-types';

export class TrackingClient {
  private worker: Worker | null = null;
  private busy = false;
  private ready = false;
  private frameTimer: ReturnType<typeof setTimeout> | null = null;
  private cancelInit: (() => void) | null = null;
  onResult: (result: TrackingResult) => void = () => {};
  onError: (error: Error) => void = () => {};

  async start(): Promise<void> {
    this.stop();
    const worker = new Worker(new URL('./tracking.worker.ts', import.meta.url), { type: 'module' });
    this.worker = worker;
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Tracking took too long to load. Try starting the camera again.')), 30000);
      this.cancelInit = () => { clearTimeout(timeout); reject(new DOMException('Tracking cancelled', 'AbortError')); };
      worker.onerror = event => {
        const error = new Error(event.message || 'Tracking could not start in this browser.');
        clearTimeout(timeout);
        if (!this.ready) reject(error); else this.onError(error);
      };
      worker.onmessage = ({ data }: MessageEvent<WorkerOutput>) => {
        if (this.worker !== worker) return;
        if (data.type === 'ready') {
          clearTimeout(timeout); this.cancelInit = null; this.ready = true; resolve();
        } else if (data.type === 'result') {
          if (this.frameTimer) clearTimeout(this.frameTimer);
          this.frameTimer = null; this.busy = false; this.onResult(data.result);
        } else {
          const error = new Error(data.message);
          clearTimeout(timeout);
          if (!this.ready) reject(error); else this.onError(error);
        }
      };
      worker.postMessage({ type: 'init', base: new URL(import.meta.env.BASE_URL, location.origin).href });
    }).catch(error => { if (this.worker === worker) this.stop(); throw error; });
  }

  async submit(video: HTMLVideoElement, timestamp: number): Promise<void> {
    if (!this.worker || !this.ready || this.busy || video.readyState < 2) return;
    const worker = this.worker;
    this.busy = true;
    try {
      // Resize before inference to limit CPU work and memory on phones.
      const width = Math.min(video.videoWidth, 640);
      const bitmap = await createImageBitmap(video, { resizeWidth: width, resizeHeight: Math.round(width * video.videoHeight / video.videoWidth) });
      if (this.worker !== worker) { bitmap.close(); return; }
      this.frameTimer = setTimeout(() => this.onError(new Error('Tracking stopped responding. Try starting the camera again.')), 8000);
      worker.postMessage({ type: 'frame', bitmap, timestamp }, [bitmap]);
    } catch (error) {
      if (this.worker === worker) { this.busy = false; this.onError(error instanceof Error ? error : new Error('Camera frame could not be read.')); }
    }
  }

  stop(): void {
    this.cancelInit?.(); this.cancelInit = null;
    if (this.frameTimer) clearTimeout(this.frameTimer);
    this.frameTimer = null;
    this.worker?.terminate(); this.worker = null;
    this.ready = false; this.busy = false;
  }
}
