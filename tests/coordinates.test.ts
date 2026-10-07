import { describe, expect, it } from 'vitest';
import { handGesture, mapVideoPoint, mapVideoSpan } from '../src/coordinates';

describe('shared image mapping', () => {
  it('mirrors a camera landmark once', () => {
    expect(mapVideoPoint({ x: .2, y: .6 }, { width: 100, height: 100 }, { width: 200, height: 200 }, true)).toEqual({ x: .8, y: .6 });
  });
  it('accounts for cropping the image left and right', () => {
    const p = mapVideoPoint({ x: .25, y: .5 }, { width: 200, height: 100 }, { width: 100, height: 100 }, false);
    expect(p.x).toBe(0);
    expect(p.y).toBe(.5);
  });
  it('accounts for cropping the image top and bottom', () => {
    const p = mapVideoPoint({ x: .5, y: .25 }, { width: 100, height: 200 }, { width: 100, height: 100 }, false);
    expect(p).toEqual({ x: .5, y: 0 });
  });
  it('keeps the centre stable across portrait viewport changes', () => {
    expect(mapVideoPoint({ x: .5, y: .5 }, { width: 1280, height: 720 }, { width: 390, height: 600 }, true)).toEqual({ x: .5, y: .5 });
  });
  it('normalizes pinch distance by hand size rather than camera distance', () => {
    const landmarks = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }));
    landmarks[0] = { x: .5, y: .8, z: 0 };
    landmarks[9] = { x: .5, y: .6, z: 0 };
    landmarks[4] = { x: .4, y: .4, z: 0 };
    landmarks[8] = { x: .44, y: .4, z: 0 };
    const a = handGesture(landmarks, 1);
    const b = handGesture(landmarks.map(p => ({ x: p.x * .5, y: p.y * .5, z: 0 })), 1);
    expect(a.ratio).toBeCloseTo(.2);
    expect(b.ratio).toBeCloseTo(a.ratio);
    expect(a.point.x).toBeCloseTo(.42);
  });
});

it('keeps palm clearance in the same units when cover-cropping into portrait', () => {
  expect(mapVideoSpan(.1, { width: 200, height: 100 }, { width: 100, height: 100 })).toBe(.2);
  expect(mapVideoSpan(.1, { width: 100, height: 200 }, { width: 100, height: 100 })).toBe(.1);
  const landmarks = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }));
  landmarks[0] = { x: .5, y: .8, z: 0 }; landmarks[9] = { x: .5, y: .6, z: 0 };
  expect(handGesture(landmarks, 2).palm.span).toBeCloseTo(.1);
});

it('recognizes an intentional index point, separately from an open hand',()=>{
 const hand=Array.from({length:21},()=>({x:0,y:0,z:0}));hand[0]={x:0,y:.09,z:0};
 for(const [n,k] of [5,9,13,17].entries()){
  const x=-.045+n*.03;
  hand[k]={x,y:0,z:0};hand[k+1]={x,y:-.04,z:0};
  hand[k+2]={x,y:-.015,z:.025};hand[k+3]={x,y:.015,z:.03};
 }
 hand[6]={x:-.045,y:-.04,z:0};hand[7]={x:-.045,y:-.08,z:0};hand[8]={x:-.045,y:-.12,z:0};
 expect(handGesture(hand,1,hand).uiPointing).toBe(true);
 hand[4]={...hand[8]};expect(handGesture(hand,1,hand).uiPointing).toBe(false);
 hand[4]={x:.07,y:.01,z:0};
 for(const k of [9,13,17])for(let j=1;j<=3;j++)hand[k+j]={x:hand[k].x,y:-j*.04,z:0};
 expect(handGesture(hand,1,hand).uiPointing).toBe(false);
});
