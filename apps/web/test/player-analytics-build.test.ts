import { describe, expect, it } from 'vitest';
import { analyticsRevision } from '../analyticsBuild.js';
describe('analytics build attribution', () => {
  it('uses an actual revision and distinguishes an uncommitted bundle', () => {
    const rev = 'a'.repeat(40);
    expect(analyticsRevision(() => rev, () => '')).toBe(rev);
    expect(analyticsRevision(() => rev, () => ' M apps/web/src/App.tsx')).toBe(`${rev}.dirty`);
    expect(() => analyticsRevision(() => 'release', () => '')).toThrow();
  });
});

it('uses an explicit container revision without requiring a Git directory inside the image', () => {
  const git = () => { throw new Error('Git is not included in the build context'); };
  expect(analyticsRevision(git, git, 'b'.repeat(40))).toBe('b'.repeat(40));
});
