type RequestCamera = (constraints: MediaStreamConstraints) => Promise<MediaStream>;
export class CameraController {
  private generation = 0;
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  constructor(private request: RequestCamera = constraints => {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera access needs localhost or a secure HTTPS connection.');
    return navigator.mediaDevices.getUserMedia(constraints);
  }) {}

  async start(video: HTMLVideoElement): Promise<void> {
    this.stop();
    const generation = this.generation;
    const stream = await this.request({ video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 720 } }, audio: false });
    if (generation !== this.generation) {
      stream.getTracks().forEach(track => track.stop());
      throw new DOMException('Camera start cancelled', 'AbortError');
    }
    this.stream = stream;
    this.video = video;
    video.srcObject = stream;
    try {
      await video.play();
      if (generation !== this.generation) throw new DOMException('Camera start cancelled', 'AbortError');
    } catch (error) {
      if (generation === this.generation) this.stop();
      throw error;
    }
  }

  stop(): void {
    this.generation++;
    this.stream?.getTracks().forEach(track => track.stop());
    if (this.video) { this.video.pause(); this.video.srcObject = null; }
    this.stream = null;
    this.video = null;
  }
}
