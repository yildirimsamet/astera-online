import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlanetScreen } from '../src/screens/PlanetScreen.js';
import { ToastProvider } from '../src/ui/Toast.js';
import type { FaultView, PlanetView } from '../src/api/schemas.js';
import { openAllBands, planetView } from './fixtures.js';

/**
 * ARIZALI BİR SATIR ONARIMI AÇAR, GELİŞTİRMEYİ DEĞİL. Sahip talimatı:
 * *"Tıklayınca: alttan geliştirme tab'ı degil yeni tasarlayacagın fixle sheeti çıkmalı."*
 *
 * İKİ KAPI VAR VE İKİSİ DE TEST EDİLİYOR, çünkü code review'da ikincisinin hiç
 * olmadığı ortaya çıktı. Bina, enstrüman ve uydu satırları `ItemRef` üzerinden
 * `ItemSheet`'e gidiyor; gemi satırları `ItemRef` değil, `onBuild` üzerinden `BuildSheet`'e.
 * `PROSPECTOR_FAULT` bir gemiyi adlandırıyor — sekiz arızadan tek yanlış kapıya inen buydu:
 * satır greyish ve işaretliydi, basınca tersaneyi açıyordu.
 */

const spies = vi.hoisted(() => ({ refetch: vi.fn() }));

vi.mock('../src/api/queries.js', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../src/api/queries.js');
  return {
    ...actual,
    usePlanet: () => ({ data: current, dataUpdatedAt: Date.now(), isPending: false, refetch: spies.refetch }),
    useGalaxy: () => ({ data: undefined }),
    useIntel: () => ({ data: undefined }),
    usePending: () => ({ data: undefined }),
    useReports: () => ({ data: undefined }),
    useUpgrade: () => ({ mutate: vi.fn(), isPending: false }),
    useBuild: () => ({ mutate: vi.fn(), isPending: false }),
    useCompleteResearch: () => ({ mutate: vi.fn(), isPending: false }),
    useInstallSatellite: () => ({ mutate: vi.fn(), isPending: false }),
    useRaiseInstrument: () => ({ mutate: vi.fn(), isPending: false }),
    useCancelBuildOrder: () => ({ mutate: vi.fn(), isPending: false }),
    useBuildDeathStar: () => ({ mutate: vi.fn(), isPending: false }),
    useBuildInterceptor: () => ({ mutate: vi.fn(), isPending: false }),
    useRepairFault: () => ({ mutate: vi.fn(), isPending: false }),
  };
});

let current: PlanetView;

beforeEach(() => { spies.refetch.mockClear(); });
afterEach(() => { vi.useRealTimers(); });

const fault = (kind: FaultView['kind']): FaultView => ({
  id: `fault-${kind}`,
  kind,
  startedAt: new Date('2026-08-26T12:00:00.000Z'),
  cost: { alloy: 300, crystal: 0, deuterium: 0 },
  repair: null,
});

const show = (faults: FaultView[], focusGroup: 'grow' | 'reach' = 'reach') => {
  current = planetView(
    {
      buildings: { CORE: 12, REFINERY: 8, EXTRACTOR: 8, VAULT: 6, SHIPYARD: 4 },
      orbitSlots: 3,
      fleet: {},
      fleetAway: {},
      score: { wealth: 10_000, dominion: 0 },
      faults,
      loyalty: { value: 80, minutesLeft: 900 },
    },
    { alloy: 900_000, crystal: 400_000, alloyCap: 2_000_000, crystalCap: 900_000 },
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <PlanetScreen focusGroup={focusGroup} />
      </ToastProvider>
    </QueryClientProvider>,
  );
};

async function tapRow(name: string, id: string): Promise<void> {
  const user = userEvent.setup();
  await openAllBands(screen, user);
  const row = document.getElementById(`row-${id}`);
  if (!row) throw new Error(`no row-${id} on screen`);
  await user.click(within(row).getByRole('button', { name: new RegExp(`about ${name}`, 'i') }));
}

describe('arızalı satırın kapısı', () => {
  it('bozuk bir gemi satırı onarım sheetini açar, tersaneyi değil', async () => {
    show([fault('PROSPECTOR_FAULT')]);
    await tapRow('Prospector', 'PROSPECTOR');

    expect(screen.getByRole('heading', { name: 'Prospecting pit down' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /prospector quantity/i })).toBeNull();
  });

  it('bozuk bir bina satırı onarım sheetini açar, geliştirmeyi değil', async () => {
    show([fault('SHIPYARD_REVOLT')]);
    await tapRow('Shipyard', 'SHIPYARD');

    expect(screen.getByRole('heading', { name: 'Revolt in the yard' })).toBeInTheDocument();
  });

  it('sağlam bir gemi satırı hâlâ tersaneyi açar', async () => {
    show([fault('SHIPYARD_REVOLT')]);
    await tapRow('Prospector', 'PROSPECTOR');

    expect(screen.getByRole('textbox', { name: /prospector quantity/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Prospecting pit down' })).toBeNull();
  });

  /**
   * SEKİZ SATIRIN HEPSİ. İlk yazılışta tek satır kontrol ediliyordu ve Prospector'ın
   * işaret almadığını ancak o satır olduğu için yakaladı; diğer yediyi bir döngü tutuyor.
   */
  it.each([
    ['REFINERY_OUTAGE', 'REFINERY', 'grow'],
    ['EXTRACTOR_OUTAGE', 'EXTRACTOR', 'grow'],
    ['VAULT_LEAK', 'VAULT', 'grow'],
    ['CORE_OUTAGE', 'CORE', 'grow'],
    ['SHIPYARD_REVOLT', 'SHIPYARD', 'reach'],
    ['PROSPECTOR_FAULT', 'PROSPECTOR', 'reach'],
  ] as const)('%s kendi satırını işaretler', async (kind, id, tab) => {
    show([fault(kind)], tab);
    await openAllBands(screen, userEvent.setup());
    expect(document.querySelector(`#row-${id} [data-faulty]`)).not.toBeNull();
  });

  it('bozuk satır işaretli, sağlam satır değil', async () => {
    show([fault('PROSPECTOR_FAULT')]);
    await openAllBands(screen, userEvent.setup());
    expect(document.querySelector('#row-PROSPECTOR [data-faulty]')).not.toBeNull();
    expect(document.querySelector('#row-SHIPYARD [data-faulty]')).toBeNull();
  });

  it('bozuk satırın sekmesi işaretli', () => {
    show([fault('TELESCOPE_FAULT')]);
    expect(screen.getByRole('tab', { name: /something here is broken/i })).toBeInTheDocument();
  });
});

/** Onarım şeridi: bir yokluk, ve sahibin talimatı tam olarak o yokluk. */
describe('onarım şeridi', () => {
  it('hiç arıza yokken hiçbir şey çizmez', () => {
    show([], 'grow');
    expect(screen.queryByRole('region', { name: 'Repairs' })).toBeNull();
  });

  it('koşan onarımın iptal kontrolü yoktur', () => {
    show([{ ...fault('VAULT_LEAK'), repair: { slot: 0, readyAt: new Date(Date.now() + 600_000) } }], 'grow');
    const strip = screen.getByRole('region', { name: 'Repairs' });
    expect(within(strip).queryByRole('button', { name: /cancel/i })).toBeNull();
  });

  /**
   * ONARILMAYAN BİR ARIZA DA BİR KAPIDIR. Code review bulgusu: şerit "3 bekliyor" yazıp
   * hiçbirine dokunulmasına izin vermiyordu — oyuncu arızaları dört tab arasında aramak
   * zorundaydı. Şimdi her arıza kendi satırında, fiyatıyla, basılabilir.
   */
  it('bekleyen her arıza kendi satırında basılabilir', async () => {
    show([fault('VAULT_LEAK'), fault('TELESCOPE_FAULT')], 'grow');
    const strip = screen.getByRole('region', { name: 'Repairs' });
    const rows = within(strip).getAllByRole('button');
    expect(rows).toHaveLength(2);

    await userEvent.setup().click(within(strip).getByRole('button', { name: /Telescope failure/ }));
    expect(screen.getByRole('heading', { name: 'Telescope failure' })).toBeInTheDocument();
  });

  it('koşan ve bekleyen arızalar aynı listede, koşanlar önce', () => {
    show([
      fault('VAULT_LEAK'),
      { ...fault('CORE_OUTAGE'), repair: { slot: 1, readyAt: new Date(Date.now() + 600_000) } },
    ], 'grow');
    const strip = screen.getByRole('region', { name: 'Repairs' });
    const names = within(strip).getAllByRole('button').map((row) => row.textContent);
    expect(names[0]).toContain('Command core blackout');
    expect(names[1]).toContain('Vault leak');
  });

  /**
   * BİR ONARIM BİTTİĞİ ANDA EKRAN KENDİNİ UYANDIRIR.
   *
   * YENİDEN YAZILDI. Bu dosyada bu davranışı doğrulayan bir test vardı ve şeridin
   * testlerini değiştirirken bloğu dosyanın sonuna kadar değiştirip onu sildim — dosya
   * başındaki `refetch` spy'ı, `useRealTimers` temizliği ve `act` import'u, onu kullanan
   * hiçbir test kalmamış hâlde duruyordu. Asıl metin kurtarılamadı; bu, aynı davranışı
   * doğrulayan bir yeniden yazım: `PlanetScreen`'in uyanma efekti onarımın `readyAt`
   * anını da bekliyor, yoksa biten bir onarım sayfa yenilenene kadar "00:00"da kalırdı.
   */
  it('bir onarım bittiği anda ekranı uyandırır ve gezegeni yeniden okur', async () => {
    vi.useFakeTimers();
    const readyAt = new Date(Date.now() + 9 * 60_000);
    show([{ ...fault('VAULT_LEAK'), repair: { slot: 0, readyAt } }], 'grow');
    spies.refetch.mockClear();

    await act(async () => { vi.advanceTimersByTime(9 * 60_000 - 5_000); });
    expect(spies.refetch, 'onarım bitmeden uyandı').not.toHaveBeenCalled();

    await act(async () => { vi.advanceTimersByTime(10_000); });
    expect(spies.refetch).toHaveBeenCalled();
  });
});
