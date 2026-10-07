export interface Point { x: number; y: number }
export interface Size { width: number; height: number }
export interface Landmark extends Point { z: number }
export interface FacePose { center: Point; crown: Point; width: number; height: number; rotation: [number, number, number]; crownDepth?: number; headWidth?: number }
export type Orientation = [number, number, number, number];
export interface Palm { point: Point; openness: number; spread: number; roll: number; orientation?: Orientation; span?: number }
export interface FingerGrip { point: Point; nodes: Point[]; orientation?: Orientation; gapRadius?: number; palmCenter?: Point; flatness?: number }
export interface Gesture { uiPointing?: boolean; id: string; point: Point; ratio: number; palm?: Palm; fingers?: FingerGrip }
export interface CrownState { mode: 'floating' | 'held' | 'palm' | 'worn'; position: Point; width: number; visible: boolean; sizeFactor?: number; palmRoll?: number; palmOrientation?: Orientation; depth?: number; summonedAt?: number; headRotation?: [number, number, number] }
export interface InteractionFrame { now: number; observedAt?: number; face: FacePose | null; hands: Gesture[]; aspect?: number }
