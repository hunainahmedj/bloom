import { TrackingClient } from '../src/tracking';
const button = document.getElementById('run') as HTMLButtonElement;
const output = document.getElementById('result')!;
button.onclick = async () => {
  button.disabled = true;
  const tracker = new TrackingClient();
  const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 240;
  const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#aaccaa'; ctx.fillRect(0, 0, 320, 240);
  const stream = canvas.captureStream(5);
  const video = document.getElementById('video') as HTMLVideoElement;
  video.srcObject = stream;
  const cleanup = () => { tracker.stop(); stream.getTracks().forEach(t => t.stop()); video.srcObject = null; button.disabled = false; };
  tracker.onError = error => { output.textContent = `FAIL: ${error.message}`; cleanup(); };
  tracker.onResult = result => { output.textContent = `PASS: loaded both models and processed a synthetic video frame. Face: ${!!result.face}; hands: ${result.hands.length}.`; cleanup(); };
  try {
    output.textContent = 'Loading models…';
    await video.play(); await tracker.start();
    output.textContent = 'Models loaded; processing frame…';
    await tracker.submit(video, performance.now());
  } catch (error) { output.textContent = `FAIL: ${String(error)}`; cleanup(); }
};

const production = document.getElementById('production') as HTMLButtonElement;
production.onclick = async () => {
  const url = (document.getElementById('production-path') as HTMLInputElement).value;
  const result = document.getElementById('production-result')!;
  if (!url.startsWith('/dist/assets/tracking.worker-') || !url.endsWith('.js')) { result.textContent = 'Enter the built worker path from dist/assets.'; return; }
  production.disabled = true;
  const worker = new Worker(url, { type: 'module' });
  const timeout = setTimeout(() => { result.textContent = 'FAIL: production worker timed out'; worker.terminate(); production.disabled = false; }, 30000);
  const cleanup = () => { clearTimeout(timeout); worker.terminate(); production.disabled = false; };
  worker.onerror = error => { result.textContent = `FAIL: ${error.message}`; cleanup(); };
  worker.onmessage = async ({ data }) => {
    if (data.type === 'ready') {
      const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 240;
      const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#aaccaa'; ctx.fillRect(0, 0, 320, 240);
      const bitmap = await createImageBitmap(canvas);
      worker.postMessage({ type: 'frame', bitmap, timestamp: performance.now() }, [bitmap]);
    } else if (data.type === 'result') { result.textContent = 'PASS: production worker loaded local models and processed a frame.'; cleanup(); }
    else if (data.type === 'error') { result.textContent = `FAIL: ${data.message}`; cleanup(); }
  };
  result.textContent = 'Loading the built worker and its packaged models…';
  worker.postMessage({ type: 'init', base: new URL('/dist/', location.origin).href });
};
