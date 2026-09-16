import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FAULT, FAULT_KINDS, type FaultKind } from '@astera/rules';
import { FAULT_LOCATION } from '../../server/src/services/faults.js';
import { FAULT_ITEM, TAB_OF } from '../src/screens/PlanetScreen.js';
import { DESTINATION, Signals } from '../src/shell/Signals.js';
import { nextPanelFocus } from '../src/shell/panelRoute.js';
import type { NotificationView } from '../src/api/schemas.js';

let rows: NotificationView[] = [];

vi.mock('../src/api/queries.js', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../src/api/queries.js');
  return {
    ...actual,
    useNotifications: () => ({ data: { notifications: rows } }),
    usePlanet: () => ({ data: undefined, dataUpdatedAt: Date.now() }),
    useMarkSeen: () => ({ mutate: vi.fn() }),
  };
});

beforeEach(() => { rows = []; });

/**
 * ARIZA ARAYÜZÜ. `docs/colony-faults-plan.md` §11.
 *
 * İki şeyi koruyor: bildirime basınca DOĞRU satıra inilmesi, ve onarım şeridinde
 * iptal kontrolünün OLMAMASI. İkincisi bir yokluğu test etmek gibi görünüyor ama
 * sahibin talimatı tam olarak buydu ve bir gün biri "tutarlılık için" o butonu ekler.
 */

describe('bildirim doğru satıra iner', () => {
  /**
   * SUNUCUNUN HARİTASI İLE İSTEMCİNİNKİ AYNI OLMAK ZORUNDA.
   *
   * İkisi ayrı dosyada duruyor ve durmak zorunda: sunucununki bildirimin İÇİNDE yolculuk
   * ediyor, böylece o arızayı hiç duymamış bir istemci de doğru yere gidebiliyor. Ayrı
   * durdukları için de sessizce ayrışabilirler — yanlış tab açılır, kimse fark etmez.
   */
  it('sunucu ve istemci aynı satırı gösteriyor', () => {
    for (const kind of FAULT_KINDS) {
      expect(FAULT_ITEM[kind]).toBe(FAULT_LOCATION[kind].itemId);
      expect(TAB_OF[FAULT_ITEM[kind]]).toBe(FAULT_LOCATION[kind].group);
    }
  });

  it('sekiz arızanın hepsi bir tab ve bir satır adlandırıyor', () => {
    for (const kind of FAULT_KINDS) {
      expect(FAULT_ITEM[kind]).toBeTruthy();
      expect(TAB_OF[FAULT_ITEM[kind]]).toBeTruthy();
    }
  });

  it('arıza bildirimi gezegen sayfasına yönlenir', () => {
    expect(DESTINATION.colony_fault).toEqual({ panel: 'planet' });
    expect(DESTINATION.colony_loyalty_warning).toEqual({ panel: 'planet' });
  });

  /** D183'ün kuralı: bir derin bağlantı yalnızca onu taşıyan gezinmeye aittir. */
  it('odak isteği yalnızca onu taşıyan gezinmede yaşar', () => {
    const first = nextPanelFocus(null, { planetId: 'p1', group: 'reach', itemId: 'SHIPYARD' });
    expect(first).toMatchObject({ planetId: 'p1', itemId: 'SHIPYARD', request: 1 });
    // Sıradan bir gezinme onu temizler.
    expect(nextPanelFocus(first, undefined)).toBeNull();
    // Aynı arıza ikinci kez duyurulursa sayaç ilerler ve iniş tekrar olur.
    expect(nextPanelFocus(first, { planetId: 'p1' })?.request).toBe(2);
  });

  it('boş bir odak istek sayılmaz', () => {
    expect(nextPanelFocus(null, {})).toBeNull();
  });

  it('bildirime basmak dünyayı, tabı ve satırı birlikte taşır', async () => {
    rows = [{
      id: 'n1',
      kind: 'colony_fault',
      seen: false,
      at: new Date('2026-08-26T12:00:00.000Z'),
      refId: 'f1',
      payload: {
        planetId: 'p9',
        planetName: 'Vantage',
        fault: 'SHIPYARD_REVOLT' satisfies FaultKind,
        group: 'reach',
        itemId: 'SHIPYARD',
      },
    }];
    const onOpen = vi.fn();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <Signals onOpen={onOpen} onFocusPlanet={vi.fn()} />
      </QueryClientProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: /^Signals/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Open related report' }));

    expect(onOpen).toHaveBeenCalledWith('planet', undefined, undefined, {
      planetId: 'p9',
      group: 'reach',
      itemId: 'SHIPYARD',
    });
  });
});

describe('onarım hiç iptal edilemez', () => {
  /**
   * BİR YOKLUĞU TEST ETMEK. Sahibin talimatı: *"Arıza fix başladıgında cancel edilemez
   * olsun hiç ugrasma."* İstemcide buton, sunucuda route yok — ve ikisi de bir gün
   * "tutarlılık için" geri eklenebilecek türden şeyler.
   */
  it('istemci API yüzeyinde iptal yok', async () => {
    const { Api } = await import('../src/api/client.js');
    /*
      THE SURFACE, NOT THE SOURCE. This read the file and grepped it, which failed on the
      docblock that EXPLAINS there is no cancel — a test that a comment can break is
      testing prose. Every call on this client is an arrow-function class field, so the
      instance's own keys are exactly the calls it can make.
    */
    const surface = Object.keys(new Api({}));
    expect(surface).toContain('repairFault');
    expect(surface.filter((name) => /fault/i.test(name))).toEqual(['repairFault']);
  });

  it('üç lane vardır ve sayı tek yerden gelir', () => {
    expect(FAULT.repairSlots).toBe(3);
  });
});
