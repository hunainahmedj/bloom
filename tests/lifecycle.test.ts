import { expect, it } from 'vitest';
import { bindPageLifecycle } from '../src/lifecycle';

it('suspends cached pages, resumes on Back, and disposes only on final exit', () => {
  const target = new EventTarget(), actions: string[] = [];
  bindPageLifecycle(target, { suspend: () => actions.push('suspend'), resume: () => actions.push('resume'), dispose: () => actions.push('dispose') });
  const dispatch = (type: string, persisted: boolean) => target.dispatchEvent(Object.assign(new Event(type), { persisted }));
  dispatch('pagehide', true); dispatch('pageshow', true); dispatch('pagehide', false);
  expect(actions).toEqual(['suspend', 'resume', 'suspend', 'dispose']);
});
