import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { asteroidSchema } from '../src/api/schemas.js';
import { AsteroidFocus } from '../src/galaxy/FocusPanel.js';
import i18n from '../src/i18n/index.js';

/**
 * KİŞİSEL KAYA ON THE CARD (playtest 2026-11-23):
 * The server still tags personal rocks (`personal: true`) so the 3D scene can draw a subtle faint
 * ring, but the focus card intentionally avoids meta-language ("Your rock: only you see it...").
 */
const ROCK = {
  id: 'mJtQH0vR5cP8sN2xK7dL4A', level: 1, ore: 1000, oreRemaining: 1000, crystalShare: 0.35, radius: 5_000, period: 10_000, phase: 0.2,
  inclination: 0, ascendingNode: 0, speed: 3, appearsAt: 0, expiresAt: 360, active: true, isotopeRich: false, deuteriumShare: null,
};
const shell = { onClose: vi.fn(), busy: false, open: true, onToggle: vi.fn(), craftReadyAt: null, run: undefined, onSend: vi.fn() };
const card = (personal: boolean) => render(
  <AsteroidFocus rock={personal ? { ...ROCK, personal: true } : ROCK} isotopeAccess={false} craftAvailable={1} craftHold={200}
    derrick={false} derrickHold={500} minutesLeft={300} reachMinutes={0.4} atHome={() => null} {...shell} />,
);

beforeEach(async () => { await i18n.changeLanguage('en'); });
afterEach(cleanup);

describe('a rock of your own', () => {
  it('reads from the server with its mark, and without it as before', () => {
    expect(asteroidSchema.parse({ ...ROCK, personal: true }).personal).toBe(true);
    expect(asteroidSchema.parse(ROCK).personal).toBeUndefined();
  });

  it('does not show meta ownership labels on the focus card for either personal or shared rocks', () => {
    card(true);
    expect(screen.queryByTestId('personal-rock')).toBeNull();
    cleanup();
    card(false);
    expect(screen.queryByTestId('personal-rock')).toBeNull();
  });
});
