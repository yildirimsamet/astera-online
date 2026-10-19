import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { WebLandingGate } from '../src/landing/public/WebLandingGate.js';

vi.mock('../src/screens/LandingScreen.js', () => ({ LandingScreen: (props: { onBegin: () => Promise<void>; onRequestLogin?: () => boolean; open?: string }) => <>
  <button onClick={() => { void props.onBegin().catch(() => undefined); }}>Begin</button>
  <button onClick={() => { props.onRequestLogin?.(); }}>Login</button>
  {props.open ? <div role="dialog">Login form</div> : null}
</> }));
it('queues a single early training intent until session restoration has actually finished', async () => {
  const onBegin = vi.fn().mockResolvedValue(undefined);
  const props = { onBegin, onAuthenticate: vi.fn().mockResolvedValue(undefined) };
  const view = render(<WebLandingGate {...props} restoring />);
  fireEvent.click(screen.getByText('Begin')); fireEvent.click(screen.getByText('Begin'));
  expect(onBegin).not.toHaveBeenCalled();
  view.rerender(<WebLandingGate {...props} restoring={false} />);
  await waitFor(() => { expect(onBegin).toHaveBeenCalledTimes(1); });
});
it('queues login without allowing it to race the cookie restoration', async () => {
  const props = { onBegin: vi.fn().mockResolvedValue(undefined), onAuthenticate: vi.fn().mockResolvedValue(undefined) };
  const view = render(<WebLandingGate {...props} restoring />);
  fireEvent.click(screen.getByText('Login'));
  expect(screen.queryByRole('dialog')).toBeNull();
  view.rerender(<WebLandingGate {...props} restoring={false} />);
  expect(await screen.findByRole('dialog')).toBeInTheDocument();
  expect(props.onBegin).not.toHaveBeenCalled();
});
it('cancels an early intent if restoration takes the user directly to their existing game', () => {
  const onBegin = vi.fn().mockResolvedValue(undefined);
  const view = render(<WebLandingGate onBegin={onBegin} onAuthenticate={vi.fn()} restoring />);
  fireEvent.click(screen.getByText('Begin'));
  view.unmount();
  expect(onBegin).not.toHaveBeenCalled();
});
it('does not queue login alongside a training request on a slow restore', async () => {
  const props = { onBegin: vi.fn().mockResolvedValue(undefined), onAuthenticate: vi.fn().mockResolvedValue(undefined) };
  const view = render(<WebLandingGate {...props} restoring />);
  fireEvent.click(screen.getByText('Begin'));
  fireEvent.click(screen.getByText('Login'));
  view.rerender(<WebLandingGate {...props} restoring={false} />);
  await waitFor(() => { expect(props.onBegin).toHaveBeenCalledOnce(); });
  expect(screen.queryByRole('dialog')).toBeNull();
});
