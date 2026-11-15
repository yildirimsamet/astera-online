import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { MonumentSheet } from '../src/screens/MonumentSheet.js';
import { planetView } from './fixtures.js';

/**
 * C22 (2026-11-15): the monument sheet on the game kit. What is priced, what the server is
 * asked and when a hold commits are unchanged; the holds weigh what they cost.
 */
const id = '00000000-0000-4000-8000-000000000001';
const waveId = '00000000-0000-4000-8000-000000000002';
const at = new Date().toISOString();
const later = new Date(Date.now() + 3_600_000).toISOString();
const monument = { id, ordinal: 1, position: { x: 6000, y: 0, z: 0 }, controller: { kind: 'NEUTRAL' },
  capacity: 7270, used: 120, reserved: 30, productionPerMinute: 60, emptySince: null, difficulty: 'HARD', radiationHpPerMinute: 5 };
const lot = { id: '00000000-0000-4000-8000-000000000003', hull: 'ARGOSY', count: 2, damageBp: 2500, remainderBp: 0,
  maxHp: 1350, remainingHp: 1012.5, deuterium: 300, cargoCapacity: 600 };
const held = { id: waveId, monumentId: id, playerId: 'self', originPlanetId: 'home', rootWaveId: null, jointOperationId: null,
  status: 'HOLD', purpose: 'ATTACK', sentAt: at, heldAt: at, arriveAt: null, position: monument.position, route: [], tech: {},
  fleet: { ARGOSY: 2 }, lots: [lot], deuterium: 300, productionPerMinute: 15, fillsAt: later, nextLossAt: later,
  returnForecast: { homePlanetId: 'home', arriveAt: later, minutes: 60, doseHp: 100, destroyed: 0, deuterium: 300, lostDeuterium: 0, lots: [lot] } };
const catalog = { serverNow: at, monuments: [monument], waves: [held], probes: [],
  probeReports: [{ id: 'r1', monumentId: id, observedAt: at, deliveredAt: at, fleet: { CITADEL: 3 }, accuracy: 1 }] };
const quote = { fuel: 120, arriveAt: later, travelMinutes: 60, room: { used: 120, reserved: 30, total: 7270, after: 200 },
  bays: { used: 1, total: 3 }, shieldWouldDrop: true, outboundForecast: { doseHp: 500, destroyed: 1, fleet: { CITADEL: 1 },
    health: [{ hull: 'CITADEL', count: 2, maxHp: 2000, remainingHp: 1500, damageBp: 2500, remainderBp: 0 }] } };

const show = () => {
  const fetch: typeof globalThis.fetch = vi.fn((url: string | URL | Request) => {
    const path = typeof url === 'string' ? url : url instanceof URL ? url.pathname : url.url;
    const body = path.endsWith('/api/commander-ship') ? { capitalPlanetId: 'home', rulesetVersion: 18, ship: null }
      : path.endsWith('/recall/quote') ? { fleet: { ARGOSY: 1 }, deuterium: 150, arriveAt: later, minutes: 60, doseHp: 100, destroyed: 0,
        arrivalDeuterium: 150, lots: [lot], arrivalLots: [] }
        : path.endsWith('/quote') ? quote : catalog;
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['season'], { honorSoloCredit: false });
  const origin = planetView({ fleet: { CITADEL: 2, ARGOSY: 2 } }, { id: 'home', deuterium: 1000 });
  render(<QueryClientProvider client={client}><ApiProvider api={new Api({ fetch })}>
    <MonumentSheet monumentId={id} origin={origin} playerId="self" clanId={null} onClose={vi.fn()} onClanTarget={vi.fn()} />
  </ApiProvider></QueryClientProvider>);
};
const legacy = /text-v2-|border-v2-|bg-v2-|font-v2-|rounded-control|text-micro|text-caption|(?<![\w-])(?:plate|truncate)(?![\w-])/;
const noLegacy = (node: Element) => {
  for (const el of [node, ...node.querySelectorAll('*')]) expect(el.getAttribute('class') ?? '').not.toMatch(legacy);
};
const holdMs = (button: HTMLElement): string => button.style.getPropertyValue('--gk-hold-ms');

describe('the monument sheet on the kit (C22)', () => {
  it('opens in the kit frame with the monument’s facts in a kit well', async () => {
    show();
    const facts = await screen.findByTestId('monument-target');
    expect(facts).toHaveClass('gk-well');
    expect(document.querySelector('.gk-sheet')).not.toBeNull();
    noLegacy(facts);
  });

  it('picks each hull on a kit row and prices the flight in a kit well, its consents kit switches', async () => {
    show();
    const row = await screen.findByTestId('monument-hull-CITADEL');
    noLegacy(row);
    const count = within(row).getByRole('textbox', { name: /citadel.*quantity/i });
    expect(count).toHaveClass('gk-qty__field');
    fireEvent.change(count, { target: { value: '1' } });
    const priced = await screen.findByTestId('monument-quote');
    expect(priced).toHaveClass('gk-well');
    noLegacy(priced);
    expect(within(priced).getByRole('switch', { name: /shield/i })).toHaveAttribute('aria-checked', 'false');
    expect(within(priced).getByRole('switch', { name: /radiation/i })).toHaveAttribute('aria-checked', 'false');
  });

  it('commits with kit holds weighed by what they cost: the wave and the probe spend, the recall reverses', async () => {
    show();
    const card = await screen.findByTestId(`monument-wave-${waveId}`);
    noLegacy(card);
    expect(card.querySelector('.gk-hold')).toHaveClass('gk-hold--md');
    fireEvent.change(within(card).getByRole('textbox', { name: /argosy.*recall/i }), { target: { value: '1' } });
    await vi.waitFor(() => { expect(holdMs(within(card).getByRole('button', { name: /recall.*hold/i }))).toBe('600ms'); });
    const probe = screen.getByTestId('monument-probe');
    noLegacy(probe);
    expect(holdMs(within(probe).getByRole('button', { name: /probe.*hold/i }))).toBe('1000ms');
    fireEvent.change(screen.getByRole('textbox', { name: /citadel.*quantity/i }), { target: { value: '1' } });
    const send = within(screen.getByTestId('monument-send')).getByRole('button');
    expect(send).toHaveClass('gk-hold', 'gk-btn--lg');
  });

  it('keeps the last probe report in a kit well', async () => {
    show();
    const report = await screen.findByTestId('monument-report');
    expect(report).toHaveClass('gk-well');
    noLegacy(report);
  });
});
