import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PROBE } from '@astera/rules';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { keys } from '../src/api/keys.js';
import {
  useBuild, useBuildDeathStar, useBuildInterceptor, useCancelBuildOrder, useCancelRepair, useClaimReward, useClanActions, useClanSupportActions,
  useClanWarActions, useCollect, useCompleteResearch,
  useFleetArrivals, useHarvest, useInstallSatellite, useLaunch, useLaunchDeathStar, useLaunchIntergalacticConvoy,
  useLaunchTrade, useMine, useMiningArrivals, useMonumentActions,
  usePlanet, useProbe, useRaidPirate, useRaiseInstrument, useRepairFault, useSettlement, useStartRepair,
  useSetDefencePosture, useTransfer, useUpgrade,
} from '../src/api/queries.js';
import { planetSchema, type PlanetView, type PlanetsView } from '../src/api/schemas.js';
import { useWorld, WorldProvider } from '../src/api/world.js';
import { worksAt } from '../src/lib/projection.js';
import { resetClock } from '../src/lib/clock.js';
import { shareStructure } from '../src/api/structural.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { HudTop } from '../src/v2/shell/HudTop.js';
import { RewardsScreen } from '../src/screens/RewardsScreen.js';
import { useEventStream } from '../src/session/useEventStream.js';
import { useArrivals } from '../src/session/useArrivals.js';
import { planetView } from './fixtures.js';

const epoch = new Date('2026-10-05T12:00:00Z').getTime();
const stamped = (id: string, alloy: number, crystal = 120, deuterium = 135, at = epoch): PlanetView =>
  planetSchema.parse(planetView({}, { id, alloy, crystal, deuterium, snapshotAt: new Date(at) }));

const list = (planets: PlanetView[]): PlanetsView => ({
  playerId: 'player-1', seasonId: 'season-1', capitalPlanetId: 'capital', planets,
});

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

function Readings() {
  const active = usePlanet();
  const world = useWorld();
  const selected = world.worlds.find((view) => view.planet.id === world.activePlanetId);
  return <>
    <output aria-label="header">{JSON.stringify(active.data?.planet)}</output>
    <output aria-label="owned world">{JSON.stringify(selected?.planet)}</output>
    <button type="button" onClick={() => { world.selectPlanet('colony'); }}>Colony</button>
  </>;
}

function LiveReadings() {
  useEventStream(true);
  return <Readings />;
}

function Actions() {
  const upgrade = useUpgrade();
  const collect = useCollect();
  return <>
    <button type="button" onClick={() => { upgrade.mutate('REFINERY'); }}>Spend</button>
    <button type="button" onClick={() => { collect.mutate(); }}>Collect</button>
  </>;
}

function ResourceActions() {
  const originId = useWorld().activePlanetId ?? 'capital';
  const upgrade = useUpgrade();
  const build = useBuild();
  const research = useCompleteResearch();
  const instrument = useRaiseInstrument();
  const satellite = useInstallSatellite();
  const collect = useCollect();
  const refund = useCancelBuildOrder();
  const reward = useClaimReward();
  const clan = useClanActions();
  const repair = useStartRepair();
  const launch = useLaunch();
  const trade = useLaunchTrade(originId);
  const transfer = useTransfer(originId);
  const probe = useProbe();
  const pirate = useRaidPirate();
  const mine = useMine();
  const harvest = useHarvest();
  const settlement = useSettlement();
  const deathStar = useBuildDeathStar();
  const interceptor = useBuildInterceptor();
  const strike = useLaunchDeathStar();
  const convoy = useLaunchIntergalacticConvoy(originId);
  const none = { alloy: 0, crystal: 0, deuterium: 0 };
  return <>
    <button onClick={() => { upgrade.mutate('REFINERY'); }}>Upgrade</button>
    <button onClick={() => { build.mutate({ hull: 'DART', count: 1 }); }}>Build</button>
    <button onClick={() => { research.mutate('PROSPECTOR_HOLDS'); }}>Research</button>
    <button onClick={() => { instrument.mutate('AEGIS'); }}>Instrument</button>
    <button onClick={() => { satellite.mutate('UPLINK'); }}>Satellite</button>
    <button onClick={() => { collect.mutate(); }}>Collect works</button>
    <button onClick={() => { refund.mutate('order-1'); }}>Refund</button>
    <button onClick={() => { reward.mutate('CORE:3'); }}>Reward</button>
    <button onClick={() => { clan.claimDepot.mutate(); }}>Depot</button>
    <button onClick={() => { repair.mutate({ planetId: 'capital', request: { all: true } }); }}>Repair</button>
    <button onClick={() => { launch.mutate({ targetPlanetId: 'target', fleet: { DART: 1 } }); }}>Raid</button>
    <button onClick={() => { trade.mutate({ occurrenceId: 'merchant', fleet: { COURIER: 1 }, give: none, want: none }); }}>Trade</button>
    <button onClick={() => { transfer.mutate({ targetPlanetId: 'colony', fleet: { COURIER: 1 }, cargo: none, returnPlan: { cargoShips: 'RETURN', otherShips: 'STAY' } }); }}>Transfer</button>
    <button onClick={() => { probe.mutate('target'); }}>Probe</button>
    <button onClick={() => { pirate.mutate({ pirateId: 'pirate', fleet: { DART: 1 } }); }}>Pirate</button>
    <button onClick={() => { mine.mutate({ asteroidId: 'rock', craft: 1 }); }}>Mine</button>
    <button onClick={() => { harvest.mutate({ fieldId: 'wreck', craft: 1 }); }}>Salvage</button>
    <button onClick={() => { settlement.mutate('target'); }}>Settle</button>
    <button onClick={() => { deathStar.mutate(); }}>Build Death Star</button>
    <button onClick={() => { interceptor.mutate(); }}>Build Interceptor</button>
    <button onClick={() => { strike.mutate('target'); }}>Strike</button>
    <button onClick={() => { convoy.mutate({ occurrenceId: 'convoy', fleet: { DART: 1 }, quotedAt: new Date(epoch), quotedFlightSeconds: 60, quotedArriveAt: new Date(epoch + 60_000), idempotencyKey: 'launch' }); }}>Convoy</button>
  </>;
}

const topHandlers = {
  onCommander: () => undefined, onRewards: () => undefined, onWorlds: () => undefined,
  onEconomy: () => undefined, onBell: () => undefined, nowOpen: false,
  onNow: () => undefined, onFocusCraft: () => undefined,
};

describe('one resource snapshot per owned world', () => {
  let client: QueryClient;
  let api: Api;
  const capital = stamped('capital', 1_505);
  const colony = stamped('colony', 700, 80, 3);
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>
    <ApiProvider api={api}><WorldProvider>{children}</WorldProvider></ApiProvider>
  </QueryClientProvider>;

  beforeEach(() => {
    localStorage.clear();
    resetClock();
    client = new QueryClient({ defaultOptions: { queries: { retry: false, structuralSharing: shareStructure }, mutations: { retry: false } } });
    client.setQueryData(keys.planets, list([capital, colony]));
    client.setQueryData(keys.planetById('capital'), capital);
    client.setQueryData(keys.planetById('colony'), colony);
    api = new Api({ fetch: () => Promise.reject(new Error('unexpected fetch')) });
  });
  afterEach(() => { client.clear(); vi.useRealTimers(); });

  it('shares single-world changes with every owned-world reader', async () => {
    render(<Readings />, { wrapper });
    await waitFor(() => { expect(screen.getByLabelText('header')).toHaveTextContent('"alloy":1505'); });
    act(() => { client.setQueryData(keys.planetById('capital'), stamped('capital', 536, 500, 2, epoch + 1_000)); });
    await waitFor(() => {
      expect(screen.getByLabelText('header')).toHaveTextContent('"alloy":536');
      expect(screen.getByLabelText('owned world')).toHaveTextContent('"alloy":536');
      expect(screen.getByLabelText('owned world')).toHaveTextContent('"deuterium":2');
    });
  });

  it('shares the pending spend and its rollback with list-backed sheets', async () => {
    const initial = planetView({
      buildings: { CORE: 3, REFINERY: 1, EXTRACTOR: 1, VAULT: 0, SHIPYARD: 0 },
      nextCosts: { REFINERY: { alloy: 969, crystal: 100, deuterium: 133 } },
    }, { ...capital.planet, bufferAlloy: 0, alloyPerHour: 0, crystalPerHour: 0 });
    client.setQueryData(keys.planetById('capital'), initial);
    const pending = deferred<unknown>();
    api.upgrade = vi.fn().mockReturnValue(pending.promise);
    render(<><Readings /><Actions /></>, { wrapper });
    await userEvent.click(screen.getByRole('button', { name: 'Spend' }));
    await waitFor(() => {
      expect(screen.getByLabelText('header')).toHaveTextContent('"alloy":536');
      expect(screen.getByLabelText('owned world')).toHaveTextContent('"alloy":536');
      expect(screen.getByLabelText('owned world')).toHaveTextContent('"deuterium":2');
    });
    await act(async () => { pending.reject(new Error('Refused')); await pending.promise.catch(() => undefined); });
    await waitFor(() => {
      expect(screen.getByLabelText('header')).toHaveTextContent('"alloy":1505');
      expect(screen.getByLabelText('owned world')).toHaveTextContent('"alloy":1505');
    });
  });

  it.each([
    ['planet', 'success'], ['planet', 'failure'], ['worlds', 'success'], ['worlds', 'failure'],
  ] as const)('reconciles a %s credit received during a pending purchase after %s', async (source, outcome) => {
    const initial = planetView({
      buildings: { CORE: 3, REFINERY: 1, EXTRACTOR: 1, VAULT: 0, SHIPYARD: 0 },
      nextCosts: { REFINERY: { alloy: 969, crystal: 100, deuterium: 133 } },
    }, { ...capital.planet, bufferAlloy: 0, alloyPerHour: 0, crystalPerHour: 0 });
    client.setQueryData(keys.planetById('capital'), initial);
    const pending = deferred<unknown>();
    api.upgrade = vi.fn().mockReturnValue(pending.promise);
    const latestAt = Date.now() + 10_000;
    const incoming = stamped('capital', outcome === 'success' ? 900 : 1_905, 500, 12, latestAt);
    api.planet = vi.fn().mockResolvedValue(incoming);
    api.planets = vi.fn().mockResolvedValue(list([incoming, colony]));
    render(<><Readings /><Actions /></>, { wrapper });
    await userEvent.click(screen.getByRole('button', { name: 'Spend' }));
    await waitFor(() => { expect(api.upgrade).toHaveBeenCalledOnce(); });
    await act(async () => {
      await client.refetchQueries({ queryKey: source === 'planet' ? keys.planetById('capital') : keys.planets });
    });
    expect(screen.getByLabelText('header')).toHaveTextContent('"alloy":536');
    await act(async () => {
      if (outcome === 'success') pending.resolve({ planet: stamped('capital', 536, 20, 2, latestAt - 1_000) });
      else pending.reject(new Error('Refused'));
      await pending.promise.catch(() => undefined);
    });
    await waitFor(() => {
      expect(screen.getByLabelText('header')).toHaveTextContent(`"alloy":${incoming.planet.alloy}`);
      expect(screen.getByLabelText('owned world')).toHaveTextContent('"deuterium":12');
    });
  });

  it('normalizes fresh list reads into existing world caches, including inactive worlds', async () => {
    const changedCapital = stamped('capital', 536, 500, 2, epoch + 1_000);
    const changedColony = stamped('colony', 900, 140, 20, epoch + 1_000);
    api.planets = vi.fn().mockResolvedValue(list([changedCapital, changedColony]));
    render(<Readings />, { wrapper });
    await act(async () => { await client.refetchQueries({ queryKey: keys.planets }); });
    await waitFor(() => {
      expect(screen.getByLabelText('header')).toHaveTextContent('"alloy":536');
      expect(screen.getByLabelText('owned world')).toHaveTextContent('"deuterium":2');
    });
    expect(client.getQueryData(keys.planetById('colony'))).toEqual(changedColony);
    await userEvent.click(screen.getByRole('button', { name: 'Colony' }));
    await waitFor(() => {
      expect(screen.getByLabelText('header')).toHaveTextContent('"alloy":900');
      expect(screen.getByLabelText('owned world')).toHaveTextContent('"alloy":900');
    });
  });

  it('accepts a newer list snapshot after a single-world read changes the cache during the request', async () => {
    const pending = deferred<PlanetsView>();
    api.planets = vi.fn().mockReturnValue(pending.promise);
    render(<Readings />, { wrapper });
    act(() => { void client.refetchQueries({ queryKey: keys.planets }); });
    await waitFor(() => { expect(api.planets).toHaveBeenCalledOnce(); });
    act(() => { client.setQueryData(keys.planetById('capital'), stamped('capital', 536, 500, 2, epoch + 1_000)); });
    const newest = stamped('capital', 900, 600, 12, epoch + 2_000);
    await act(async () => { pending.resolve(list([newest, colony])); await pending.promise; });
    await waitFor(() => {
      expect(screen.getByLabelText('header')).toHaveTextContent('"alloy":900');
      expect(screen.getByLabelText('owned world')).toHaveTextContent('"deuterium":12');
    });
  });

  it('rejects older server snapshots even when their GET finishes last', async () => {
    const recent = stamped('capital', 536, 500, 2, epoch + 1_000);
    client.setQueryData(keys.planetById('capital'), recent);
    api.planet = vi.fn().mockResolvedValue(capital);
    render(<Readings />, { wrapper });
    await act(async () => { await client.refetchQueries({ queryKey: keys.planetById('capital') }); });
    expect(client.getQueryData(keys.planetById('capital'))).toEqual(recent);
    expect(screen.getByLabelText('header')).toHaveTextContent('"alloy":536');
    expect(screen.getByLabelText('owned world')).toHaveTextContent('"alloy":536');
  });

  it.each(['fleet_returned', 'raided', 'private:clan-aid'])('refreshes all resource readers when %s arrives', async (event) => {
    let latest = capital;
    let fire = (_kind: string): void => undefined;
    api.stream = vi.fn<Api['stream']>().mockImplementation((onEvent, _signal, onOpen) => {
      fire = onEvent;
      onOpen?.();
      return new Promise(() => undefined);
    });
    api.planet = vi.fn().mockImplementation(() => Promise.resolve(latest));
    api.planets = vi.fn().mockImplementation(() => Promise.resolve(list([latest, colony])));
    render(<LiveReadings />, { wrapper });
    await waitFor(() => { expect(screen.getByLabelText('header')).toHaveTextContent('"alloy":1505'); });
    latest = stamped('capital', 536, 500, 2, epoch + 1_000);
    act(() => { fire(event); });
    await waitFor(() => {
      expect(screen.getByLabelText('header')).toHaveTextContent('"alloy":536');
      expect(screen.getByLabelText('owned world')).toHaveTextContent('"deuterium":2');
    });
  });

  it('refreshes stock on returning to the tab even inside the usual stale window', async () => {
    let latest = capital;
    api.stream = vi.fn<Api['stream']>().mockReturnValue(new Promise(() => undefined));
    api.planet = vi.fn().mockImplementation(() => Promise.resolve(latest));
    api.planets = vi.fn().mockImplementation(() => Promise.resolve(list([latest, colony])));
    render(<LiveReadings />, { wrapper });
    await waitFor(() => { expect(screen.getByLabelText('header')).toHaveTextContent('"alloy":1505'); });
    latest = stamped('capital', 0, 0, 0, epoch + 1_000);
    act(() => { window.dispatchEvent(new Event('focus')); });
    await waitFor(() => {
      expect(screen.getByLabelText('header')).toHaveTextContent('"alloy":0');
      expect(screen.getByLabelText('owned world')).toHaveTextContent('"deuterium":0');
    });
  });

  it('heals a missed incoming credit without an SSE event or another player action', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(epoch);
    client.setQueryData(keys.planets, list([capital, colony]));
    client.setQueryData(keys.planetById('capital'), capital);
    client.setQueryData(keys.planetById('colony'), colony);
    const credited = stamped('capital', 2_400, 750, 145, epoch + 1_000);
    api.planets = vi.fn().mockResolvedValue(list([credited, colony]));
    const view = render(<Readings />, { wrapper });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(api.planets).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(60_050); });
    expect(api.planets).toHaveBeenCalledOnce();
    expect(screen.getByLabelText('header')).toHaveTextContent('"alloy":2400');
    expect(screen.getByLabelText('owned world')).toHaveTextContent('"deuterium":145');
    view.unmount();
  });

  it.each(['chase', 'fleet', 'mining'])('updates an inactive world at a known %s arrival even when the SSE event is missed', async (source) => {
    vi.useFakeTimers();
    vi.setSystemTime(epoch);
    client.setQueryData(keys.planets, list([capital, colony]));
    client.setQueryData(keys.planetById('capital'), capital);
    client.setQueryData(keys.planetById('colony'), colony);
    const credited = stamped('capital', 1_905, 150, 145, epoch + 1_000);
    api.planets = vi.fn().mockResolvedValue(list([credited, colony]));
    api.planet = vi.fn().mockResolvedValue(colony);
    const { result, unmount } = renderHook(() => {
      const landing = new Date(epoch + 1_000);
      useArrivals(source === 'chase' ? [landing] : []);
      useFleetArrivals(source === 'fleet' ? [{
        kind: 'fleet', leg: 'return', targetName: 'Home', minutesRemaining: 1 / 60, arriveAt: landing,
      }] : []);
      useMiningArrivals(source === 'mining' ? [{
        id: 'run', targetKind: 'asteroid', asteroidId: 'rock', debrisFieldId: null, craft: 1,
        status: 'returning', departAt: new Date(epoch), arriveAt: new Date(epoch), homeAt: landing,
        intercept: { x: 0, y: 0, z: 0 }, minedAlloy: 400, minedCrystal: 30, minedDeuterium: 10,
      }] : []);
      return { world: useWorld(), planet: usePlanet() };
    }, { wrapper });
    act(() => { result.current.world.selectPlanet('colony'); });
    await act(async () => { await vi.advanceTimersByTimeAsync(source === 'chase' ? 1_500 : 2_100); });
    expect(api.planets).toHaveBeenCalledOnce();
    expect(result.current.planet.data?.planet.id).toBe('colony');
    expect(result.current.planet.data?.planet.alloy).toBe(700);
    expect(result.current.world.worlds.find((view) => view.planet.id === 'capital')?.planet.alloy).toBe(1_905);
    expect(client.getQueryData<PlanetView>(keys.planetById('capital'))?.planet.deuterium).toBe(145);
    unmount();
  });

  it.each([true, false])('checks reward capacity at the capital while a colony is selected (overflow: %s)', async (overflow) => {
    client.setQueryData(keys.planetById('capital'), stamped('capital', overflow ? 1_900 : 700));
    client.setQueryData(keys.planetById('colony'), stamped('colony', overflow ? 700 : 1_900));
    client.setQueryData(keys.rewards, {
      chains: [{ id: 'PROBE', metric: 'count', progress: 1,
        tiers: [{ id: 'PROBE:1', goal: 1, alloy: 200, crystal: 0, state: 'claimable' }] }], claimable: 1,
    });
    render(<ToastProvider><Readings /><RewardsScreen commander="Samet" /></ToastProvider>, { wrapper });
    await userEvent.click(screen.getByRole('button', { name: 'Colony' }));
    await waitFor(() => { expect(screen.getByLabelText('header')).toHaveTextContent('"id":"colony"'); });
    expect(screen.queryByText(/nothing is lost/i) !== null).toBe(overflow);
  });

  it('does not let a stale list response overwrite an authoritative collection', async () => {
    const read = deferred<PlanetsView>();
    api.planets = vi.fn().mockReturnValue(read.promise);
    const collected = stamped('capital', 1_905, 150, 145, epoch + 1_000);
    api.collect = vi.fn().mockResolvedValue({ planet: collected });
    render(<><Readings /><Actions /></>, { wrapper });
    act(() => { void client.refetchQueries({ queryKey: keys.planets }); });
    await waitFor(() => { expect(api.planets).toHaveBeenCalledOnce(); });
    await userEvent.click(screen.getByRole('button', { name: 'Collect' }));
    await waitFor(() => { expect(screen.getByLabelText('header')).toHaveTextContent('"alloy":1905'); });
    await act(async () => { read.resolve(list([capital, colony])); await read.promise; });
    expect(client.getQueryData(keys.planetById('capital'))).toEqual(collected);
    expect(screen.getByLabelText('owned world')).toHaveTextContent('"alloy":1905');
  });

  it('does not normalize even newer balances from a cancelled world read', async () => {
    const read = deferred<PlanetsView>();
    api.planets = vi.fn().mockReturnValue(read.promise);
    render(<Readings />, { wrapper });
    act(() => { void client.refetchQueries({ queryKey: keys.planets }); });
    await waitFor(() => { expect(api.planets).toHaveBeenCalledOnce(); });
    await act(async () => { await client.cancelQueries({ queryKey: keys.planets }); });
    await act(async () => {
      read.resolve(list([stamped('capital', 900, 500, 12, Date.now() + 1_000),
        stamped('colony', 900, 500, 12, Date.now() + 1_000)]));
      await read.promise;
    });
    expect(client.getQueryData<PlanetView>(keys.planetById('capital'))?.planet.alloy).toBe(1_505);
    expect(client.getQueryData<PlanetView>(keys.planetById('colony'))?.planet.alloy).toBe(700);
  });

  it('resumes server reads when a collection answer exactly matches its prediction', async () => {
    const ready = planetView({}, { ...capital.planet, bufferAlloy: 100, alloyPerHour: 0, crystalPerHour: 0 });
    client.setQueryData(keys.planetById('capital'), ready);
    const answer = deferred<unknown>();
    api.collect = vi.fn().mockReturnValue(answer.promise);
    api.planet = vi.fn().mockResolvedValue(stamped('capital', 536, 500, 2, epoch + 86_400_000));
    const { result } = renderHook(() => ({ collect: useCollect(), planet: usePlanet(), world: useWorld() }), { wrapper });
    await waitFor(() => { expect(result.current.world.activePlanetId).toBe('capital'); });
    act(() => { result.current.collect.mutate(); });
    await waitFor(() => { expect(api.collect).toHaveBeenCalledOnce(); });
    const predicted = client.getQueryData<PlanetView>(keys.planetById('capital'));
    await act(async () => { answer.resolve({ planet: planetSchema.parse(predicted) }); await answer.promise; });
    await waitFor(() => { expect(result.current.collect.isSuccess).toBe(true); });
    await act(async () => { await client.refetchQueries({ queryKey: keys.planetById('capital') }); });
    expect(client.getQueryData<PlanetView>(keys.planetById('capital'))?.planet.alloy).toBe(536);
  });

  it('keeps a newer server update when an older depot claim answer arrives', async () => {
    const claim = deferred<unknown>();
    api.claimClanDepot = vi.fn().mockReturnValue(claim.promise);
    const { result } = renderHook(() => useClanActions(), { wrapper });
    await waitFor(() => { expect(client.getQueryData(keys.planetById('capital'))).toEqual(capital); });
    act(() => { result.current.claimDepot.mutate(); });
    await waitFor(() => { expect(api.claimClanDepot).toHaveBeenCalledOnce(); });
    const newest = stamped('capital', 536, 500, 2, epoch + 2_000);
    act(() => { client.setQueryData(keys.planetById('capital'), newest); });
    await act(async () => {
      claim.resolve({ planet: stamped('capital', 1_905, 150, 145, epoch + 1_000) });
      await claim.promise;
    });
    await waitFor(() => { expect(result.current.claimDepot.isSuccess).toBe(true); });
    expect(client.getQueryData(keys.planetById('capital'))).toEqual(newest);
  });

  it.each([
    ['Upgrade', 'upgrade'], ['Collect works', 'collect'], ['Build', 'build'], ['Research', 'completeResearch'],
    ['Instrument', 'raiseInstrument'], ['Satellite', 'installSatellite'], ['Refund', 'cancelBuildOrder'],
    ['Raid', 'launch'], ['Trade', 'trade'], ['Transfer', 'transfer'], ['Probe', 'probe'],
    ['Pirate', 'raidPirate'], ['Mine', 'mine'], ['Salvage', 'harvest'], ['Settle', 'settle'],
    ['Build Death Star', 'buildDeathStar'], ['Build Interceptor', 'buildInterceptor'],
    ['Strike', 'launchDeathStar'], ['Convoy', 'launchIntergalacticConvoy'],
  ] as const)('keeps a queued %s on the world where it was requested after selection changes', async (action, methodName) => {
    const pending = deferred<unknown>();
    const answer = { planet: stamped('capital', 900, 500, 12, Date.now() + 2_000), pending: [], mining: { runs: [], isotopes: [] } };
    api.upgrade = vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValue(answer);
    api.collect = vi.fn().mockResolvedValue(answer);
    api.build = vi.fn().mockResolvedValue(answer);
    api.completeResearch = vi.fn().mockResolvedValue(answer);
    api.raiseInstrument = vi.fn().mockResolvedValue(answer);
    api.installSatellite = vi.fn().mockResolvedValue(answer);
    api.cancelBuildOrder = vi.fn().mockResolvedValue(answer);
    api.launch = vi.fn().mockResolvedValue(answer);
    api.trade = vi.fn().mockResolvedValue(answer);
    api.transfer = vi.fn().mockResolvedValue(answer);
    api.probe = vi.fn().mockResolvedValue(answer);
    api.raidPirate = vi.fn().mockResolvedValue(answer);
    api.mine = vi.fn().mockResolvedValue(answer);
    api.harvest = vi.fn().mockResolvedValue(answer);
    api.settle = vi.fn().mockResolvedValue(answer);
    api.buildDeathStar = vi.fn().mockResolvedValue(answer);
    api.buildInterceptor = vi.fn().mockResolvedValue(answer);
    api.launchDeathStar = vi.fn().mockResolvedValue(answer);
    api.launchIntergalacticConvoy = vi.fn().mockResolvedValue(answer);
    api.planets = vi.fn().mockResolvedValue(list([answer.planet, colony]));
    api.planet = vi.fn().mockImplementation((id) => Promise.resolve(id === 'colony' ? colony : answer.planet));
    render(<><Readings /><ResourceActions /></>, { wrapper });
    await userEvent.click(screen.getByRole('button', { name: 'Upgrade' }));
    await waitFor(() => { expect(api.upgrade).toHaveBeenCalledOnce(); });
    await userEvent.click(screen.getByRole('button', { name: action }));
    await userEvent.click(screen.getByRole('button', { name: 'Colony' }));
    await waitFor(() => { expect(screen.getByLabelText('header')).toHaveTextContent('"id":"colony"'); });
    const method = vi.mocked(api[methodName]);
    expect(method).toHaveBeenCalledTimes(methodName === 'upgrade' ? 1 : 0);
    await act(async () => {
      pending.resolve({ planet: stamped('capital', 536, 20, 2, Date.now() + 1_000) });
      await pending.promise;
    });
    await waitFor(() => { expect(method).toHaveBeenCalledTimes(methodName === 'upgrade' ? 2 : 1); });
    const call = method.mock.calls[methodName === 'upgrade' ? 1 : 0];
    if (methodName === 'launchIntergalacticConvoy') expect(call?.[0]).toMatchObject({ originPlanetId: 'capital' });
    else expect(call).toContain('capital');
    await waitFor(() => {
      expect(client.getQueryData<PlanetView>(keys.planetById('capital'))?.planet.alloy).toBe(900);
    });
    expect(client.getQueryData<PlanetView>(keys.planetById('colony'))?.planet.alloy).toBe(700);
  });

  it.each(['success', 'failure'] as const)('lets an old-world queue continue while the newly selected world has a pending %s', async (outcome) => {
    const first = deferred<unknown>();
    const other = deferred<unknown>();
    const collected = stamped('capital', 900, 500, 12, Date.now() + 2_000);
    api.upgrade = vi.fn().mockImplementation((id) => id === 'capital' ? first.promise : other.promise);
    api.collect = vi.fn().mockResolvedValue({ planet: collected });
    const { result } = renderHook(() => ({
      world: useWorld(), upgrade: useUpgrade(), collect: useCollect(),
    }), { wrapper });
    act(() => { result.current.upgrade.mutate('REFINERY'); });
    await waitFor(() => { expect(api.upgrade).toHaveBeenCalledTimes(1); });
    act(() => { result.current.collect.mutate(); });
    act(() => { result.current.world.selectPlanet('colony'); });
    await waitFor(() => { expect(result.current.world.activePlanetId).toBe('colony'); });
    act(() => { result.current.upgrade.mutate('REFINERY'); });
    await waitFor(() => { expect(api.upgrade).toHaveBeenCalledTimes(2); });
    await act(async () => { first.resolve({ planet: stamped('capital', 536, 20, 2, Date.now() + 1_000) }); await first.promise; });
    try {
      await waitFor(() => { expect(api.collect).toHaveBeenCalledOnce(); });
      expect(vi.mocked(api.collect).mock.calls[0]).toEqual(['capital']);
      await waitFor(() => { expect(result.current.collect.isSuccess).toBe(true); });
      expect(client.getQueryData<PlanetView>(keys.planetById('capital'))?.planet.alloy).toBe(900);
    } finally {
      await act(async () => {
        if (outcome === 'success') other.resolve({ planet: stamped('colony', 600, 70, 2, Date.now() + 3_000) });
        else other.reject(new Error('Refused'));
        await other.promise.catch(() => undefined);
      });
    }
    await waitFor(() => { expect(result.current.upgrade.isPending).toBe(false); });
    expect(result.current.collect.isPaused).toBe(false);
  });

  it('waits for a probe spend to reconcile before predicting the next purchase', async () => {
    const initial = planetView({
      buildings: { CORE: 3, REFINERY: 1, EXTRACTOR: 1, VAULT: 0, SHIPYARD: 0 },
      nextCosts: { REFINERY: { alloy: 969, crystal: 10, deuterium: 0 } },
    }, { ...capital.planet, bufferAlloy: 0, alloyPerHour: 0, crystalPerHour: 0 });
    const spent: PlanetView = { ...initial, planet: { ...initial.planet,
      alloy: initial.planet.alloy - PROBE.alloy, crystal: initial.planet.crystal - PROBE.crystal,
      snapshotAt: new Date(Date.now() + 1_000) } };
    const planetRead = deferred<PlanetView>();
    const worldsRead = deferred<PlanetsView>();
    const purchase = deferred<unknown>();
    client.setQueryData(keys.planetById('capital'), initial);
    api.probe = vi.fn().mockResolvedValue({ missionId: 'probe-1' });
    api.planet = vi.fn().mockReturnValue(planetRead.promise);
    api.planets = vi.fn().mockReturnValue(worldsRead.promise);
    api.upgrade = vi.fn().mockReturnValue(purchase.promise);
    const { result } = renderHook(() => ({ planet: usePlanet(), probe: useProbe(), upgrade: useUpgrade() }), { wrapper });
    act(() => { result.current.probe.mutate('target'); });
    await waitFor(() => { expect(api.planets).toHaveBeenCalledOnce(); expect(api.planet).toHaveBeenCalledOnce(); });
    await act(async () => {
      result.current.upgrade.mutate('REFINERY');
      await new Promise((resolve) => setTimeout(resolve, 25));
    });
    try {
      expect(api.upgrade).not.toHaveBeenCalled();
      expect(result.current.planet.data?.planet.alloy).toBe(1_505);
    } finally {
      await act(async () => {
        planetRead.resolve(spent); worldsRead.resolve(list([spent, colony]));
        await Promise.all([planetRead.promise, worldsRead.promise]);
      });
    }
    await waitFor(() => { expect(api.upgrade).toHaveBeenCalledOnce(); });
    expect(result.current.planet.data?.planet.alloy).toBe(spent.planet.alloy - 969);
    await act(async () => { purchase.resolve({ planet: stamped('capital', 500, 20, 2, Date.now() + 2_000) }); await purchase.promise; });
    await waitFor(() => { expect(result.current.upgrade.isSuccess).toBe(true); });
  });

  it.each(['before', 'during'] as const)('keeps another world\'s incoming credit when its read started %s a purchase', async (when) => {
    const read = deferred<PlanetsView>();
    const purchase = deferred<unknown>();
    const credited = stamped('colony', 900, 140, 20, Date.now() + 2_000);
    const purchased = stamped('capital', 536, 20, 2, Date.now() + 1_000);
    api.planets = vi.fn().mockReturnValue(read.promise);
    api.upgrade = vi.fn().mockReturnValue(purchase.promise);
    const { result } = renderHook(() => ({ world: useWorld(), upgrade: useUpgrade() }), { wrapper });
    const startRead = async (): Promise<void> => {
      act(() => { void client.refetchQueries({ queryKey: keys.planets }); });
      await waitFor(() => { expect(api.planets).toHaveBeenCalledOnce(); });
    };
    if (when === 'before') await startRead();
    act(() => { result.current.upgrade.mutate('REFINERY'); });
    await waitFor(() => { expect(api.upgrade).toHaveBeenCalledOnce(); });
    if (when === 'during') await startRead();
    await act(async () => { purchase.resolve({ planet: purchased }); await purchase.promise; });
    await waitFor(() => { expect(result.current.upgrade.isSuccess).toBe(true); });
    await act(async () => { read.resolve(list([capital, credited])); await read.promise; });
    await waitFor(() => {
      expect(result.current.world.worlds.find((view) => view.planet.id === 'colony')?.planet.alloy).toBe(900);
    });
    expect(client.getQueryData<PlanetView>(keys.planetById('capital'))?.planet.alloy).toBe(536);
  });

  it('keeps the selected world through resource refresh when device storage is unavailable', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Unavailable'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Unavailable'); });
    const credited = stamped('colony', 900, 140, 20, Date.now() + 1_000);
    api.planets = vi.fn().mockResolvedValue(list([capital, credited]));
    api.planet = vi.fn().mockResolvedValue(colony);
    const { result } = renderHook(() => ({ world: useWorld(), planet: usePlanet() }), { wrapper });
    act(() => { result.current.world.selectPlanet('colony'); });
    await waitFor(() => { expect(result.current.world.activePlanetId).toBe('colony'); });
    await act(async () => { await client.refetchQueries({ queryKey: keys.planets }); });
    await waitFor(() => { expect(result.current.world.worlds.find((view) => view.planet.id === 'colony')?.planet.alloy).toBe(900); });
    expect(result.current.world.activePlanetId).toBe('colony');
    expect(result.current.planet.data?.planet.alloy).toBe(900);
  });

  it.each(['Upgrade', 'Build', 'Research', 'Instrument', 'Satellite', 'Collect works', 'Refund',
    'Reward', 'Depot', 'Repair', 'Raid', 'Trade', 'Transfer'])('shows the exact %s outcome in the real header and owned-world sheets', async (action) => {
    const changed = stamped('capital', 536, 500, 2, epoch + 1_000);
    const answer = { planet: changed, pending: [], rewards: { chains: [], claimable: 0 } };
    api.upgrade = vi.fn().mockResolvedValue(answer);
    api.build = vi.fn().mockResolvedValue(answer);
    api.completeResearch = vi.fn().mockResolvedValue(answer);
    api.raiseInstrument = vi.fn().mockResolvedValue(answer);
    api.installSatellite = vi.fn().mockResolvedValue(answer);
    api.collect = vi.fn().mockResolvedValue(answer);
    api.cancelBuildOrder = vi.fn().mockResolvedValue(answer);
    api.claimReward = vi.fn().mockResolvedValue(answer);
    api.claimClanDepot = vi.fn().mockResolvedValue(answer);
    api.startRepair = vi.fn().mockResolvedValue(answer);
    api.launch = vi.fn().mockResolvedValue(answer);
    api.trade = vi.fn().mockResolvedValue(answer);
    api.transfer = vi.fn().mockResolvedValue(answer);
    api.planets = vi.fn().mockResolvedValue(list([changed, colony]));
    client.setQueryData(keys.notifications, { notifications: [] });
    client.setQueryData(keys.rewards, { chains: [], claimable: 0 });
    client.setQueryData(keys.pending, { pending: [] });
    client.setQueryData(keys.galaxyEvents, { events: [] });
    client.setQueryData(keys.traffic, { contacts: [], sensors: [] });
    render(<ToastProvider><HudTop commander="Samet" {...topHandlers} /><Readings /><ResourceActions /></ToastProvider>, { wrapper });
    await userEvent.click(screen.getByRole('button', { name: action }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Alloy: 536 of 2,000' })).toHaveTextContent('536');
      expect(screen.getByRole('button', { name: 'Crystal: 500 of 600' })).toHaveTextContent('500');
      expect(screen.getByRole('button', { name: 'Deuterium: 2 of 300' })).toHaveTextContent('2');
      expect(screen.getByLabelText('owned world')).toHaveTextContent('"deuterium":2');
    });
  });

  it.each(['depot', 'repair', 'repairRefund', 'clanCreate', 'clanAid', 'clanSupport',
    'clanContribute', 'defencePosture', 'faultRepair', 'treasuryDonation', 'monumentSend',
    'monumentProbe'] as const)('orders a %s resource action after an already pending purchase', async (kind) => {
    const pending = deferred<unknown>();
    api.upgrade = vi.fn().mockReturnValue(pending.promise);
    const answer = { planet: stamped('capital', 600, 200, 10, epoch + 2_000), pending: [], returnedWaves: 0 };
    api.claimClanDepot = vi.fn().mockResolvedValue(answer);
    api.startRepair = vi.fn().mockResolvedValue(answer);
    api.cancelBuildOrder = vi.fn().mockResolvedValue(answer);
    api.createClan = vi.fn().mockResolvedValue(answer);
    api.launchClanAid = vi.fn().mockResolvedValue(answer);
    api.sendClanSupport = vi.fn().mockResolvedValue(answer);
    api.contributeClanWar = vi.fn().mockResolvedValue(answer);
    api.setDefencePosture = vi.fn().mockResolvedValue(answer);
    api.repairFault = vi.fn().mockResolvedValue(answer);
    api.donateClanTreasury = vi.fn().mockResolvedValue(answer);
    api.sendMonument = vi.fn().mockResolvedValue(answer);
    api.probeMonument = vi.fn().mockResolvedValue(answer);
    api.planet = vi.fn().mockResolvedValue(answer.planet);
    api.planets = vi.fn().mockResolvedValue(list([answer.planet, colony]));
    const writes = [api.claimClanDepot, api.startRepair, api.cancelBuildOrder, api.createClan,
      api.launchClanAid, api.sendClanSupport, api.contributeClanWar, api.setDefencePosture,
      api.repairFault, api.donateClanTreasury, api.sendMonument, api.probeMonument];
    const { result } = renderHook(() => ({
      upgrade: useUpgrade(), clan: useClanActions(), repair: useStartRepair(), repairRefund: useCancelRepair(),
      support: useClanSupportActions(), war: useClanWarActions(), posture: useSetDefencePosture(), world: useWorld(),
      fault: useRepairFault(), monuments: useMonumentActions(),
    }), { wrapper });
    await waitFor(() => { expect(result.current.world.activePlanetId).toBe('capital'); });
    act(() => { result.current.upgrade.mutate('REFINERY'); });
    await waitFor(() => { expect(api.upgrade).toHaveBeenCalledOnce(); });
    await act(async () => {
      switch (kind) {
        case 'depot': result.current.clan.claimDepot.mutate(); break;
        case 'repair': result.current.repair.mutate({ planetId: 'capital', request: { all: true } }); break;
        case 'repairRefund': result.current.repairRefund.mutate({ planetId: 'capital', orderId: 'order' }); break;
        case 'clanCreate': result.current.clan.create.mutate({ name: 'Astera', tag: 'AST', description: '', recruiting: true }); break;
        case 'clanAid': result.current.clan.launchAid.mutate({ originPlanetId: 'capital', recipientPlayerId: 'ally', targetPlanetId: 'ally-world', fleet: { COURIER: 1 }, cargo: { alloy: 100, crystal: 0, deuterium: 0 } }); break;
        case 'clanSupport': result.current.support.send.mutate({ originPlanetId: 'capital', hostPlanetId: 'ally', fleet: { DART: 1 } }); break;
        case 'clanContribute': result.current.war.contribute.mutate({ originPlanetId: 'capital', fleet: { DART: 1 }, acknowledgeShieldLoss: true }); break;
        case 'defencePosture': result.current.posture.mutate({ planetId: 'capital', escape: false, support: true }); break;
        case 'faultRepair': result.current.fault.mutate({ planetId: 'capital', faultId: 'fault' }); break;
        case 'treasuryDonation': result.current.war.donate.mutate({ planetId: 'capital', resources: { alloy: 100, crystal: 0, deuterium: 0 } }); break;
        case 'monumentSend': result.current.monuments.send.mutate({ monumentId: 'monument', input: { originPlanetId: 'capital', fleet: { DART: 1 }, purpose: 'ATTACK' }, key: 'send' }); break;
        case 'monumentProbe': result.current.monuments.probe.mutate({ monumentId: 'monument', originPlanetId: 'capital', key: 'probe' }); break;
      }
      await Promise.resolve();
    });
    for (const write of writes) expect(write).not.toHaveBeenCalled();
    await act(async () => { pending.resolve({ planet: stamped('capital', 536, 20, 2, epoch + 1_000) }); await pending.promise; });
    await waitFor(() => {
      expect(writes.reduce((count, write) => count + vi.mocked(write).mock.calls.length, 0)).toBe(1);
    });
  });
});

describe('legacy capital resource readers', () => {
  it('updates the existing capital reader after a repair at that physical world', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const initial = stamped('capital', 1_505);
    client.setQueryData(keys.planet, initial);
    const changed = stamped('capital', 536, 500, 2, epoch + 1_000);
    const api = new Api({ fetch: () => Promise.reject(new Error('unexpected fetch')) });
    api.startRepair = vi.fn().mockResolvedValue({ planet: changed });
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>
      <ApiProvider api={api}>{children}</ApiProvider>
    </QueryClientProvider>;
    const { result } = renderHook(() => ({ repair: useStartRepair(), planet: usePlanet() }), { wrapper });
    act(() => { result.current.repair.mutate({ planetId: 'capital', request: { all: true } }); });
    await waitFor(() => { expect(result.current.repair.isSuccess).toBe(true); });
    expect(result.current.planet.data?.planet.alloy).toBe(536);
    client.clear();
  });

  it('does not rewind an existing capital balance when its explicit cache is still cold', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const newest = stamped('capital', 536, 500, 2, epoch + 2_000);
    client.setQueryData(keys.planet, newest);
    const api = new Api({ fetch: () => Promise.reject(new Error('unexpected fetch')) });
    api.claimReward = vi.fn().mockResolvedValue({
      planet: stamped('capital', 1_905, 150, 145, epoch + 1_000), rewards: { chains: [], claimable: 0 },
    });
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>
      <ApiProvider api={api}>{children}</ApiProvider>
    </QueryClientProvider>;
    const { result } = renderHook(() => ({ reward: useClaimReward(), planet: usePlanet() }), { wrapper });
    act(() => { result.current.reward.mutate('CORE:3'); });
    await waitFor(() => { expect(result.current.reward.isSuccess).toBe(true); });
    expect(result.current.planet.data?.planet.alloy).toBe(536);
    expect(client.getQueryData(keys.planetById('capital'))).toEqual(newest);
    client.clear();
  });
});

describe('server-anchored Works', () => {
  beforeEach(() => { resetClock(); });
  afterEach(() => { resetClock(); });

  it('keeps the production instant in the planet contract', () => {
    expect(stamped('capital', 500).planet).toHaveProperty('snapshotAt', new Date(epoch));
  });

  it('includes production during network delay for all three resources', () => {
    const world = planetSchema.parse(planetView({}, {
      snapshotAt: new Date(epoch), bufferAlloy: 10, bufferCrystal: 20, bufferDeuterium: 30,
      alloyPerHour: 60, crystalPerHour: 30, deuteriumPerHour: 12,
    }));
    expect(worksAt(world.planet, epoch + 30 * 60_000, epoch + 60 * 60_000)).toEqual({
      bufferAlloy: 70, bufferCrystal: 50, bufferDeuterium: 42,
    });
  });

  it('caps produced deuterium and preserves mined deuterium with no refinery', () => {
    const produced = planetView({}, { deuteriumPerHour: 12, bufferDeuterium: 190, bufferDeuteriumCap: 199 });
    expect(worksAt(produced.planet, epoch, epoch + 3_600_000).bufferDeuterium).toBe(199);
    const mined = planetView({}, { deuteriumPerHour: 0, bufferDeuterium: 150 });
    expect(worksAt(mined.planet, epoch, epoch + 3_600_000).bufferDeuterium).toBe(150);
  });
});
