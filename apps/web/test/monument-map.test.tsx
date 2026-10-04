import { VIEW, GALAXY } from '@astera/rules';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { HpRadiationSourceView, PublicMonument } from '../src/api/schemas.js';
import { MonumentFocus } from '../src/galaxy/FocusPanel.js';
import { DISC_RADIUS } from '../src/galaxy/scene.js';
import { monumentNavigationRadius } from '../src/galaxy/monuments.js';
import { focusIdentity, focusTapDecision, sphericalLeashCorrection } from '../src/galaxy/follow.js';
import { drawnHpClouds } from '../src/lib/radiation.js';
import { GalaxyReadout } from '../src/v2/hud/GalaxyCorners.js';
import { readsForShardEvent } from '../src/session/shardEvents.js';
import { keys } from '../src/api/keys.js';

const target: PublicMonument = { id: 'monument-1', ordinal: 1, position: { x: 0, y: 7000, z: 0 },
  controller: { kind: 'NEUTRAL' }, capacity: 7270, used: 120, productionPerMinute: 60, radiationHpPerMinute: 4, emptySince: null, respawnAt: null };
const at = new Date('2026-10-04T12:00:00Z');
const cloud: HpRadiationSourceView = { id: 'cloud', mode: 'EMIT', center: target.position, radius: 1500,
  intensityHpPerMinute: 4, activeFrom: at, activeUntil: null };

describe('public monument navigation', () => {
  it('keeps the planet radius unchanged while allowing the complete outer cloud, including high Y', () => {
    expect(monumentNavigationRadius([], [])).toBe(DISC_RADIUS * 1.15);
    const radius = monumentNavigationRadius([target], [cloud]);
    expect(radius).toBeGreaterThanOrEqual(8500 / VIEW.scale);
    expect(sphericalLeashCorrection(0, 8500 / VIEW.scale, 0, radius)).toBeNull();
    expect(GALAXY.radius).toBe(4500);
  });
  it('includes a negative diagonal outer target and still leashes empty void in the same direction', () => {
    const radius = monumentNavigationRadius([{ position: { x: -7000, y: -7000, z: -7000 } }], []);
    expect(radius).toBeGreaterThan(Math.hypot(7000, 7000, 7000) / VIEW.scale);
    const correction = sphericalLeashCorrection(-radius * 2, 0, 0, radius);
    expect(correction).toEqual([-radius, 0, 0]);
  });
  it('has a stable monument focus and preserves the first LOOK, second inspect rule', () => {
    const focus = { kind: 'monument' as const, id: target.id };
    expect(focusIdentity(focus)).toBe(`monument:${target.id}`);
    expect(focusTapDecision(null, focus, null)).toEqual({ kind: 'focus', focus, detail: false });
    expect(focusTapDecision(focus, { ...focus }, null)).toEqual({ kind: 'focus', focus, detail: true });
  });
  it('opens the real detail from a closed public rail without showing the enemy roster', () => {
    const inspect = vi.fn();
    const view = render(<MonumentFocus monument={target} onInspect={inspect} onClose={vi.fn()} />);
    expect(view.container.querySelector('[data-focus-rail]')).toHaveAttribute('data-open', 'false');
    expect(screen.getByText('Abandoned Space Wreckage')).toBeInTheDocument();
    expect(screen.getByText('Neutral garrison')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    expect(inspect).toHaveBeenCalledOnce();
    expect(screen.queryByText(/Citadel/)).toBeNull();
  });
  it('lists all public monuments in the map finder and selects their actual identity', () => {
    const select = vi.fn();
    render(<GalaxyReadout counts={{ worlds: 2, fleetsAway: 0, rocks: 0, pirates: 0, wrecks: 0, monuments: 5 }}
      targets={[{ kind: 'monument', id: target.id, label: 'Abandoned Space Wreckage', detail: 'Neutral garrison' }]} onFocusTarget={select} />);
    fireEvent.click(screen.getByRole('button', { name: /5.*monument/i }));
    fireEvent.click(screen.getByRole('button', { name: /Abandoned Space Wreckage/ }));
    expect(select).toHaveBeenCalledWith({ kind: 'monument', id: target.id });
  });
  it('draws HP cloud geometry on its actual windows without converting it to percentage dose', () => {
    const clouds = [cloud, { ...cloud, id: 'future', activeFrom: new Date(at.getTime() + 1) },
      { ...cloud, id: 'ended', activeUntil: at }, { ...cloud, id: 'shelter', mode: 'SHELTER' as const }];
    expect(drawnHpClouds(clouds, at.getTime())).toEqual([cloud]);
    expect(drawnHpClouds(clouds, at.getTime() + 1).map((row) => row.id)).toEqual(['cloud', 'future']);
  });
  it('refreshes the monument catalog when public control changes', () => {
    expect(readsForShardEvent('shard:control')).toContainEqual(keys.monuments);
  });
});
