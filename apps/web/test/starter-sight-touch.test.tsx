import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Contact } from '../src/api/schemas.js';
import { InspectMark } from '../src/galaxy/StarterSightMarks.js';
import i18n from '../src/i18n/index.js';

/**
 * THE LESSON'S CRAFT IS TOUCHED, NOT THE SKY BEHIND IT (plan F6, walk 2026-11-08). The mark sits in
 * the scene's own event container: a press that reached it also reached the backdrop, and the
 * destination card opened in place of the craft.
 */
const contact: Contact = { id: 'c1', kind: 'pirate', from: { x: 0, y: 0, z: 0 }, to: { x: 10, y: 0, z: 0 }, startAt: new Date(), endAt: new Date(Date.now() + 5000) };

beforeEach(async () => { await i18n.changeLanguage('en'); });
afterEach(() => { cleanup(); });

it('opens the craft and keeps the press from the scene underneath', () => {
  const onSelect = vi.fn();
  const scene = vi.fn();
  render(<div onPointerDown={scene} onPointerUp={scene} onClick={scene}><InspectMark contact={contact} onSelect={onSelect} /></div>);
  const mark = screen.getByRole('button', { name: 'Inspect the flight' });
  expect(mark.getAttribute('data-guide')).toBe('sight-craft');
  // Owner 2026-11-08: the player has to see what is coming, so the mark draws nothing over it.
  expect(mark.querySelector('svg')).toBeNull();
  expect(mark.className).not.toMatch(/border|shadow/);
  fireEvent.pointerDown(mark);
  fireEvent.pointerUp(mark);
  fireEvent.click(mark);
  expect(onSelect).toHaveBeenCalledWith('c1');
  expect(scene).not.toHaveBeenCalled();
});
