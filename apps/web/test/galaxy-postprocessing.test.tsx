import { render } from '@testing-library/react';
import { useLayoutEffect, type ReactNode } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { GalaxyPostprocessing } from '../src/galaxy/GalaxyPostprocessing.js';

const probe = vi.hoisted(() => ({ builds: vi.fn(), mounts: vi.fn(), unmounts: vi.fn(), props: vi.fn(), lost: false }));
vi.mock('@react-three/fiber', () => ({
  useThree: (select: (state: { gl: { getContext: () => { isContextLost: () => boolean } } }) => unknown) =>
    select({ gl: { getContext: () => ({ isContextLost: () => probe.lost }) } }),
}));
vi.mock('@react-three/postprocessing', () => ({
  EffectComposer: (props: { children: ReactNode; enabled: boolean; multisampling: number }) => {
    probe.props(props);
    useLayoutEffect(() => { probe.mounts(); return () => { probe.unmounts(); }; }, []);
    useLayoutEffect(() => { probe.builds(); }, [props.children]);
    return <>{props.children}</>;
  },
  Bloom: () => null,
  Vignette: () => null,
  wrapEffect: () => () => null,
}));
beforeEach(() => { vi.clearAllMocks(); probe.lost = false; });

it('retains effect children through parent updates and startup enablement', () => {
  const props = { live: true, epoch: 0, dprCap: 1.5, multisampling: 4, prepared: false };
  const view = render(<GalaxyPostprocessing {...props} />);
  for (let i = 0; i < 10; i++) view.rerender(<GalaxyPostprocessing {...props} />);
  expect(probe.builds).toHaveBeenCalledTimes(1);
  view.rerender(<GalaxyPostprocessing {...props} prepared />);
  expect(probe.props.mock.lastCall?.[0]).toMatchObject({ enabled: true, multisampling: 4 });
  expect(probe.builds).toHaveBeenCalledTimes(1);
  expect(probe.mounts).toHaveBeenCalledTimes(1);
});

it('rebuilds targets for resolution and restored contexts and unmounts on loss', () => {
  const props = { live: true, epoch: 0, dprCap: 1.5, multisampling: 4, prepared: true };
  const view = render(<GalaxyPostprocessing {...props} />);
  view.rerender(<GalaxyPostprocessing {...props} dprCap={2} />);
  expect(probe.mounts).toHaveBeenCalledTimes(2);
  view.rerender(<GalaxyPostprocessing {...props} live={false} />);
  expect(probe.unmounts).toHaveBeenCalledTimes(2);
  view.rerender(<GalaxyPostprocessing {...props} epoch={1} prepared={false} />);
  expect(probe.mounts).toHaveBeenCalledTimes(3);
  expect(probe.props.mock.lastCall?.[0]).toMatchObject({ enabled: false });
});

/*
  Sentry WEB-3 (2026-11-19, live d637eabf, Android): `getContextAttributes()` returned null inside
  `EffectComposer.setRenderer`. The context was already gone while `live` still said true — the
  loss event had not been delivered when React built the composer.
*/
it('does not build a composer on a context that is already lost, even before the loss event arrives', () => {
  const props = { live: true, epoch: 0, dprCap: 1.5, multisampling: 4, prepared: true };
  probe.lost = true;
  const view = render(<GalaxyPostprocessing {...props} />);
  expect(probe.mounts).not.toHaveBeenCalled();
  view.rerender(<GalaxyPostprocessing {...props} live={false} />);
  probe.lost = false;
  view.rerender(<GalaxyPostprocessing {...props} epoch={1} />);
  expect(probe.mounts).toHaveBeenCalledOnce();
});
