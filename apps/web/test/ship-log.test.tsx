import { REPAIR_LADDER, openingProgress } from '@astera/rules';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { vesselSchema } from '../src/api/starterSchemas.js';
import { ShipLog } from '../src/starter/ShipLog.js';
import { wireVessel } from './starterVesselFixture.js';

afterEach(cleanup);

/**
 * THE SHIP'S LOG (owner 2026-11-06: the menu had no guidance). The story in chapters: what each one
 * is for, where the ship stands in it, and a way to the one that is now.
 */
describe('the ship\'s log in the menu', () => {
  it('tells the story in order: power done, the refinery now, the rest ahead', () => {
    render(<ShipLog vessel={vesselSchema.parse(wireVessel())} onOpenShip={vi.fn()} />);
    const chapters = screen.getAllByTestId('log-chapter');
    expect(chapters.map(c => c.getAttribute('data-chapter'))).toEqual(['POWER', 'REFINERY', 'SURVEY', 'DEFENCE', 'CARGO', 'DRIVE']);
    expect(chapters.map(c => c.getAttribute('data-state'))).toEqual(['done', 'now', 'ahead', 'ahead', 'ahead', 'ahead']);
    expect(chapters[1]?.textContent).toMatch(/alloy/i);
  });

  it('moves "now" along as the ship is repaired, and opens the ship from it', () => {
    const modules: Record<string, number> = {};
    for (const s of REPAIR_LADDER) if (s.required && s.system === 'REFINERY') modules[s.module] = Math.max(modules[s.module] ?? 0, s.stage);
    const open = vi.fn();
    render(<ShipLog vessel={vesselSchema.parse(wireVessel({ progress: { ...openingProgress(), modules } }))} onOpenShip={open} />);
    const now = screen.getAllByTestId('log-chapter').find(c => c.getAttribute('data-state') === 'now');
    expect(now?.getAttribute('data-chapter')).not.toBe('REFINERY');
    expect(screen.getAllByTestId('log-chapter')[1]?.getAttribute('data-state')).toBe('done');
    fireEvent.click(screen.getByTestId('log-go'));
    expect(open).toHaveBeenCalledTimes(1);
  });
});
