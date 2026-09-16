import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { keys } from '../src/api/keys.js';
import { planetSchema } from '../src/api/schemas.js';
import i18n from '../src/i18n/index.js';
import { worksAt } from '../src/lib/projection.js';
import { StatusBar } from '../src/shell/StatusBar.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { planetView } from './fixtures.js';

/**
 * THE STRUCK WORLD WORKS DOUBLE, AND THE HEADER SAYS SO. Owner instruction,
 * 2026-09-16: *"bunu frontend'de kaynak menü itemlarının yanında bir ok içeren boost
 * icon animasyonu ile göstermeli ve bir yere ufak bir şekilde koruma süresi boyunca
 * %100 boost yazmalıyız."*
 *
 * Two surfaces and one prediction. The arrows say which figures are moving faster;
 * the note states the rule and until when; and the works vessels must actually fill
 * at the boosted pace, or the arrows promise something the meter contradicts.
 */

const HOUR = 3_600_000;

const header = (planet = planetView()) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(keys.planet, planet);
  const api = new Api({ fetch: () => Promise.reject(new Error('unexpected fetch')) });
  render(
    <QueryClientProvider client={client}>
      <ApiProvider api={api}>
        <ToastProvider>
          <StatusBar commander="Vantage" onOpen={vi.fn()} onFocusPlanet={vi.fn()} />
        </ToastProvider>
      </ApiProvider>
    </QueryClientProvider>,
  );
};

describe('the recovery boost on the wire', () => {
  it('reads the boost instant as a date, and treats an old payload as no boost', () => {
    const base = planetView();
    const until = new Date(Date.now() + 2 * HOUR);
    const parsed = planetSchema.parse(JSON.parse(JSON.stringify({
      ...base,
      planet: { ...base.planet, productionBoostUntil: until.toISOString() },
    })));
    expect(parsed.planet.productionBoostUntil?.getTime()).toBe(until.getTime());

    const legacy = planetSchema.parse(JSON.parse(JSON.stringify(base)));
    expect(legacy.planet.productionBoostUntil ?? null).toBeNull();
  });
});

describe('the works projection under a boost', () => {
  const planet = planetView({}, { bufferAlloy: 0, bufferCrystal: 0 }).planet;

  it('fills twice as fast while the boost lasts', () => {
    const fetchedAt = Date.now();
    const boosted = { ...planet, productionBoostUntil: new Date(fetchedAt + 5 * HOUR) };
    const works = worksAt(boosted, fetchedAt, fetchedAt + HOUR);
    expect(works.bufferAlloy).toBeCloseTo(planet.alloyPerHour * 2, 1);
    expect(works.bufferCrystal).toBeCloseTo(planet.crystalPerHour * 2, 1);
  });

  it('returns to the ordinary pace the instant the boost ends', () => {
    const fetchedAt = Date.now();
    const boosted = { ...planet, productionBoostUntil: new Date(fetchedAt + HOUR / 2) };
    expect(worksAt(boosted, fetchedAt, fetchedAt + HOUR).bufferAlloy)
      .toBeCloseTo(planet.alloyPerHour * 1.5, 1);
  });

  it('never fills past the same collector ceiling', () => {
    const fetchedAt = Date.now();
    const boosted = { ...planet, productionBoostUntil: new Date(fetchedAt + 100 * HOUR) };
    expect(worksAt(boosted, fetchedAt, fetchedAt + 50 * HOUR).bufferAlloy)
      .toBe(planet.bufferAlloyCap);
  });
});

describe('the recovery boost on the header', () => {
  it('marks every resource and states the rule while the world is boosted', () => {
    header(planetView({}, { productionBoostUntil: new Date(Date.now() + 3 * HOUR) }));
    expect(screen.getAllByRole('img', { name: i18n.t('statusBar.recoveryBoost.mark') }))
      .toHaveLength(3);
    expect(screen.getByText(i18n.t('statusBar.recoveryBoost.note'))).toBeInTheDocument();
  });

  it('draws nothing on a world with no boost', () => {
    header(planetView({}, { productionBoostUntil: null }));
    expect(screen.queryAllByRole('img', { name: i18n.t('statusBar.recoveryBoost.mark') }))
      .toHaveLength(0);
    expect(screen.queryByText(i18n.t('statusBar.recoveryBoost.note'))).not.toBeInTheDocument();
  });

  it('draws nothing once the boost instant has passed', () => {
    header(planetView({}, { productionBoostUntil: new Date(Date.now() - 1_000) }));
    expect(screen.queryByText(i18n.t('statusBar.recoveryBoost.note'))).not.toBeInTheDocument();
  });
});
