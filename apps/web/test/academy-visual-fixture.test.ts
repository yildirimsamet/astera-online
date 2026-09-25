import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyAcademyVisualFixture } from '../src/onboarding/academyVisualFixture.js';

describe('Academy visual fixture bridge', () => {
  afterEach(() => {
    delete window.__asteraAcademyVisualFixture;
  });

  it('does nothing outside development or an explicit visual-test build', () => {
    const payload = { planets: ['real'] };
    window.__asteraAcademyVisualFixture = vi.fn(() => ({ planets: ['stress'] }));

    expect(applyAcademyVisualFixture('/api/galaxy', payload, false)).toBe(payload);
    expect(window.__asteraAcademyVisualFixture).not.toHaveBeenCalled();
  });

  it('lets the local harness replace only the requested Academy response', () => {
    const payload = { contacts: [] as string[] };
    window.__asteraAcademyVisualFixture = vi.fn((path, body) => ({
      ...(body as object),
      contacts: [path],
    }));

    expect(applyAcademyVisualFixture('/api/galaxy/traffic', payload, true)).toEqual({
      contacts: ['/api/galaxy/traffic'],
    });
  });
});
