import { render } from '@testing-library/react';
import { useLayoutEffect, type ReactNode } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { GalaxyPostprocessing } from '../src/galaxy/GalaxyPostprocessing.js';

const probe = vi.hoisted(() => ({ builds: vi.fn(), mounts: vi.fn(), unmounts: vi.fn(), props: vi.fn() }));
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
beforeEach(() => { vi.clearAllMocks(); });

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
