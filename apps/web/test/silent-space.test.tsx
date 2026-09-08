import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { SilentSpaceNotice } from '../src/shell/SilentSpaceNotice.js';
import type { ReturnStatus } from '../src/api/schemas.js';
import { ApiError } from '../src/api/client.js';
import i18n from '../src/i18n/index.js';
const data: ReturnStatus = { placement: { playerId: 'commander-a', version: 1, role: 'WAITING' }, homeShard: 'EU-1', canApply: true, application: null };
beforeEach(() => { localStorage.clear(); });
const props = () => ({ data, open: false, allowAutomatic: true, onClose: vi.fn(), onApply: vi.fn().mockResolvedValue(undefined) });
it('explains the move in Turkish and submits only an explicit application', async () => {
  await i18n.changeLanguage('tr');
  const p = props();
  render(<SilentSpaceNotice {...p} />);
  expect(screen.getByRole('dialog')).toHaveTextContent('48 saat');
  expect(screen.getByRole('dialog')).toHaveTextContent('ilerlemen korundu');
  expect(p.onApply).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Dönüş başvurusu yap' }));
  await waitFor(() => { expect(p.onApply).toHaveBeenCalledTimes(1); });
});
it('remembers dismissal for this placement but can be reopened from the menu', () => {
  const p = props();
  const first = render(<SilentSpaceNotice {...p} />);
  fireEvent.click(screen.getByRole('button', { name: 'Keep playing' }));
  first.unmount();
  const next = render(<SilentSpaceNotice {...p} />);
  expect(screen.queryByRole('dialog')).toBeNull();
  next.rerender(<SilentSpaceNotice {...p} open />);
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  next.rerender(<SilentSpaceNotice key="new-placement" {...p} data={{ ...data, placement: { ...data.placement!, version: 3 } }} />);
  expect(screen.getByRole('dialog')).toBeInTheDocument();
});
it('does not announce a MAIN placement and prevents duplicate queued applications', () => {
  const p = props();
  const view = render(<SilentSpaceNotice {...p} data={{ ...data, placement: { ...data.placement!, role: 'MAIN' } }} />);
  expect(screen.queryByRole('dialog')).toBeNull();
  view.rerender(<SilentSpaceNotice {...p} data={{ ...data, application: { id: 'application-a', position: 2 } }} />);
  expect(screen.getByRole('status')).toHaveTextContent('2');
  expect(screen.queryByRole('button', { name: 'Apply to return' })).toBeNull();
});
it('keeps errors visible and allows retry without announcing success', async () => {
  const p = props();
  p.onApply.mockRejectedValueOnce(new Error('offline'));
  render(<SilentSpaceNotice {...p} />);
  fireEvent.click(screen.getByRole('button', { name: 'Apply to return' }));
  await screen.findByRole('alert');
  expect(screen.getByRole('button', { name: 'Apply to return' })).toBeEnabled();
});

it('localizes a placement refusal instead of exposing the server message', async () => {
  await i18n.changeLanguage('tr');
  const p = props();
  p.onApply.mockRejectedValueOnce(new ApiError('PLACEMENT_CHANGED', 'Your galaxy changed; refresh and try again', 409));
  render(<SilentSpaceNotice {...p} />);
  fireEvent.click(screen.getByRole('button', { name: 'Dönüş başvurusu yap' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Galaksin değişti');
});
it('keeps keyboard focus inside the modal and supports Escape', () => {
  const p = props();
  render(<SilentSpaceNotice {...p} />);
  const apply = screen.getByRole('button', { name: 'Apply to return' });
  const later = screen.getByRole('button', { name: 'Keep playing' });
  expect(apply).toHaveFocus();
  fireEvent.keyDown(apply, { key: 'Tab', shiftKey: true });
  expect(later).toHaveFocus();
  fireEvent.keyDown(later, { key: 'Tab' });
  expect(apply).toHaveFocus();
  fireEvent.keyDown(apply, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();
});
