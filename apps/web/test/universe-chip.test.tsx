// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UniverseChip } from '../src/starter/UniverseChip.js';
import '../src/i18n/index.js';

afterEach(cleanup);

const show = (over: Partial<Parameters<typeof UniverseChip>[0]> = {}) => {
  const onOpen = vi.fn(), onClose = vi.fn();
  render(<UniverseChip open={false} atLimit available onOpen={onOpen} onClose={onClose} {...over} />);
  return { onOpen, onClose };
};

describe('the way into the universe view', () => {
  it('is offered at the zoom limit', () => {
    const { onOpen } = show();
    fireEvent.click(screen.getByRole('button', { name: 'See the universe' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('stays out of the way before the limit', () => {
    show({ atLimit: false });
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('is not offered on a server with nothing to show', () => {
    show({ available: false });
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('becomes the way back once open, wherever the camera is', () => {
    const { onClose } = show({ open: true, atLimit: false });
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
