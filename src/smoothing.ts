import { fingertipAnchor } from './fingertip-pose';
import type { FacePose, Gesture, Orientation } from './types';

export class OneEuroFilter {
  private timestamp = -Infinity;
  private raw = 0;
  private value = 0;
  private velocity = 0;
  constructor(private minCutoff = 1.5, private beta = 5) {}

  filter(value: number, timestamp: number): number {
    if (timestamp <= this.timestamp) return this.value;
    const dt = (timestamp - this.timestamp) / 1000;
    if (dt > .35) {
      this.raw = this.value = value;
      this.velocity = 0;
    } else {
      const alpha = (cutoff: number) => 1 / (1 + 1 / (2 * Math.PI * cutoff * dt));
      this.velocity += alpha(1) * ((value - this.raw) / dt - this.velocity);
      this.value += alpha(this.minCutoff + this.beta * Math.abs(this.velocity)) * (value - this.value);
      this.raw = value;
    }
    this.timestamp = timestamp;
    return this.value;
  }
}

// Filter measurements once per captured frame, never once per display frame.
export class TrackingSmoother {
  private filters = new Map<string, { filter: OneEuroFilter; at: number; angle?: number }>();
  private rotations = new Map<string, { value: Orientation; at: number }>();
  reset(): void { this.filters.clear(); this.rotations.clear(); }
  private orientation(id: string, value: Orientation | undefined, at: number): Orientation | undefined {
    if (!value) return undefined;
    const prior = this.rotations.get(id);
    const sign = prior && at - prior.at <= 350 && value.reduce((sum, v, i) => sum + v * prior.value[i], 0) < 0 ? -1 : 1;
    const filtered = value.map((v, i) => this.smooth(`${id}.orientation.${i}`, v * sign, at, 3, 3));
    const length = Math.hypot(...filtered);
    if (!Number.isFinite(length) || length < 1e-6) return prior?.value;
    const result = filtered.map(v => v / length) as Orientation;
    this.rotations.set(id, { value: result, at });
    return result;
  }
  private smooth(key: string, value: number, at: number, cutoff = 1.5, beta = 5, angle = false): number {
    let entry = this.filters.get(key);
    if (!entry) { entry = { filter: new OneEuroFilter(cutoff, beta), at }; this.filters.set(key, entry); }
    if (angle && entry.angle !== undefined) value = entry.angle + Math.atan2(Math.sin(value - entry.angle), Math.cos(value - entry.angle));
    if (angle) entry.angle = value;
    entry.at = at;
    return entry.filter.filter(value, at);
  }
  process(face: FacePose | null, hands: Gesture[], at: number): { face: FacePose | null; hands: Gesture[] } {
    for (const [key, entry] of this.filters) if (at - entry.at > 350) this.filters.delete(key);
    for (const [key, entry] of this.rotations) if (at - entry.at > 350) this.rotations.delete(key);
    const point = (key: string, p: { x: number; y: number }) => ({ x: this.smooth(`${key}.x`, p.x, at), y: this.smooth(`${key}.y`, p.y, at) });
    return {
      face: face ? { ...face, center: point('face.center', face.center), crown: point('face.crown', face.crown),
        headWidth: face.headWidth === undefined ? undefined : this.smooth('face.headWidth',face.headWidth,at,1.5,4),
        crownDepth: face.crownDepth === undefined ? undefined : this.smooth('face.crownDepth',face.crownDepth,at,2,3),
        width: this.smooth('face.width', face.width, at, 1.5, 4), height: this.smooth('face.height', face.height, at, 1.5, 4),
        rotation: face.rotation.map((v, i) => this.smooth(`face.rotation.${i}`, v, at, 2, 3, true)) as [number, number, number],
      } : null,
      hands: hands.map(hand => {
        const nodes = hand.fingers?.nodes.map((p, i) => point(`${hand.id}.tip.${i}`, p));
        const palmCenter=hand.fingers?.palmCenter ? point(`${hand.id}.gripPalm`,hand.fingers.palmCenter) : undefined;
        const flatness=hand.fingers?.flatness === undefined ? undefined : this.smooth(`${hand.id}.flatness`,hand.fingers.flatness,at,5,2);
        const fingers = hand.fingers && nodes ? { nodes, palmCenter, flatness,
          // Expand smoothly, but never lag behind a closing physical grip.
          gapRadius: hand.fingers.gapRadius === undefined ? undefined : Math.min(hand.fingers.gapRadius, this.smooth(`${hand.id}.gapRadius`, hand.fingers.gapRadius, at, 3, 2)),
          point: fingertipAnchor(nodes,palmCenter,flatness),
          orientation: this.orientation(`${hand.id}.fingers`, hand.fingers.orientation, at),
        } : undefined;
        return ({ ...hand, fingers, point: point(`${hand.id}.pinch`, hand.point),
        ratio: this.smooth(`${hand.id}.ratio`, hand.ratio, at, 8, 1),
        palm: hand.palm ? { ...hand.palm, point: point(`${hand.id}.palm`, hand.palm.point),
          openness: this.smooth(`${hand.id}.openness`, hand.palm.openness, at, 5, 1),
          spread: this.smooth(`${hand.id}.spread`, hand.palm.spread, at, 3, 1),
          roll: this.smooth(`${hand.id}.roll`, hand.palm.roll, at, 3, 1, true),
          span: hand.palm.span === undefined ? undefined : this.smooth(`${hand.id}.span`, hand.palm.span, at, 2, 2),
          orientation: this.orientation(hand.id, hand.palm.orientation, at),
        } : undefined,
      }); }),
    };
  }
}
