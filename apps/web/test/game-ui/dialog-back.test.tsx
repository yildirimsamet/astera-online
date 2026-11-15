import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { Dialog } from '../../src/game-ui/index.js';

/** C28: a kit dialog answers the phone's Back as its own way out, when it is given one. */
it("closes on the phone's Back when it has a way out", () => {
  const onBack = vi.fn();
  render(<Dialog ribbon="Silent Space" onBack={onBack}>body</Dialog>);
  const event = new Event('astera:native-back', { cancelable: true });
  fireEvent(screen.getByRole('dialog'), event);
  expect(onBack).toHaveBeenCalledOnce();
  expect(event.defaultPrevented).toBe(true);
});

it("leaves the phone's Back alone when it has none", () => {
  render(<Dialog ribbon="Rank up">body</Dialog>);
  const event = new Event('astera:native-back', { cancelable: true });
  fireEvent(screen.getByRole('dialog'), event);
  expect(event.defaultPrevented).toBe(false);
});
