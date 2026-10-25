import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { BattleReplayData, BattleSide } from '@astera/rules';
import { BattleReplay } from '../src/battle-simulator/BattleReplay.js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import BattleReplayDialog from '../src/battle-simulator/BattleReplayDialog.js';
import { DEFAULT_SCENARIO, simulateScenario } from '../src/battle-simulator/scenario.js';
import { buildReplayTimeline, sampleReplay } from '../src/battle-simulator/timeline.js';
import { battleReplayResponseSchema } from '../src/api/battleReplaySchemas.js';

vi.mock('../src/api/context.js', () => ({ useApi: () => ({ battleReplay: () => Promise.resolve({ viewer: 'DEFENCE', replay: frozen() }) }) }));

vi.mock('../src/battle-simulator/BattleStage.js', () => ({ BattleStage: ({ timeline, onSelect, viewer }: {
  timeline: { recording: BattleReplayData['recording'] }; onSelect: (id: string) => void; viewer: BattleSide;
}) => <div data-testid="viewer" data-side={viewer}>{timeline.recording.ships.map(ship => <button key={ship.id} onClick={() => { onSelect(ship.id); }}>Pick {ship.id}</button>)}</div> }));
const frozen = (): BattleReplayData => {
  const simulation = simulateScenario(DEFAULT_SCENARIO);
  return { recording: simulation.recording, result: simulation.result, environment: simulation.environment,
    aegisCapacity: simulation.aegisCapacity, defenceOffline: false, escape: null, control: null,
    owners: simulation.recording.ships.map(ship => ({ side: ship.side, playerId: ship.playerId, stackId: ship.stackId,
      wing: 3, research: { SHIP_POWER: 8, SHIP_SHIELDS: 2 } })) };
};

describe('frozen real battle presentation', () => {
  it('parses the replay contract and rejects malformed recorded damage and dangling targets', () => {
    const response = { viewer: 'DEFENCE', replay: frozen() };
    expect(battleReplayResponseSchema.parse(response).viewer).toBe('DEFENCE');
    const invalid = structuredClone(response);
    invalid.replay.recording.rounds[0]!.attackerShots[0]!.hits[0]!.hpAfter = -1;
    expect(battleReplayResponseSchema.safeParse(invalid).success).toBe(false);
    const dangling = structuredClone(response);
    dangling.replay.recording.rounds[0]!.attackerShots[0]!.hits[0]!.targetId = 'unknown';
    expect(battleReplayResponseSchema.safeParse(dangling).success).toBe(false);
    const duplicate = structuredClone(response);
    duplicate.replay.recording.rounds[0]!.after[1] = duplicate.replay.recording.rounds[0]!.after[0]!;
    expect(battleReplayResponseSchema.safeParse(duplicate).success).toBe(false);
  });

  it('starts with the real viewer below and reads the frozen research by stack rather than current scenario owners', () => {
    const data = frozen(), target = data.recording.ships[0]!;
    // Same player, distinct historical stacks: do not select the first player's research.
    data.owners.unshift({ ...data.owners[0]!, stackId: 'different-stack', wing: 1, research: { SHIP_POWER: 1 } });
    render(<BattleReplay simulation={data} environment={data.environment} initialViewer="DEFENCE" />);
    expect(screen.getByTestId('viewer')).toHaveAttribute('data-side', 'DEFENCE');
    fireEvent.click(screen.getByRole('button', { name: `Pick ${target.id}` }));
    const card = screen.getByRole('region', { name: 'Selected unit' });
    expect(card).toHaveTextContent('Fleet 3'); expect(card).toHaveTextContent('Ship Power 8');
  });

  it('distinguishes the reader ships from allied ships without private player identities', () => {
    const data = frozen(), own = data.recording.ships.find(ship => ship.side === 'ATTACK')!;
    const ally = data.recording.ships.find(ship => ship.side === 'DEFENCE')!;
    ally.side = 'ATTACK'; data.owners.find(owner => owner.stackId === ally.stackId)!.side = 'ATTACK';
    render(<BattleReplay simulation={data} environment={data.environment} ownPlayerIds={[own.playerId]} />);
    fireEvent.click(screen.getByRole('button', { name: `Pick ${own.id}` }));
    expect(screen.getByRole('region', { name: 'Selected unit' })).toHaveTextContent('Your fleet');
    fireEvent.click(screen.getByRole('button', { name: `Pick ${ally.id}` }));
    expect(screen.getByRole('region', { name: 'Selected unit' })).toHaveTextContent('Allied fleet');
  });

  it('shows all shield opening strikes before normal fire, without reducing any ship health', () => {
    const data = frozen(), timeline = buildReplayTimeline(data.recording);
    const opening = timeline.events.filter(event => event.kind === 'AEGIS_STRIKE');
    expect(opening.length).toBeGreaterThan(0);
    const normal = timeline.events.find(event => event.kind === 'SHOT')!;
    expect(opening.every(event => event.at < normal.at)).toBe(true);
    const frame = sampleReplay(timeline, opening[0]!.at);
    expect(frame.phase).toBe('AEGIS_OPENING');
    expect(frame.damageBadges).toEqual([]);
    for (const ship of data.recording.ships) expect(frame.ships.get(ship.id)?.hp).toBe(ship.hp);
    expect(frame.aegisBonusDamage).toBeGreaterThan(0);
    render(<BattleReplay simulation={data} environment={data.environment} />);
    fireEvent.change(screen.getByLabelText('Battle timeline'), { target: { value: String(opening[0]!.at) } });
    expect(document.querySelector('[data-combat-phase="AEGIS_OPENING"]')).toHaveTextContent('Nullifier shield opening');
    expect(document.querySelector('[data-combat-phase="AEGIS_OPENING"]')).toHaveTextContent('Shield only · no ship damage');
  });

  it('keeps the real reader identity and verdict when the camera swaps sides', () => {
    const data = frozen(), own = data.recording.ships.find(ship => ship.side === 'DEFENCE')!;
    render(<BattleReplay simulation={data} environment={data.environment} initialViewer="DEFENCE" ownPlayerIds={[own.playerId]} />);
    const timeline = buildReplayTimeline(data.recording);
    fireEvent.change(screen.getByLabelText('Battle timeline'), { target: { value: String(timeline.duration) } });
    const result = [...document.querySelectorAll('.sim-result')].map(node => node.textContent);
    fireEvent.click(screen.getByRole('button', { name: 'Switch perspective' }));
    expect([...document.querySelectorAll('.sim-result')].map(node => node.textContent)).toEqual(result);
  });
  it('explains personal annihilation even when allied ships win the battle', () => {
    const data = frozen(), own = data.recording.ships.find(ship => ship.side === 'ATTACK')!;
    for (const ship of data.recording.ships) if (ship.side === 'ATTACK' && ship.id !== own.id) { ship.playerId = 'ally'; ship.stackId = 'ally-stack'; }
    for (const state of data.recording.rounds.at(-1)!.after) {
      const ship = data.recording.ships.find(ship => ship.id === state.id)!;
      state.status = ship.side === 'DEFENCE' || ship.id === own.id ? 'DESTROYED' : 'ACTIVE';
      state.hp = state.status === 'DESTROYED' ? 0 : ship.maxHp;
    }
    data.result.grade = 'DECISIVE';
    render(<BattleReplay simulation={data} environment={data.environment} ownPlayerIds={[own.playerId]} />);
    fireEvent.change(screen.getByLabelText('Battle timeline'), { target: { value: String(buildReplayTimeline(data.recording).duration) } });
    expect(screen.getByText('Your fleet was destroyed.')).toBeInTheDocument();
    expect(document.querySelectorAll('.sim-result').length).toBeGreaterThan(1);
  });

  it('closes only the shot log on Escape before closing the real replay', async () => {
    const close = vi.fn(), client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><BattleReplayDialog kind="BATTLE" id="battle" onClose={close} /></QueryClientProvider>);
    fireEvent.click(await screen.findByRole('button', { name: 'Shot log' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Shot log' })).toHaveAttribute('aria-expanded', 'false');
    fireEvent.keyDown(document, { key: 'Escape' }); expect(close).toHaveBeenCalledTimes(1);
  });

  it('returns from the shot log on native Back without closing or minimising the replay', async () => {
    const close = vi.fn(), client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><BattleReplayDialog kind="BATTLE" id="battle" onClose={close} /></QueryClientProvider>);
    fireEvent.click(await screen.findByRole('button', { name: 'Shot log' }));
    const log = screen.getByLabelText('Shot log', { selector: 'aside' });
    const back = new Event('astera:native-back', { cancelable: true, bubbles: true });
    fireEvent(log, back);
    expect(back.defaultPrevented).toBe(true); expect(close).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Shot log' })).toHaveAttribute('aria-expanded', 'false');
  });

  it.each(['PIRATE_OVERRUN', 'CARGO_WITHDRAWAL'] as const)('plays %s after the last round without inventing a shot', kind => {
    const data = frozen(), ship = data.recording.ships.find(ship => ship.hull === 'COURIER')!;
    const last = data.recording.rounds.at(-1)!;
    const state = last.after.find(state => state.id === ship.id)!;
    state.hp = ship.maxHp; state.status = 'ACTIVE';
    data.recording.aftermath = [{ kind, shipIds: [ship.id] }];
    data.recording.finalState = last.after.map(state => state.id === ship.id
      ? { ...state, status: kind === 'PIRATE_OVERRUN' ? 'DESTROYED' : 'RETREATED', hp: kind === 'PIRATE_OVERRUN' ? 0 : state.hp, shield: kind === 'PIRATE_OVERRUN' ? 0 : state.shield } : state);
    const timeline = buildReplayTimeline(data.recording), end = timeline.rounds.at(-1)!.end;
    expect(sampleReplay(timeline, end + .1).phase).toBe('AFTERMATH');
    expect(timeline.events.filter(event => event.kind === 'SHOT' && event.at >= end)).toEqual([]);
    expect([...sampleReplay(timeline, timeline.duration).ships.values()]).toEqual(data.recording.finalState);
    expect(sampleReplay(timeline, 0).retreats).toEqual([]);
    render(<BattleReplay simulation={data} environment={data.environment} />);
    fireEvent.change(screen.getByLabelText('Battle timeline'), { target: { value: String(timeline.duration) } });
    if (kind === 'CARGO_WITHDRAWAL') expect(within(screen.getByRole('region', { name: 'Retreated · alive, out of combat' })).getByText(/After combat/)).toBeInTheDocument();
    else expect(screen.getByText('Without their escort, the surviving pirate cargo ships were destroyed after combat.')).toBeInTheDocument();
  });
});
