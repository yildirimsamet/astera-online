import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { reportsSchema, type NotificationView } from '../src/api/schemas.js';
import { activeMonumentInbound, describeNotification, isAlarming, notificationIdentity, signalFamily } from '../src/lib/notifications.js';
import { BattleReportDoor, reportFor } from '../src/screens/BattleReports.js';
import { SignalsFeed } from '../src/shell/Signals.js';
import { MonumentReportSheet } from '../src/screens/MonumentReportSheet.js';

const id = '00000000-0000-4000-8000-000000000003';
const at = new Date('2026-10-04T12:00:00.000Z');
const wire = { kind: 'MONUMENT', id: 'battle-3', at, attacking: true, grade: 'PARTIAL', control: 'DEFENDER', roundCount: 5,
  monument: { id, ordinal: 3, position: { x: 6000, y: 410, z: -500 } },
  yourFleet: { CITADEL: 3, ARGOSY: 2 }, yourSurvivors: { CITADEL: 2, ARGOSY: 1 }, yourLosses: { CITADEL: 1, ARGOSY: 1 },
  yourDamage: [{ hull: 'CITADEL', count: 1, damageBp: 3000, remainderBp: 0.5 }], theirLosses: { DART: 12 }, lootDeuterium: 17.125, dominion: -123 };
let news: NotificationView[] = [];
vi.mock('../src/api/queries.js', () => ({
  useReports: () => ({ data: { reports: [wire] }, isPending: false, isError: false }),
  usePlanet: () => ({ data: undefined }),
  useMarkSeen: () => ({ mutate: vi.fn() }),
  useNotifications: () => ({ data: { notifications: news } }),
}));
const notice = (kind: string, payload: unknown): NotificationView => ({ id: 'n1', kind, payload, refId: 'battle-3', seen: false, at });
const target = { targetKind: 'MONUMENT', monumentId: id, monumentOrdinal: 3 };

describe('monument reports and actionable news', () => {
  it('explains a cargo retreat in the report and news without calling the capture repelled', () => {
    const displacement = { ...wire, grade: 'REPELLED', control: 'ATTACKER', defenderCargoRetreated: true };
    const parsed = reportsSchema.parse({ reports: [displacement], rivals: [] }).reports[0];
    if (parsed?.kind !== 'MONUMENT') throw new Error('Expected a monument report');
    expect(parsed).toHaveProperty('defenderCargoRetreated', true);
    render(<MonumentReportSheet report={parsed} onClose={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Defending cargo ships retreated.');
    expect(dialog).not.toHaveTextContent('Attack repelled.');
    const event = notice('raid_result', { ...target, attacking: true, grade: 'REPELLED', control: 'ATTACKER',
      defenderCargoRetreated: true, survivors: 1, unitsLost: 0, lootDeuterium: 0, dominion: 0 });
    expect(describeNotification(event, at.getTime())).toContain('Defending cargo ships retreated.');
  });
  it.each([[6, 'Fragmented Dyson Sphere'], [7, 'Sleeping Guardian'], [8, 'Ancient War Cemetery']] as const)(
    'keeps the new monument %i actionable in inbound news, probe deliveries and native battle reports', (ordinal, name) => {
      const added = { ...target, monumentOrdinal: ordinal };
      const inbound = notice('monument_inbound', { ...added, arriveAt: new Date(at.getTime() + 60_000).toISOString() });
      expect(activeMonumentInbound(inbound, id, at.getTime())).toBe(true);
      expect(notificationIdentity(inbound)).toEqual({ label: name, monumentId: id });
      expect(describeNotification(inbound, at.getTime())).toContain(name);
      const delivered = notice('probe_report', { ...added, observedAt: at.toISOString(), deliveredAt: at.toISOString(), accuracy: 1 });
      expect(notificationIdentity(delivered)).toEqual({ label: name, monumentId: id });
      expect(describeNotification(delivered, at.getTime())).toContain(name);
      const view = reportsSchema.parse({ reports: [{ ...wire, monument: { ...wire.monument, ordinal } }], rivals: [] });
      expect(reportFor(view.reports, 'battle-3')).toMatchObject({ monument: { ordinal } });
    });

  it('names a monument radiation casualty and the physical cargo destroyed with its ships', () => {
    const event = notice('radiation_lost', { ...target, lost: 4, left: 0, lostDeuterium: 125.5 });
    expect(describeNotification(event, at.getTime())).toMatch(/Ancient Observatory.*4.*125.5/);
    expect(notificationIdentity(event)?.monumentId).toBe(id);
  });
  it('reports the lost ships’ burned fuel shares separately from their cargo', () => {
    const event = notice('radiation_lost', { ...target, lost: 4, left: 0, lostDeuterium: 125.5, lostFuel: 83.75 });
    expect(describeNotification(event, at.getTime())).toMatch(/125.5.*fuel.*83.75/i);
  });
  it('opens a probe delivery directly on its monument and a battle on its own report', () => {
    news = [notice('probe_report', { ...target, observedAt: '2026-10-04T11:00:00.000Z', deliveredAt: at.toISOString(), accuracy: 1 })];
    const focus = vi.fn(), go = vi.fn();
    const { rerender } = render(<SignalsFeed justRead={new Set()} onGo={go} onFocusPlanet={vi.fn()} onFocusMonument={focus} />);
    fireEvent.click(screen.getByRole('button', { name: /Open related report/i }));
    expect(focus).toHaveBeenCalledWith(id);
    expect(go).not.toHaveBeenCalled();
    news = [notice('raid_result', { ...target, attacking: true, grade: 'PARTIAL', control: 'DEFENDER', survivors: 2, unitsLost: 4, lootDeuterium: 0, dominion: -123 })];
    rerender(<SignalsFeed justRead={new Set()} onGo={go} onFocusPlanet={vi.fn()} onFocusMonument={focus} />);
    fireEvent.click(screen.getByRole('button', { name: /Open related report/i }));
    expect(go).toHaveBeenCalledWith('report', 'battles', 'battle-3', undefined);
  });
  it('parses a native result and resolves its battle id without a fake mission/world', () => {
    const view = reportsSchema.parse({ reports: [wire], rivals: [] });
    expect(reportFor(view.reports, 'battle-3')).toMatchObject({ kind: 'MONUMENT', monument: { id } });
    expect(view.reports[0]).not.toHaveProperty('missionId');
  });
  it('opens the participant result with own ships, precise wound percentage, points and a monument door', () => {
    const focus = vi.fn();
    render(<BattleReportDoor missionId="battle-3" onClose={vi.fn()} onUnavailable={vi.fn()} onFocusMonument={focus} />);
    expect(screen.getByRole('dialog')).toHaveTextContent('Ancient Observatory');
    expect(screen.getByRole('dialog')).toHaveTextContent(/69.995/);
    expect(screen.getByRole('dialog')).toHaveTextContent(/123/);
    expect(screen.getByRole('dialog')).toHaveTextContent(/17.125/);
    fireEvent.click(screen.getByRole('button', { name: /Look at Ancient Observatory/i }));
    expect(focus).toHaveBeenCalledWith(id);
    expect(screen.queryByRole('img', { name: /planet/i })).toBeNull();
  });
  it('shows the battle grade and capture rules alongside control in its report', () => {
    render(<BattleReportDoor missionId="battle-3" onClose={vi.fn()} onUnavailable={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent(/partial/i);
    expect(dialog).toHaveTextContent(/not captured/i);
    expect(dialog).toHaveTextContent(/3 rounds/i);
    expect(dialog).toHaveTextContent(/42%/);
    expect(dialog).not.toHaveTextContent(/enemy.*health/i);
  });
  it('names a composition-free launch warning and identifies the actual target', () => {
    const event = notice('monument_inbound', { ...target, arriveAt: new Date(at.getTime() + 10 * 60_000).toISOString() });
    expect(describeNotification(event, at.getTime())).toMatch(/Ancient Observatory.*10/);
    expect(notificationIdentity(event)).toEqual({ label: 'Ancient Observatory', monumentId: id });
    expect(isAlarming(event)).toBe(true);
    expect(signalFamily(event)).toBe('threat');
  });
  it('stops treating a monument inbound notice as active after its ETA', () => {
    const future = notice('monument_inbound', { ...target, arriveAt: new Date(at.getTime() + 10 * 60_000).toISOString() });
    const past = notice('monument_inbound', { ...target, arriveAt: new Date(at.getTime() - 1).toISOString() });
    expect(activeMonumentInbound(future, id, at.getTime())).toBe(true);
    expect(activeMonumentInbound(future, id, at.getTime() + 10 * 60_000)).toBe(false);
    expect(activeMonumentInbound(past, id, at.getTime())).toBe(false);
    expect(activeMonumentInbound(notice('monument_inbound', target), id, at.getTime())).toBe(false);
  });
  it('distinguishes a fight’s living ships from a completed return and classifies a wiped fleet as a loss', () => {
    const payload = { ...target, attacking: true, grade: 'PARTIAL', control: 'DEFENDER', survivors: 2, unitsLost: 4, lootDeuterium: 0, dominion: -123,
      opponents: [{ kind: 'PLAYER', name: 'Tester1', clanName: 'Explorers', clanTag: 'EXP' }] };
    const event = notice('raid_result', payload);
    expect(describeNotification(event, at.getTime())).toMatch(/Ancient Observatory/);
    expect(describeNotification(event, at.getTime())).toMatch(/Tester1.*EXP/);
    expect(describeNotification(event, at.getTime())).not.toMatch(/home|returned/i);
    expect(notificationIdentity(event)?.monumentId).toBe(id);
    expect(isAlarming(notice('raid_result', { ...payload, survivors: 0 }))).toBe(true);
  });
  it('shows lost probes and distinguishes observation from delivery on successful return', () => {
    expect(describeNotification(notice('monument_probe_lost', target), at.getTime())).toMatch(/Ancient Observatory.*lost/i);
    const event = notice('probe_report', { ...target, observedAt: '2026-10-04T11:00:00.000Z', deliveredAt: at.toISOString(), accuracy: 1 });
    expect(describeNotification(event, at.getTime())).toMatch(/Ancient Observatory.*observ/i);
    expect(notificationIdentity(event)).toEqual({ label: 'Ancient Observatory', monumentId: id });
  });
  it('shows the actual native return without interpreting it as a raid', () => {
    const event = notice('fleet_returned', { ...target, trip: 'monument', craft: 3, deuterium: 17.125 });
    expect(describeNotification(event, at.getTime())).toMatch(/Ancient Observatory.*3.*17.125/);
    expect(notificationIdentity(event)?.monumentId).toBe(id);
  });
  it('reports the paid fuel refund separately from delivered cargo on a successful return', () => {
    const event = notice('fleet_returned', { ...target, trip: 'monument', craft: 3, deuterium: 17.125, fuelRefund: 83.75 });
    expect(describeNotification(event, at.getTime())).toMatch(/17.125.*fuel.*83.75/i);
  });
  it('reports the reserved fuel refunded when a monument preparation is cancelled', () => {
    const event = notice('fleet_returned', { trip: 'recalled', craft: 3, craftKind: 'fleet', fuelRefund: 83.75 });
    expect(describeNotification(event, at.getTime())).toMatch(/3.*fuel.*83.75/i);
  });
  it('explains which returning ships need repair and which were patched free', () => {
    const event = notice('fleet_returned', { ...target, trip: 'monument', craft: 3, deuterium: 0,
      docked: 2, autoRepaired: 1 });
    expect(describeNotification(event, at.getTime())).toMatch(/2.*Repair Station.*1.*patched/i);
  });
  it('reports the fuel share burned with ships destroyed in combat', () => {
    const event = notice('raid_result', { ...target, attacking: true, grade: 'REPELLED', control: 'DEFENDER',
      survivors: 0, unitsLost: 3, lootDeuterium: 0, dominion: -123, lostFuel: 83.75 });
    expect(describeNotification(event, at.getTime())).toMatch(/fuel.*83.75/i);
  });
  it('announces a capacity return immediately with its reason and ETA, without claiming the fleet is home', () => {
    const event = notice('monument_returning', { ...target, reason: 'CAPACITY', craft: 2,
      arriveAt: new Date(at.getTime() + 10 * 60_000).toISOString() });
    expect(describeNotification(event, at.getTime())).toMatch(/Ancient Observatory.*2.*no room.*10/i);
    expect(describeNotification(event, at.getTime())).not.toMatch(/is home|returned home/i);
    expect(notificationIdentity(event)?.monumentId).toBe(id);
    news = [event];
    const focus = vi.fn(), go = vi.fn();
    render(<SignalsFeed justRead={new Set()} onGo={go} onFocusPlanet={vi.fn()} onFocusMonument={focus} />);
    fireEvent.click(screen.getByRole('button', { name: /Open related report/i }));
    expect(focus).toHaveBeenCalledWith(id);
    expect(go).not.toHaveBeenCalled();
  });
});
