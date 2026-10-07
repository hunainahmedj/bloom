import { HAND_RECOVERY_MS } from './tracking-timing';
import type { Landmark, Point } from './types';
export interface HandDetection { label: string; landmarks: Landmark[]; worldLandmarks?: Landmark[] }
export class HandIdentityTracker {
  private serial = 0;
  private previous: { id: string; point: Point; at: number; handedness: string; span: number }[] = [];

  assign(hands: HandDetection[], now: number): { id: string; landmarks: Landmark[]; worldLandmarks?: Landmark[]; handedness: string }[] {
    this.previous = this.previous.filter(hand => now - hand.at <= HAND_RECOVERY_MS);
    const points = hands.map(hand => ({
      x: (hand.landmarks[0].x + hand.landmarks[5].x + hand.landmarks[17].x) / 3,
      y: (hand.landmarks[0].y + hand.landmarks[5].y + hand.landmarks[17].y) / 3,
    }));
    const spans = hands.map(({landmarks:p}) => Math.max(
      Math.hypot(p[0].x-p[9].x,p[0].y-p[9].y),
      Math.hypot(p[5].x-p[17].x,p[5].y-p[17].y)));
    let best: (string | null)[] = [], bestCost = Infinity;
    // With at most two detections, enumerate assignments to avoid greedy swaps.
    const match = (index: number, assignment: (string | null)[], used: Set<string>, cost: number) => {
      if (index === hands.length) { if (cost < bestCost) { bestCost = cost; best = [...assignment]; } return; }
      match(index + 1, [...assignment, null], used, cost + .46);
      for (const old of this.previous) {
        if (used.has(old.id)) continue;
        const distance = Math.hypot(old.point.x - points[index].x, old.point.y - points[index].y);
        const elapsed = now - old.at;
        // Wide matching is only safe during a continuous, fast turn. After an
        // occlusion require a nearby return, especially if handedness differs.
        const radius = elapsed > 300 ? .2 : .45;
        const relabelRadius = Math.min(.2, Math.max(.12, 1.25 * Math.max(old.span, spans[index])));
        if (distance > radius || (elapsed > 250 && hands[index].label !== old.handedness && distance > relabelRadius)) continue;
        match(index + 1, [...assignment, old.id], new Set([...used, old.id]), cost + distance);
      }
    };
    match(0, [], new Set(), 0);
    const result = hands.map((hand, i) => ({ id: best[i] ?? `hand-${++this.serial}`, landmarks: hand.landmarks, worldLandmarks: hand.worldLandmarks,
      handedness: this.previous.find(old => old.id === best[i])?.handedness || hand.label }));
    const current = result.map((hand, i) => ({ id: hand.id, point: points[i], at: now, handedness: hand.handedness, span: spans[i] }));
    this.previous = [...current, ...this.previous.filter(old => !current.some(hand => hand.id === old.id))];
    return result;
  }
}
