import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { monumentsSchema, reportsSchema } from '../src/api/schemas.js';
import { IntelScreen } from '../src/screens/IntelScreen.js';
import { BattleReportDoor, BattleReports } from '../src/screens/BattleReports.js';
import { MonumentSheet } from '../src/screens/MonumentSheet.js';
import { planetView } from './fixtures.js';

const battleId = '57ca7390-373f-44bc-bedd-02260e82660a';
const notificationId = '15758617-863b-4ea7-9c7d-753662d747e2';
function setup() {
  const api = new Api();
  const marked = vi.spyOn(api, 'markSeen').mockResolvedValue({ marked: 1 });
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  const result = reportsSchema.parse({ reports: [{ kind: 'MONUMENT', id: battleId, at: new Date(),
    monument: { id: '68af7958-61b8-4f14-a5c1-34f692be7987', ordinal: 4, position: { x: 0, y: 0, z: 0 } },
    attacking: true, grade: 'REPELLED', control: 'DEFENDER', roundCount: 3,
    yourFleet: { CORSAIR: 2, ARGOSY: 1 }, yourSurvivors: { CORSAIR: 2, ARGOSY: 1 }, yourLosses: {},
    yourDamage: [], theirLosses: { CORSAIR: 1 }, lootDeuterium: 0, dominion: 7040,
  }], rivals: [] });
  client.setQueryData(['reports'], result);
  client.setQueryData(['intel'], { watching: [], probeReports: [], radarLog: [], probeCooldowns: [], probeCost: { alloy: 0, crystal: 0 } });
  client.setQueryData(['galaxy'], { planets: [], sensors: [] });
  client.setQueryData(['planet'], planetView());
  client.setQueryData(['notifications'], { notifications: [
    { id: notificationId, refId: battleId, kind: 'raid_result', seen: false, payload: {}, at: new Date() },
  ] });
  return { marked, client, api, result };
}

it('leaves a battle unread in Watch and the probe shelf, then reads the shown battle list', async () => {
  const f = setup();
  render(<QueryClientProvider client={f.client}><ApiProvider api={f.api}><IntelScreen /></ApiProvider></QueryClientProvider>);
  expect(f.marked).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('tab', { name: 'Reports' }));
  expect(f.marked).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('tab', { name: /Battle reports/i }));
  await waitFor(() => { expect(f.marked).toHaveBeenCalledWith([notificationId]); });
});

it('keeps a failed report list unread even when its stale cache contains the report', async () => {
  const f = setup();
  vi.spyOn(f.api, 'reports').mockRejectedValue(new Error('offline'));
  await act(async () => { await f.client.fetchQuery({ queryKey: ['reports'], queryFn: f.api.reports, staleTime: 0 }).catch(() => undefined); });
  render(<QueryClientProvider client={f.client}><ApiProvider api={f.api}><BattleReports /></ApiProvider></QueryClientProvider>);
  expect(f.marked).not.toHaveBeenCalled();
});

it('marks only the exact report opened through its notification door', async () => {
  const f = setup();
  render(<QueryClientProvider client={f.client}><ApiProvider api={f.api}>
    <BattleReportDoor missionId={battleId} onClose={vi.fn()} onUnavailable={vi.fn()} />
  </ApiProvider></QueryClientProvider>);
  expect(screen.getByRole('dialog')).toHaveTextContent(/not captured.*repelled/i);
  await waitFor(() => { expect(f.marked).toHaveBeenCalledWith([notificationId]); });
});

it('does not acknowledge the obscured list when opening one requested report', async () => {
  const f = setup();
  f.client.setQueryData(['reports'], { ...f.result, reports: [f.result.reports[0], { ...f.result.reports[0], id: 'other-battle' }] });
  f.client.setQueryData(['notifications'], { notifications: [
    { id: notificationId, kind: 'raid_result', refId: battleId, seen: false, at: new Date(), payload: {} },
    { id: 'other', kind: 'raid_result', refId: 'other-battle', seen: false, at: new Date(), payload: {} },
  ] });
  render(<QueryClientProvider client={f.client}><ApiProvider api={f.api}>
    <BattleReports open={{ missionId: battleId, request: 1 }} />
  </ApiProvider></QueryClientProvider>);
  await waitFor(() => { expect(f.marked).toHaveBeenCalledWith([notificationId]); });
  expect(f.marked).toHaveBeenCalledTimes(1);
});

it('reads only the displayed probe dispatch, keeping a battle and a later probe unread', async () => {
  const f = setup();
  const missionId = '00000000-0000-4000-8000-000000000003';
  f.client.setQueryData(['intel'], { watching: [], radarLog: [], probeCost: { alloy: 0, crystal: 0 },
    probeReports: [{ missionId, targetPlanetId: 'q0', targetName: 'World', targetUsername: 'Opponent', at: new Date(),
      accuracy: 1, stock: { low: 0, high: 0 }, defence: { low: 0, high: 0 }, fleetSize: { low: 0, high: 0 },
      fleetHome: true, detected: false }] });
  f.client.setQueryData(['notifications'], { notifications: [
    { id: notificationId, kind: 'probe_report', refId: missionId, seen: false, at: new Date(), payload: {} },
    { id: 'later', kind: 'probe_report', refId: 'later-probe', seen: false, at: new Date(), payload: {} },
    { id: 'battle', kind: 'raid_result', refId: battleId, seen: false, at: new Date(), payload: {} },
  ] });
  render(<QueryClientProvider client={f.client}><ApiProvider api={f.api}>
    <IntelScreen open={{ stop: 'probes', request: 1 }} />
  </ApiProvider></QueryClientProvider>);
  await waitFor(() => { expect(f.marked).toHaveBeenCalledWith([notificationId]); });
  expect(f.marked).toHaveBeenCalledTimes(1);
});

it('acknowledges a monument probe only when its delivered observation is shown', async () => {
  const f = setup();
  const monumentId = '68af7958-61b8-4f14-a5c1-34f692be7987';
  const probeId = '00000000-0000-4000-8000-000000000003';
  const data = monumentsSchema.parse({ serverNow: new Date(), waves: [], probes: [],
    monuments: [{ id: monumentId, ordinal: 4, position: { x: 6000, y: 0, z: 0 }, controller: { kind: 'NEUTRAL' },
      capacity: 7270, used: 0, reserved: 0, productionPerMinute: 60, emptySince: null }],
    probeReports: [{ id: probeId, monumentId, fleet: { ARGOSY: 1 }, accuracy: 1, observedAt: new Date(), deliveredAt: new Date() }],
  });
  f.client.setQueryData(['monuments'], data);
  vi.spyOn(f.api, 'monuments').mockResolvedValue(data);
  f.client.setQueryData(['notifications'], { notifications: [
    { id: notificationId, kind: 'probe_report', refId: probeId, seen: false, at: new Date(), payload: {} },
  ] });
  render(<QueryClientProvider client={f.client}><ApiProvider api={f.api}>
    <MonumentSheet monumentId={monumentId} origin={planetView()} playerId="self" clanId={null} onClose={vi.fn()} />
  </ApiProvider></QueryClientProvider>);
  await waitFor(() => { expect(f.marked).toHaveBeenCalledWith([notificationId]); });
});
