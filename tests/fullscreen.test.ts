import { afterEach, describe, expect, it, vi } from 'vitest';
import { SceneFullscreen } from '../src/fullscreen';

afterEach(() => vi.unstubAllGlobals());

function environment(native: boolean) {
 const attributes = new Map<string, string>(), classes = new Set<string>();
 const doc = Object.assign(new EventTarget(), {
  fullscreenElement: null as HTMLElement | null,
  body: { style: { overflow: 'auto' } },
  exitFullscreen: vi.fn(async () => {
   doc.fullscreenElement = null;
   doc.dispatchEvent(new Event('fullscreenchange'));
  }),
 });
 const win = new EventTarget();
 const stage = {
  requestFullscreen: async () => {
   if (!native) throw new Error('Unsupported');
   doc.fullscreenElement = stage as unknown as HTMLElement;
   doc.dispatchEvent(new Event('fullscreenchange'));
  },
  classList: { add: (c: string) => classes.add(c), remove: (c: string) => classes.delete(c) },
 };
 const button = { setAttribute: (k: string, v: string) => attributes.set(k, v), focus: vi.fn(), title: '' };
 vi.stubGlobal('document', doc); vi.stubGlobal('window', win);
 const fullscreen = new SceneFullscreen(stage as unknown as HTMLElement, button as unknown as HTMLButtonElement);
 const escape = () => win.dispatchEvent(Object.assign(new Event('keydown', { cancelable: true }), { key: 'Escape' }));
 return { fullscreen, doc, attributes, classes, escape };
}

describe('scene fullscreen keyboard exit', () => {
 it('leaves native fullscreen when Escape reaches the page', async () => {
  const env = environment(true);
  await env.fullscreen.toggle();
  expect(env.fullscreen.active).toBe(true);
  env.escape();
  await Promise.resolve();
  expect(env.doc.exitFullscreen).toHaveBeenCalledOnce();
  expect(env.fullscreen.active).toBe(false);
  expect(env.attributes.get('aria-label')).toBe('Enter fullscreen');
  env.fullscreen.dispose();
 });

 it('leaves the fallback view and restores scrolling on Escape', async () => {
  const env = environment(false);
  await env.fullscreen.toggle();
  expect(env.classes.has('expanded')).toBe(true);
  expect(env.doc.body.style.overflow).toBe('hidden');
  env.escape();
  expect(env.fullscreen.active).toBe(false);
  expect(env.classes.has('expanded')).toBe(false);
  expect(env.doc.body.style.overflow).toBe('auto');
  expect(env.doc.exitFullscreen).not.toHaveBeenCalled();
  env.fullscreen.dispose();
 });
});
