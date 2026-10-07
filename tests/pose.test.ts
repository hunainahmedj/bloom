import { expect, it } from 'vitest';
import { facePose } from '../src/pose';
import type { Landmark } from '../src/types';

it('anchors above the forehead and scales to the mapped face width', () => {
  const landmarks: Landmark[] = Array.from({ length: 478 }, () => ({ x: .5, y: .5, z: 0 }));
  landmarks[10].y = .3; landmarks[152].y = .7;
  landmarks[234].x = .35; landmarks[454].x = .65;
  landmarks[33] = { x: .4, y: .45, z: 0 }; landmarks[263] = { x: .6, y: .45, z: 0 };
  const pose = facePose(landmarks, null, { width: 100, height: 100 }, { width: 100, height: 100 });
  expect(pose.center).toEqual({ x: .5, y: .5 });
  expect(pose.crown.y).toBeLessThan(.3);
  expect(pose.width).toBeCloseTo(.3);
  expect(pose.height).toBeCloseTo(.4);
  expect(pose.rotation[2]).toBeCloseTo(0);
});

it('maps screenshot head roll without a half-turn and mirrors it exactly once for camera view', () => {
  const p: Landmark[] = Array.from({length:478},()=>({x:.5,y:.5,z:0}));
  p[10].y=.3; p[152].y=.7; p[234].x=.35; p[454].x=.65;
  p[33]={x:.4,y:.4,z:0};p[263]={x:.6,y:.45,z:0};
  const size={width:100,height:100}; const raw=facePose(p,null,size,size,false), mirror=facePose(p,null,size,size,true);
  expect(Math.abs(raw.rotation[2])).toBeLessThan(.3); expect(raw.rotation[2]).toBeCloseTo(-mirror.rotation[2]);
});
