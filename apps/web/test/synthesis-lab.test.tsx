import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import type { SynthesisView } from '../src/api/schemas.js';
import i18n from '../src/i18n/index.js';
import { capsuleChoices, labState, vialRack } from '../src/lib/synthesis.js';
import { SynthesisLab } from '../src/screens/SynthesisLab.js';
import { CapsuleRow } from '../src/ui/CapsuleRow.js';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '../src/ui/Toast.js';
import { planetView } from './fixtures.js';
import { glyphPath } from './glyphPath.js';
import { urlOf } from './starterVesselFixture.js';

/*
  SENTEZ LABORATUVARI (plan 2026-11-24 §4.4). What a commander needs before pressing: what they hold,
  what a batch costs and takes, and why it cannot start; once running, how far it is and that a cancel
  gives half back. Nothing about the server's arithmetic is redone here: cost and time come from rules.
*/
const NOW = new Date('2026-11-26T12:00:00.000Z');
const lab = (over: Partial<SynthesisView> = {}): SynthesisView => ({
  enabled: true, requiredCore: 10, coreLevel: 10, unlocked: true, asterium: 12, perDay: 3,
  moons: [{ planetId: 'p1', planetName: 'Vega', rarity: 'RARE', perDay: 3, closedUntil: null, nextAt: null }],
  capsules: { OPTIC_VEIL: 1, SILENT_THRUST: 0 }, job: null, storm: null, ...over,
});
const rich = { alloy: 100_000, crystal: 100_000, deuterium: 10_000 };

describe('labState', () => {
  it('prices a batch from the rules and lets it start', () => {
    const state = labState(lab(), rich, 'OPTIC_VEIL', 2);
    expect(state.cost).toEqual({ alloy: 4000, crystal: 6000, deuterium: 500 });
    expect(state.asterium).toBe(8);
    expect(state.minutes).toBe(60);
    expect(state.refusal).toBeNull();
  });

  it('names the first thing in the way', () => {
    expect(labState(lab({ unlocked: false, coreLevel: 7 }), rich, 'OPTIC_VEIL', 1).refusal).toBe('locked');
    expect(labState(lab({ asterium: 3 }), rich, 'OPTIC_VEIL', 1).refusal).toBe('asterium');
    expect(labState(lab(), { alloy: 0, crystal: 0, deuterium: 0 }, 'OPTIC_VEIL', 1).refusal).toBe('resources');
    const running = lab({ job: { capsuleId: 'OPTIC_VEIL', quantity: 2, delivered: 0, startedAt: NOW, nextAt: NOW, completesAt: NOW } });
    expect(labState(running, rich, 'OPTIC_VEIL', 1).refusal).toBe('busy');
  });

  it('caps the batch at what the Asteryum covers and the rules allow', () => {
    expect(labState(lab({ asterium: 13 }), rich, 'SILENT_THRUST', 1).most).toBe(2);
    expect(labState(lab({ asterium: 10_000 }), rich, 'OPTIC_VEIL', 1).most).toBe(20);
  });
});

describe('vialRack', () => {
  it('fills the made vials, fills the brewing one by its own clock, and keeps a big batch to one rack', () => {
    const now = new Date('2026-11-26T12:00:00.000Z');
    const job = { capsuleId: 'OPTIC_VEIL' as const, quantity: 3, delivered: 1, nextAt: new Date(now.getTime() + 20 * 60_000) };
    const rack = vialRack(job, now.getTime());
    expect(rack.map((vial) => vial.state)).toEqual(['full', 'brewing', 'empty']);
    expect(rack[0]?.fill).toBe(1);
    expect(rack[1]?.fill).toBeCloseTo(1 / 3, 6);
    expect(rack[2]?.fill).toBe(0);
    const big = vialRack({ ...job, quantity: 20, delivered: 0 }, now.getTime());
    expect(big).toHaveLength(20);
    expect(vialRack({ ...job, nextAt: new Date(now.getTime() - 1) }, now.getTime())[1]).toEqual({ state: 'brewing', fill: 1 });
  });
});

describe('capsuleChoices', () => {
  it('prices each capsule this flight may wear from its own bulk, and says when stock is short', () => {
    // 200 Darts: 600 bulk, two of each.
    expect(capsuleChoices('attack', { DART: 200 }, { OPTIC_VEIL: 1, SILENT_THRUST: 5 })).toEqual([
      { id: 'OPTIC_VEIL', need: 2, held: 1, enough: false, bulk: 600 },
      { id: 'SILENT_THRUST', need: 2, held: 5, enough: true, bulk: 600 },
    ]);
  });

  it('offers a transfer the veil alone, and nothing to an empty fleet', () => {
    expect(capsuleChoices('transfer', { DART: 10 }, { OPTIC_VEIL: 3, SILENT_THRUST: 3 }).map((one) => one.id)).toEqual(['OPTIC_VEIL']);
    expect(capsuleChoices('attack', {}, { OPTIC_VEIL: 3, SILENT_THRUST: 3 })).toEqual([]);
  });
});

const harness = (view: SynthesisView) => {
  const fetcher = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = urlOf(input);
    const body = url.includes('/api/synthesis/start')
      ? { synthesis: lab({ asterium: 8, job: { capsuleId: 'OPTIC_VEIL', quantity: 1, delivered: 0, startedAt: NOW, nextAt: NOW, completesAt: NOW } }), planet: planetView() }
      : view;
    void init;
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }));
  });
  const api = new Api({ fetch: fetcher as unknown as typeof globalThis.fetch });
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={queries}><ApiProvider api={api}><ToastProvider>
    <SynthesisLab held={rich} />
  </ToastProvider></ApiProvider></QueryClientProvider>);
  return fetcher;
};

beforeEach(async () => { await i18n.changeLanguage('tr'); });
afterEach(() => { cleanup(); });

describe('the laboratory card', () => {
  /* Owner 2026-11-25: the lab has its own bay and will grow; it reads as a place, not a weapon card. */
  it('opens on the lab and its Asteryum, then where Asteryum comes from: the moons a day, the next storm', async () => {
    // A half-unit rate since the owner halved them (2026-11-25), written the Turkish way.
    harness(lab({ perDay: 2.5, storm: { active: false, startsAt: new Date(Date.now() + 3_600_000), endsAt: new Date(Date.now() + 7_200_000) } }));
    expect(await screen.findByText('Sentez Laboratuvarı')).toBeTruthy();
    // Owner 2026-11-25: the stock stands on its own at the very top of the lab, seen before anything else.
    const root = document.querySelector('[data-testid="synthesis-lab"]');
    const stock = root?.firstElementChild;
    expect(stock?.hasAttribute('data-lab-stock')).toBe(true);
    expect(stock?.querySelector('[data-asterium]')?.textContent).toBe('12');
    expect(stock?.querySelector('img[src="/assets/images/resources/asterium.webp"]')).toBeTruthy();
    expect(document.querySelector('[data-lab-hero] [data-asterium]')).toBeNull();
    const income = [...document.querySelectorAll('[data-lab-income] dl > div')].map((one) => one.textContent);
    expect(income).toEqual([expect.stringMatching(/^Aylar.*günde 2,5$/), expect.stringMatching(/^Fırtına.*sonra$/)]);
  });

  it('says how to get Asteryum when no moon makes any, and says a storm that blows now', async () => {
    harness(lab({ moons: [], perDay: 0, storm: { active: true, startsAt: new Date(Date.now() - 60_000), endsAt: new Date(Date.now() + 1_800_000) } }));
    expect(await screen.findByText('Asteryum için bir Ay tut ya da fırtınada Yarık\'a uç.')).toBeTruthy();
    expect(document.querySelector('[data-lab-income] [data-storm="now"]')?.textContent).toMatch(/kaldı$/);
    // Owner 2026-11-25: the storm is a whirling storm, never the pickaxe.
    const storm = document.querySelector('[data-lab-income] [data-storm]')?.closest('div')?.querySelector('svg path')?.getAttribute('d');
    expect(storm).toBe(glyphPath('storm'));
  });

  it('prices a batch on one cost line, Asteryum beside the three, the time at its end', async () => {
    harness(lab());
    await screen.findAllByRole('radio');
    const parts = [...document.querySelectorAll('[data-lab-order] .gk-cost__part')];
    expect(parts.map((part) => part.textContent)).toEqual(['2K', '3K', '250', '4']);
    expect(parts[3]?.querySelector('img')?.getAttribute('src')).toBe('/assets/images/resources/asterium.webp');
    // The time an order takes, as minutes (not a ticking clock with seconds).
    expect(document.querySelector('[data-lab-order] .gk-cost [data-time]')?.textContent).toBe('30 dk');
    expect(screen.getByText('Tarifler')).toBeTruthy();
  });

  // Every recipe on the shelf is reachable by keyboard, not only the lit one (the shelf has no arrow keys).
  it('lets the keyboard reach every recipe on the shelf', async () => {
    harness(lab());
    const potions = await screen.findAllByRole('radio');
    expect(potions.map((one) => one.tabIndex)).toEqual([0, 0]);
  });

  it('keeps the shelf while a batch brews: the brewing capsule lit, no other can be picked', async () => {
    const later = new Date(Date.now() + 1_800_000);
    harness(lab({ job: { capsuleId: 'SILENT_THRUST', quantity: 2, delivered: 0, startedAt: NOW, nextAt: later, completesAt: later } }));
    const potions = await screen.findAllByRole('radio');
    expect(potions.map((one) => [one.getAttribute('aria-checked'), one.hasAttribute('disabled')]))
      .toEqual([['false', true], ['true', true]]);
    expect(document.querySelector('[data-lab-order]')).toBeNull();
  });

  it('shows a locked lab’s shelf, so the player sees what the Core opens', async () => {
    harness(lab({ unlocked: false, coreLevel: 7 }));
    const potions = await screen.findAllByRole('radio');
    expect(potions.every((one) => one.hasAttribute('disabled'))).toBe(true);
  });

  it('says what opens it while locked, and offers no start', async () => {
    harness(lab({ unlocked: false, coreLevel: 7 }));
    expect(await screen.findByText('Komuta Çekirdeği 10 seviyesinde açılır.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Sentezi başlat/ })).toBeNull();
  });

  it('shows a running batch with its progress and the cancel rule', async () => {
    const later = new Date(Date.now() + 1_800_000);
    harness(lab({ job: { capsuleId: 'SILENT_THRUST', quantity: 3, delivered: 1, startedAt: NOW, nextAt: later, completesAt: later } }));
    expect(await screen.findByText('3 kapsülden 1 tanesi hazır')).toBeTruthy();
    expect(screen.getByText('Yapılmamış kapsüllerin bedelinin yarısı geri döner.')).toBeTruthy();
  });

  /* The owner (2026-11-25): it must read as a chemistry lab — potions on a shelf, a rack of vials brewing. */
  it('lays the two capsules out as potions: picture, name, how many are held, the time each takes', async () => {
    harness(lab());
    const potions = await screen.findAllByRole('radio');
    expect(potions).toHaveLength(2);
    const [veil, silent] = potions;
    expect(veil?.getAttribute('aria-checked')).toBe('true');
    expect(veil?.querySelector('img')?.getAttribute('src')).toBe('/assets/ui/icons/capsule-veil.webp');
    expect(silent?.querySelector('img')?.getAttribute('src')).toBe('/assets/ui/icons/capsule-silent.webp');
    expect(veil?.textContent).toContain('Optik Örtü');
    expect(veil?.textContent).toContain('×1');
    expect(veil?.textContent).toContain('30 dk');
    expect(silent?.textContent).toContain('60 dk');
    await userEvent.click(silent!);
    expect(silent?.getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText(/Hedefe saldırı uyarısı ve alarm gitmez; saldırıyı savaş raporundan öğrenir/)).toBeTruthy();
    expect(document.querySelector('[data-testid="synthesis-lab"] img[src="/assets/images/resources/asterium.webp"]')).toBeTruthy();
    // The lab tells the whole of the veil, the attack case included.
    await userEvent.click(veil!);
    expect(screen.getByText(/Filon yalnız sana ve klanına görünür.*Saldırıda hedefin Radar'ı uyarıyı yine verir\./)).toBeTruthy();
  });

  it('brews a running batch in a rack: made vials full, the next one filling, the rest empty', async () => {
    const later = new Date(Date.now() + 1_800_000);
    harness(lab({ job: { capsuleId: 'SILENT_THRUST', quantity: 4, delivered: 1, startedAt: NOW, nextAt: later, completesAt: later } }));
    await screen.findByText('4 kapsülden 1 tanesi hazır');
    const vials = [...document.querySelectorAll('[data-vial]')].map((one) => one.getAttribute('data-vial'));
    expect(vials).toEqual(['full', 'brewing', 'empty', 'empty']);
  });

  it('is absent where the galaxy has no Asteryum', async () => {
    const fetcher = harness(lab({ enabled: false }));
    await waitFor(() => { expect(fetcher).toHaveBeenCalled(); });
    expect(screen.queryByText('Sentez Laboratuvarı')).toBeNull();
  });
});

describe('the capsule switches on a launch', () => {
  it('prices each switch from the fleet, locks a short one, and reports the choice', async () => {
    const onChange = vi.fn();
    render(<CapsuleRow kind="attack" fleet={{ DART: 200 }} held={{ OPTIC_VEIL: 1, SILENT_THRUST: 5 }} chosen={[]} onChange={onChange} />);
    const veil = screen.getByRole('switch', { name: /Optik Örtü/ });
    expect(veil.getAttribute('aria-disabled')).toBe('true');
    // The rule and this fleet's size, once: why it costs what it costs.
    expect(screen.getByText('500 hacim başına 1 kapsül · filon 600 hacim')).toBeTruthy();
    // Per capsule: what it needs, what is held, and whether that is enough, in words and in vials.
    expect(screen.getByText('2 gerekir · elinde 1 · 1 eksik')).toBeTruthy();
    expect(screen.getByText('2 gerekir · elinde 5 · kalkışta 3 kalır')).toBeTruthy();
    const pips = (id: string) => [...document.querySelectorAll(`[data-capsule-pips="${id}"] i`)].map((pip) => pip.hasAttribute('data-full'));
    expect(pips('OPTIC_VEIL')).toEqual([true, false]);
    expect(pips('SILENT_THRUST')).toEqual([true, true]);
    // What each does is read before the press, not after it.
    // Owner 2026-11-25: who still sees it, said plainly, and what the target's Radar still tells them; no "harita".
    expect(screen.getByText(/Filon yalnız sana ve klanına görünür.*Saldırıda hedefin Radar'ı uyarıyı yine verir\./)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/harita/i);
    await userEvent.click(veil);
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('switch', { name: /Sessiz İtki/ }));
    expect(onChange).toHaveBeenCalledWith(['SILENT_THRUST']);
  });

  it('shows each switch with its potion, the same picture the laboratory makes it under', () => {
    render(<CapsuleRow kind="attack" fleet={{ DART: 200 }} held={{ OPTIC_VEIL: 3, SILENT_THRUST: 3 }} chosen={[]} onChange={vi.fn()} />);
    const art = [...document.querySelectorAll('[data-launch-capsules] img')].map((img) => img.getAttribute('src'));
    expect(art).toEqual(['/assets/ui/icons/capsule-veil.webp', '/assets/ui/icons/capsule-silent.webp']);
  });

  // A settlement or a transfer has no attack warning to keep: the veil's line says only what it hides there.
  it('speaks of the target\'s Radar only on a flight that attacks', () => {
    render(<CapsuleRow kind="settlement" fleet={{ COURIER: 2 }} held={{ OPTIC_VEIL: 3, SILENT_THRUST: 0 }} chosen={[]} onChange={vi.fn()} />);
    expect(screen.getByText(/Filon yalnız sana ve klanına görünür/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/hedefin Radar/iu);
  });

  it('stays out of the way for a commander with no capsules', () => {
    render(<CapsuleRow kind="attack" fleet={{ DART: 200 }} held={{ OPTIC_VEIL: 0, SILENT_THRUST: 0 }} chosen={[]} onChange={vi.fn()} />);
    expect(screen.queryByRole('switch')).toBeNull();
  });
});
