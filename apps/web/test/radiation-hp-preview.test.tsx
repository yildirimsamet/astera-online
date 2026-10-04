import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '../src/i18n/index.js';
import { RadiationPreview } from '../src/ui/RadiationPreview.js';
import type { HpRouteRadiation } from '../src/lib/radiation.js';

beforeEach(async () => { await i18n.changeLanguage('en'); });
const hp: HpRouteRadiation = { kind: 'HP', doseHp: 400.25, destroyed: 2, lostFleet: { DART: 2 }, docks: true,
  lots: [{ hull: 'CITADEL', count: 1, maxHp: 2158, remainingHp: 1757.75, healthPct: 81.453, needsDock: false },
    { hull: 'ARGOSY', count: 1, maxHp: 1350, remainingHp: 949.75, healthPct: 70.3518, needsDock: true }] };
describe('the commitment radiation reading', () => {
  it('shows HP per ship, each hull’s own health, its repair outcome and actual lost craft', () => {
    render(<RadiationPreview radiation={hp} combat />);
    expect(screen.getByText(/400.25 HP per ship/)).toBeVisible();
    expect(screen.getByText(/1× Citadel/)).toHaveTextContent('81.45%');
    expect(screen.getByText(/1× Argosy/)).toHaveTextContent('70.35%');
    expect(screen.getByText(/1× Argosy/).parentElement).toHaveTextContent(/Repair Station/);
    expect(screen.getByText(/destroys 2 ships/)).toBeVisible();
    expect(screen.getByText(/Combat may add damage/)).toBeVisible();
  });
  it('keeps the established percentage reading and shows no warning for no exposure', () => {
    const { rerender } = render(<RadiationPreview radiation={{ doseBp: 3000, pct: 30, docks: true, destroyed: 0 }} />);
    expect(screen.getByText(/30%/)).toHaveTextContent(/Repair Station/);
    rerender(<RadiationPreview radiation={null} />);
    expect(document.querySelector('[data-radiation-warning]')).toBeNull();
  });
});
