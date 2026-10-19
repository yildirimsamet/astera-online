import { expect, it, vi } from 'vitest';

vi.mock('three', () => { throw new Error('The public asset catalogue must not initialize a 3D library'); });
it('lets the front door use the shared art catalogue without importing Three.js', async () => {
  const art = await import('../src/ui/assets.js');
  expect(art.LOGO.lockup).toContain('logo-lockup.png');
  expect(art.MODEL_FACING[art.MODEL.drill]).toEqual([0.8652, -0.5010, 0.0208]);
});
