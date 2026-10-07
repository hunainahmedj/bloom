import { fitCrownBetweenFingertips } from './crown-clearance';
import { HAND_RECOVERY_MS } from './tracking-timing';
import { HEAD_CROWN_WIDTH_FACTOR } from './head-fit';
import { palmHoverPosition, fingertipHoverPosition } from './palm-hover';
import type { CrownState, FacePose, Gesture, InteractionFrame, Point } from './types';
export const PINCH_CLOSE = .32;
export const PINCH_RELEASE = .5;
export const HAND_GRACE_MS = 350;
export const FACE_GRACE_MS = 250;
const GRIP_DWELL_MS = 90;
const PLACE_DWELL_MS = 350;
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
interface Grip { pinch: boolean; fist: boolean; start: number | null; last: number; openStart: number | null; openLatched: boolean }
interface InteractionOptions { summonOnOpen?: boolean; palmClearance?: boolean }

export class InteractionController {
  state: CrownState;
  private initial: Point;
  private initialWidth: number;
  private owner: string | null = null;
  private offset: Point = { x: 0, y: 0 };
  private lastHand = 0;
  private lastFace = -Infinity;
  private lastObservation = -Infinity;
  private now = 0;
  private aspect = 1;
  private grips = new Map<string, Grip>();
  // This gate survives hand-ID expiry: losing tracking cannot undo a set-down/reset.
  private summonArmed = true;
  private rearmAfter = -Infinity;
  private gripAtPalm = false;
  private palmWidth = 0;
  private palmSpread = 1;
  private palmFactor = 1;
  private palmSettleUntil = 0;
  private placeSince: number | null = null;
  placementProgress = 0;

  constructor(position: Point, width: number, private options: InteractionOptions = {}) {
    this.initial = { ...position };
    this.initialWidth = width;
    this.state = this.initialState();
  }

  update(frame: InteractionFrame): CrownState {
    this.now = frame.now;
    const observedAt = Math.min(frame.now, frame.observedAt ?? frame.now);
    this.aspect = frame.aspect ?? this.aspect;
    const fresh = observedAt > this.lastObservation;
    const currentFace = frame.now - observedAt <= FACE_GRACE_MS ? frame.face : null;
    if (currentFace) this.lastFace = Math.max(this.lastFace, observedAt);
    if (this.state.mode === 'worn') {
      this.state.visible = frame.now - this.lastFace <= FACE_GRACE_MS;
      if (currentFace) this.follow(currentFace);
    }
    if (this.isCarried() && this.owner !== 'pointer' && frame.now - this.lastHand > HAND_RECOVERY_MS) this.release(null);
    // Cached camera results can be drawn again, but cannot advance a gesture timer.
    if (fresh && frame.now - observedAt <= HAND_GRACE_MS) {
      if (observedAt - this.lastObservation > 250) {
        this.clearDwell();
        for (const grip of this.grips.values()) { grip.start = null; grip.openStart = null; }
      }
      this.lastObservation = observedAt;
      const seen = new Set(frame.hands.map(hand => hand.id));
      if (this.owner && !seen.has(this.owner)) this.clearDwell();
      for (const [id, grip] of this.grips) if (!seen.has(id)) { grip.start = null; grip.openStart = null; }
      for (const hand of frame.hands) this.observeHand(hand, currentFace, observedAt);
      for (const [id, grip] of this.grips) {
        if (observedAt - grip.last > HAND_GRACE_MS) this.grips.delete(id);
      }
    }
    if (this.isCarried() && this.owner !== 'pointer' && frame.now - this.lastHand > HAND_RECOVERY_MS) this.release(null);
    return this.state;
  }

  private observeHand(hand: Gesture, face: FacePose | null, at: number): void {
    const previous = this.grips.get(hand.id) ?? { pinch: false, fist: false, start: null, last: at, openStart: null, openLatched: false };
    const pinch = hand.ratio < (previous.pinch ? PINCH_RELEASE : PINCH_CLOSE);
    const fist = !!hand.palm && hand.palm.openness < (previous.fist ? .68 : .48);
    const gripping = pinch || fist;
    const point = fist && hand.palm ? hand.fingers?.point ?? hand.palm.point : hand.point;
    let start = previous.start;
    if (!previous.pinch && !previous.fist && gripping) start = this.hit(point) ? at : null;
    if (!gripping || !this.hit(point)) start = null;
    let { openStart, openLatched } = previous;
    if (hand.palm && hand.palm.openness < .5) {
      openLatched = false;
      if (!this.owner && this.state.mode === 'floating' && at > this.rearmAfter) this.summonArmed = true;
    }
    const open = !!hand.palm && hand.palm.openness >= .8 && !gripping
      && hand.palm.point.x >= 0 && hand.palm.point.x <= 1 && hand.palm.point.y >= 0 && hand.palm.point.y <= 1;
    if (!open || openLatched) openStart = null;
    else openStart ??= at;
    const summon = this.options.summonOnOpen && openStart !== null && at - openStart >= 180;
    if (summon) { openLatched = true; openStart = null; }
    this.grips.set(hand.id, { pinch, fist, start, last: at, openStart, openLatched });
    if (summon && this.summonArmed && !this.owner && this.state.mode === 'floating') {
      this.owner = hand.id;
      this.lastHand = at;
      this.state.visible = true;
      this.state.summonedAt = at;
      this.restOnPalm(hand, at);
    }

    if (!this.owner && gripping && start !== null && (!hand.palm || at - start >= GRIP_DWELL_MS)) {
      if (this.grab(point, hand.id, at)) this.gripAtPalm = fist;
    }
    if (this.owner !== hand.id) return;
    this.lastHand = at;
    const orientation = hand.fingers ? hand.fingers.orientation : hand.palm?.orientation;
    if (orientation) this.state.palmOrientation = orientation;
    if (this.state.mode === 'held') {
      if (!gripping) {
        if (!hand.palm || this.nearHead(face)) this.release(face);
        else this.restOnPalm(hand, at);
      } else this.move(this.gripAtPalm && hand.palm ? hand.fingers?.point ?? hand.palm.point : hand.point, hand.id, at);
    }
    if (this.state.mode !== 'palm' || !hand.palm) return;
    this.move(hand.fingers?.point ?? hand.palm.point, hand.id, at);
    this.state.palmRoll = hand.palm.roll;
    if (hand.fingers || this.options.palmClearance) {
      const hover = hand.fingers ? fingertipHoverPosition({ ...hand.fingers, orientation: this.state.palmOrientation }, hand.palm.span, this.aspect)
        : palmHoverPosition(hand.palm, this.aspect);
      this.state.position = hover.point;
      this.state.depth = hover.depth;
    }
    // Calibrate through the opening transition: the fingers and spread filter
    // settle at different speeds. Opening a fist should not itself resize it.
    if (at <= this.palmSettleUntil) this.palmSpread = Math.max(hand.palm.spread, .1);
    const factor = clamp(this.palmFactor * hand.palm.spread / this.palmSpread, .45, 2.2);
    this.state.sizeFactor = factor;
    const requestedWidth = this.palmWidth * factor / this.palmFactor;
    this.state.width = hand.fingers ? fitCrownBetweenFingertips(requestedWidth, hand.fingers) : requestedWidth;
    this.state.sizeFactor = this.state.width / this.palmWidth * this.palmFactor;

    // Finger contact during fist closure is ambiguous. Setting down is explicit;
    // every finger shape continues carrying/resizing the crown in palm mode.

    if (this.nearHead(face)) {
      this.placeSince ??= at;
      this.placementProgress = clamp((at - this.placeSince) / PLACE_DWELL_MS, 0, 1);
      if (this.placementProgress >= 1 && face) this.wear(face);
    } else { this.placeSince = null; this.placementProgress = 0; }
  }

  private restOnPalm(hand: Gesture, at: number): void {
    this.state.mode = 'palm';
    this.offset = { x: 0, y: 0 };
    this.palmWidth = this.state.width;
    this.palmSpread = Math.max(hand.palm!.spread, .1);
    this.palmFactor = this.state.sizeFactor ?? 1;
    this.palmSettleUntil = at + 200;
    this.clearDwell();
  }

  private nearHead(face: FacePose | null): boolean {
    return !!face && Math.hypot(
      (this.state.position.x - face.crown.x) / (face.width * .6),
      (this.state.position.y - face.crown.y) / (face.height * .3),
    ) <= 1;
  }

  private isCarried(): boolean { return this.state.mode === 'held' || this.state.mode === 'palm'; }
  private clearDwell(): void { this.placeSince = null; this.placementProgress = 0; }

  hit(point: Point): boolean {
    if (!this.state.visible) return false;
    const dx = (point.x - this.state.position.x) / (this.state.width * .6);
    const dy = (point.y - this.state.position.y) / (this.state.width * this.aspect * .42);
    return dx * dx + dy * dy <= 1;
  }

  grab(point: Point, id: string, now: number): boolean {
    if (this.isCarried() || !this.hit(point)) return false;
    this.offset = { x: this.state.position.x - point.x, y: this.state.position.y - point.y };
    this.owner = id; this.lastHand = now; this.gripAtPalm = false;
    this.clearDwell(); this.state.mode = 'held';
    return true;
  }

  move(point: Point, id: string, now: number): void {
    if (!this.isCarried() || id !== this.owner) return;
    this.lastHand = now;
    this.state.position = { x: clamp(point.x + this.offset.x, .03, .97), y: clamp(point.y + this.offset.y, .03, .97) };
  }

  release(face: FacePose | null, now = this.now): void {
    if (!this.isCarried()) return;
    this.owner = null; this.summonArmed = false; this.rearmAfter = now; this.clearDwell();
    // Keep the current grip latched until it opens, preventing an instant re-grab.
    for (const grip of this.grips.values()) { grip.start = null; grip.openStart = null; }
    if (this.nearHead(face) && face) this.wear(face);
    else this.state.mode = 'floating';
  }

  wear(face: FacePose): void {
    this.owner = null; this.summonArmed = false; this.rearmAfter = this.now; this.clearDwell();
    for (const grip of this.grips.values()) { grip.start = null; grip.openStart = null; }
    this.state.sizeFactor = 1;
    this.lastFace = this.now; this.state.mode = 'worn'; this.state.visible = true;
    this.follow(face);
  }

  private follow(face: FacePose): void {
    this.state.position = { ...face.crown };
    this.state.depth = face.crownDepth ?? 0;
    this.state.headRotation = [...face.rotation];
    this.state.width = (face.headWidth ?? face.width) * HEAD_CROWN_WIDTH_FACTOR;
  }

  get activeHandId(): string | null { return this.owner; }
  get recoveringHand(): boolean { return this.isCarried() && this.owner !== 'pointer' && this.now - this.lastHand > 250; }
  private initialState(): CrownState {
    return { mode: 'floating', position: { ...this.initial }, width: this.initialWidth, visible: !this.options.summonOnOpen, sizeFactor: 1 };
  }
  reset(now = this.now): void {
    this.owner = null; this.summonArmed = false; this.rearmAfter = now; this.clearDwell();
    for (const grip of this.grips.values()) { grip.start = null; grip.openStart = null; }
    this.state = this.initialState();
  }
  newSession(): void {
    this.reset(); this.summonArmed = true; this.rearmAfter = -Infinity; this.grips.clear(); this.lastObservation = this.lastFace = -Infinity;
  }
}
