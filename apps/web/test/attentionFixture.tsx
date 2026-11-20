import { useAttention } from '../src/shell/attention/store.js';

/** A window that already has the screen: every surface under test must wait behind it. */
export function WindowHolder() {
  const { shown, release } = useAttention('test_window', true, { priority: 1_000, blocking: true });
  return shown ? <button type="button" onClick={() => { release('dismiss'); }}>Close the window in front</button> : null;
}

export const HOLDER_CLOSE = 'Close the window in front';
