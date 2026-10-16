import { describe, expect, it } from 'vitest';
import type { Contact } from '../src/api/schemas.js';
import { contactHeadingAim, contactPosition, toWorld } from '../src/galaxy/scene.js';

/**
 * A MISSILE KEEPS ITS NOSE DOWN ITS OWN LINE. Owner report, 2026-10-16: *"Füzeler gezegene
 * vurmadan bir iki saniye önce resimdeki gibi yana dönüp tekrar geri düzeliyorlar. Hem ölüm
 * yıldızı hem de radyasyon füzeleri."*
 *
 * A stranger's craft is drawn from short bearing windows. When one runs out before the next
 * read lands, the craft coasts past the window's far point so it does not stop dead — and it
 * used to be aimed AT that point, which was then behind it, so it slewed round towards its own
 * tail and back again when the next window came. Near a target the windows are shortest, which
 * is why it happened in the last seconds.
 */

const window = (over: Partial<Contact> = {}): Contact => ({
  id: 'strike', kind: 'death_star',
  from: { x: 0, y: 0, z: 0 }, to: { x: 400, y: 0, z: 300 },
  startAt: new Date(10_000), endAt: new Date(12_000),
  ...over,
});

const ahead = (aim: readonly number[], at: readonly number[], contact: Contact): number => {
  const from = toWorld(contact.from);
  const to = toWorld(contact.to);
  return (aim[0]! - at[0]!) * (to[0] - from[0]) + (aim[1]! - at[1]!) * (to[1] - from[1]) + (aim[2]! - at[2]!) * (to[2] - from[2]);
};

describe('where a stranger’s craft points', () => {
  it('points down its window while inside it', () => {
    const contact = window();
    const at = contactPosition(contact, 11_000);
    expect(ahead(contactHeadingAim(contact, at, 11_000), at, contact)).toBeGreaterThan(0);
  });

  it('keeps pointing forward while it coasts past the window’s far end', () => {
    const contact = window();
    const at = contactPosition(contact, 13_500);
    const end = toWorld(contact.to);
    // It really is past the far point: aiming at that point would turn it round.
    expect(ahead(end, at, contact)).toBeLessThan(0);
    expect(ahead(contactHeadingAim(contact, at, 13_500), at, contact)).toBeGreaterThan(0);
  });

  it('offers no heading for a window that does not move', () => {
    const held = window({ to: { x: 0, y: 0, z: 0 } });
    const at = contactPosition(held, 11_000);
    expect(contactHeadingAim(held, at, 11_000)).toEqual(at);
  });
});
