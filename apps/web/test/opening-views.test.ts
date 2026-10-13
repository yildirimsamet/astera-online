import { describe, expect, it } from 'vitest';
import { createOpeningViews } from '../src/galaxy/openingViewSequence.js';

describe('covered opening views', () => {
  it('draws wide, intermediate and home views before releasing the cover', () => {
    const views = createOpeningViews();
    expect(views.beforeFrame(true, true)).toBe('wide');
    expect(views.afterFrame(0, 'a', false)).toBe(false);
    expect(views.afterFrame(200, 'a', false)).toBe(false);
    expect(views.beforeFrame(true, true)).toBe('middle');
    views.afterFrame(210, 'a', false);
    views.afterFrame(410, 'a', false);
    expect(views.beforeFrame(true, true)).toBe('home');
    views.afterFrame(420, 'a', false);
    expect(views.afterFrame(620, 'a', false)).toBe(true);
    expect(views.beforeFrame(true, true)).toBe(null);
  });
  it('waits for LOD transitions and resource changes, but bounds each stage', () => {
    const views = createOpeningViews();
    views.beforeFrame(true, true);
    views.afterFrame(0, 'a', true);
    views.afterFrame(200, 'a', true);
    expect(views.beforeFrame(true, true)).toBe(null);
    views.afterFrame(300, 'b', false);
    expect(views.beforeFrame(true, true)).toBe(null);
    views.afterFrame(350, 'c', false);
    views.afterFrame(1200, 'd', true);
    expect(views.beforeFrame(true, true)).toBe('middle');
  });
  it('never moves before readiness and restores home when the cover expires or GPU is lost', () => {
    const views = createOpeningViews();
    expect(views.beforeFrame(true, false)).toBe(null);
    expect(views.beforeFrame(true, true)).toBe('wide');
    expect(views.beforeFrame(false, true)).toBe('restore');
    expect(views.beforeFrame(true, true)).toBe(null);
    const lost = createOpeningViews();
    lost.beforeFrame(true, true);
    expect(lost.beforeFrame(true, false)).toBe('restore');
  });
  it('does not run after a cover expired before preparation', () => {
    const views = createOpeningViews();
    expect(views.beforeFrame(false, false)).toBe(null);
    expect(views.beforeFrame(true, true)).toBe(null);
  });
});
