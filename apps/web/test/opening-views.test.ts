import { describe, expect, it } from 'vitest';
import { createOpeningViews } from '../src/galaxy/openingViewSequence.js';

describe('covered opening views', () => {
  it('draws wide, intermediate and home views before releasing the cover', () => {
    const views = createOpeningViews();
    expect(views.beforeFrame(true, true)).toBe('wide');
    expect(views.afterFrame(false, 0)).toBe(false);
    expect(views.afterFrame(false, 0)).toBe(false);
    expect(views.beforeFrame(true, true)).toBe('middle');
    views.afterFrame(false, 0);
    views.afterFrame(false, 0);
    expect(views.beforeFrame(true, true)).toBe('home');
    views.afterFrame(false, 0);
    expect(views.afterFrame(false, 0)).toBe(true);
    expect(views.beforeFrame(true, true)).toBe(null);
  });
  it('never advances while work is pending, even after many frames', () => {
    const views = createOpeningViews();
    views.beforeFrame(true, true);
    for (let i = 0; i < 1000; i++) views.afterFrame(true, 1);
    expect(views.beforeFrame(true, true)).toBe(null);
    views.afterFrame(false, 2);
    expect(views.beforeFrame(true, true)).toBe(null);
    views.afterFrame(false, 2);
    expect(views.beforeFrame(true, true)).toBe('middle');
  });
  it('requires two fresh draws after a newly registered task settles', () => {
    const views = createOpeningViews();
    views.beforeFrame(true, true);
    views.afterFrame(false, 0);
    views.afterFrame(false, 2);
    expect(views.beforeFrame(true, true)).toBe(null);
    views.afterFrame(false, 2);
    expect(views.beforeFrame(true, true)).toBe('middle');
  });
  it('never moves before readiness and restores home when the cover expires or GPU is lost', () => {
    const views = createOpeningViews();
    expect(views.beforeFrame(true, false)).toBe(null);
    expect(views.beforeFrame(true, true)).toBe('wide');
    expect(views.beforeFrame(false, true)).toBe('restore');
    expect(views.result).toBe('timeout');
    expect(views.beforeFrame(true, true)).toBe(null);
    const lost = createOpeningViews();
    lost.beforeFrame(true, true);
    expect(lost.beforeFrame(true, false)).toBe('restore');
    expect(lost.result).toBe('context-lost');
  });
  it('does not run after a cover expired before preparation', () => {
    const views = createOpeningViews();
    expect(views.beforeFrame(false, false)).toBe(null);
    expect(views.beforeFrame(true, true)).toBe(null);
  });
});
