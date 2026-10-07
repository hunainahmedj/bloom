import { describe, expect, it, vi } from 'vitest';
import { CameraController } from '../src/camera';

function fakeStream() {
  const track = { stop: vi.fn() };
  return { stream: { getTracks: () => [track] } as unknown as MediaStream, track };
}
function fakeVideo() {
  return { srcObject: null, play: vi.fn().mockResolvedValue(undefined), pause: vi.fn() } as unknown as HTMLVideoElement;
}
describe('camera lifetime', () => {
  it('attaches a stream only after an explicit start', async () => {
    const { stream, track } = fakeStream();
    const request = vi.fn().mockResolvedValue(stream);
    const camera = new CameraController(request);
    const video = fakeVideo();
    expect(request).not.toHaveBeenCalled();
    await camera.start(video);
    expect(video.srcObject).toBe(stream);
    camera.stop();
    expect(track.stop).toHaveBeenCalledOnce();
    expect(video.srcObject).toBeNull();
  });
  it('stops a stream arriving after cancellation', async () => {
    const { stream, track } = fakeStream();
    let resolve!: (s: MediaStream) => void;
    const camera = new CameraController(() => new Promise(r => { resolve = r; }));
    const video = fakeVideo();
    const start = camera.start(video);
    camera.stop();
    resolve(stream);
    await expect(start).rejects.toMatchObject({ name: 'AbortError' });
    expect(track.stop).toHaveBeenCalledOnce();
    expect(video.srcObject).toBeNull();
  });
  it('propagates denied permission and allows a later successful retry', async () => {
    const { stream } = fakeStream();
    const request = vi.fn().mockRejectedValueOnce(new DOMException('Denied', 'NotAllowedError')).mockResolvedValueOnce(stream);
    const camera = new CameraController(request);
    await expect(camera.start(fakeVideo())).rejects.toMatchObject({ name: 'NotAllowedError' });
    const video = fakeVideo();
    await camera.start(video);
    expect(video.srcObject).toBe(stream);
    camera.stop();
  });
  it('cleans up if video playback fails', async () => {
    const { stream, track } = fakeStream();
    const camera = new CameraController(async () => stream);
    const video = fakeVideo();
    vi.mocked(video.play).mockRejectedValue(new Error('Playback failed'));
    await expect(camera.start(video)).rejects.toThrow('Playback failed');
    expect(track.stop).toHaveBeenCalledOnce();
    expect(video.srcObject).toBeNull();
  });
});
