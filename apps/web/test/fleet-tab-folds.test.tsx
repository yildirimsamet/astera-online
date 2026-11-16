import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { planetSchema, type PlanetView } from '../src/api/schemas.js';
import { Fold } from '../src/game-ui/index.js';
import i18n from '../src/i18n/index.js';
import { ClanSupportBay, DefencePostureCard } from '../src/screens/ClanSupportBay.js';
import { planetView } from './fixtures.js';

/**
 * THE FLEET TAB FOLDS WHAT IS SET ONCE (owner review 2026-11-16, item 8): the defence posture,
 * its Honor notice and the clan support bay stood between the Hangar and the ships, so a player
 * scrolled past switches they set once a season before any ship showed. Each is now the kit's
 * one fold — a head that says what it is and where it stands, the rest one press away.
 */

const HOUR = 3_600_000;
const wave = (id: string) => ({
  id, status: 'STATIONED', sender: { playerId: 'ali', name: 'Ali' }, host: { playerId: 'me', name: 'Me' },
  originPlanetId: 'origin', hostPlanetId: 'world', hostPlanetName: 'Vega', fleet: { PIKE: 12 }, bulk: 140, damaged: false,
  sentAt: new Date(Date.now() - HOUR).toISOString(), arriveAt: new Date(Date.now() - HOUR / 2).toISOString(),
  stationedAt: new Date(Date.now() - HOUR / 2).toISOString(), expiresAt: new Date(Date.now() + 11 * HOUR).toISOString(),
  returnAt: null, returnReason: null, outOfBand: false, battles: 0,
});

function world(escape: boolean, support: boolean, bay: Record<string, unknown> = {}): PlanetView {
  const stance = escape && support ? 'ESCAPE_SUPPORT' : escape ? 'ESCAPE' : support ? 'SUPPORT' : 'HOLD';
  return planetSchema.parse(JSON.parse(JSON.stringify({
    ...planetView(),
    rulesetVersion: 15,
    defencePosture: { posture: stance === 'ESCAPE_SUPPORT' ? 'SUPPORT' : stance, stance, escape, support, supportLocked: null },
    clanSupport: { room: { used: 140, reserved: 0, total: 470 }, waves: [], ...bay },
  })));
}

function show(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['season'], { honorSoloCredit: true });
  const api = new Api({ fetch: () => new Promise<Response>(() => undefined) });
  return render(<QueryClientProvider client={client}><ApiProvider api={api}>{node}</ApiProvider></QueryClientProvider>);
}

beforeEach(async () => { await i18n.changeLanguage('en'); });

describe('the kit fold', () => {
  it('is shut on arrival, its head naming the thing, where it stands and its figure', async () => {
    const view = render(<Fold data-probe="" glyph="shield" tone="self" title="Posture" sub="Retreat on" value="3 / 5"><p>inside</p></Fold>);
    const fold = view.container.querySelector<HTMLDetailsElement>('[data-probe]')!;
    expect(fold.tagName).toBe('DETAILS');
    expect(fold.open).toBe(false);
    expect(fold).toHaveAttribute('data-tone', 'self');
    const head = fold.querySelector('summary')!;
    expect(head).toHaveTextContent('Posture');
    expect(head).toHaveTextContent('Retreat on');
    expect(head).toHaveTextContent('3 / 5');
    expect(head).not.toHaveTextContent('inside');
    await userEvent.setup().click(head);
    expect(fold.open).toBe(true);
  });

  it('can arrive open when what is inside is urgent', () => {
    const view = render(<Fold data-probe="" glyph="siren" title="Alarm" open><p>inside</p></Fold>);
    expect(view.container.querySelector<HTMLDetailsElement>('[data-probe]')!.open).toBe(true);
  });
});

describe('the defence posture folds', () => {
  it('shuts behind one head that says which switches are on', () => {
    const view = show(<DefencePostureCard planet={world(true, true)} />);
    const fold = view.container.querySelector<HTMLDetailsElement>('[data-defence-posture]')!;
    expect(fold.tagName).toBe('DETAILS');
    expect(fold.open).toBe(false);
    const head = fold.querySelector('summary')!;
    expect(head).toHaveTextContent(i18n.t('clanSupport.postureTitle'));
    expect(head).toHaveTextContent(i18n.t('clanSupport.postureRead.ESCAPE_SUPPORT'));
    // The Honor notice and the switches are inside, not on the head.
    expect(head).not.toHaveTextContent(i18n.t('leaderboard.honorSolo.title'));
    expect(within(fold).getAllByRole('switch')).toHaveLength(2);
    expect(fold.querySelector('[data-honor-shared-policy]')).not.toBeNull();
  });

  it('says the fleet always fights when both are off', () => {
    const view = show(<DefencePostureCard planet={world(false, false)} />);
    expect(view.container.querySelector('[data-defence-posture] summary')).toHaveTextContent(i18n.t('clanSupport.postureRead.HOLD'));
  });
});

describe('the clan support bay folds', () => {
  it('shuts behind its room figure and the count standing guard', () => {
    const view = show(<ClanSupportBay planet={world(false, true, { waves: [wave('a'), wave('b')] })} />);
    const fold = view.container.querySelector<HTMLDetailsElement>('[data-support-bay]')!;
    expect(fold.tagName).toBe('DETAILS');
    expect(fold.open).toBe(false);
    const head = fold.querySelector('summary')!;
    expect(head).toHaveTextContent(i18n.t('clanSupport.bayTitle'));
    expect(head).toHaveTextContent('140 / 470');
    expect(head).toHaveTextContent(i18n.t('clanSupport.bayWaves', { count: 2 }));
    expect(fold.querySelectorAll('[data-support-wave]')).toHaveLength(2);
  });

  it('arrives open while a clan alarm is up', () => {
    const alarm = { id: 'al-1', missionId: 'm-1', arriveAt: new Date(Date.now() + HOUR).toISOString(), seen: 1, called: 3, answered: 0 };
    const view = show(<ClanSupportBay planet={world(false, true, { alarms: [alarm] })} />);
    expect(view.container.querySelector<HTMLDetailsElement>('[data-support-bay]')!.open).toBe(true);
  });
});

vi.mock('../src/lib/sound.js', async (load) => ({ ...await load<Record<string, unknown>>(), playSound: vi.fn() }));
