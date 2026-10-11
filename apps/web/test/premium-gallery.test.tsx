import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GalaxyCanvas } from '../src/galaxy/GalaxyCanvas.js';
import { PremiumSpaceGallery } from '../src/v2/gallery/PremiumSpaceGallery.js';
import { asteroidModelUrl } from '../src/galaxy/asteroidAppearance.js';
import { ASTEROID_MODELS } from '../src/ui/assets.js';
import { PremiumShipInspector } from '../src/galaxy/PremiumShipInspector.js';
import type * as ShipInspectorModule from '../src/galaxy/PremiumShipInspector.js';
import { cosmeticsInCategory } from '@astera/rules';

vi.mock('../src/galaxy/GalaxyCanvas.js', () => ({ GalaxyCanvas: vi.fn(() => null) }));
vi.mock('../src/galaxy/PremiumShipInspector.js', async importOriginal => ({
  ...await importOriginal<typeof ShipInspectorModule>(),
  PremiumShipInspector: vi.fn(() => null),
}));
const scene = () => vi.mocked(GalaxyCanvas).mock.calls.at(-1)![0];
const inspector = () => vi.mocked(PremiumShipInspector).mock.calls.at(-1)![0];

describe('premium asset review gallery', () => {
  beforeEach(() => { window.history.replaceState(null, '', '/v2-gallery.html?view=premium-space&lng=tr'); });

  it('restores a shareable single-ship view after a preview reload', () => {
    window.history.replaceState(null, '', '/v2-gallery.html?view=premium-space&lng=tr&scene=ship&craft=COURIER&angle=back&engines=off');
    render(<PremiumSpaceGallery />);
    expect(inspector()).toMatchObject({ craft: 'COURIER', angle: 'back', engines: false });
  });

  it('validates malformed preview choices and preserves the selected scene across reloads', () => {
    window.history.replaceState(null, '', '/v2-gallery.html?view=premium-space&lng=tr&scene=invalid&craft=invalid&angle=invalid');
    const mounted = render(<PremiumSpaceGallery />);
    expect(inspector()).toMatchObject({ craft: 'DART', angle: 'quarter', engines: true });
    fireEvent.click(screen.getByRole('button', { name: 'Anıt' }));
    expect(new URLSearchParams(window.location.search).get('scene')).toBe('monument');
    mounted.unmount();
    render(<PremiumSpaceGallery />);
    expect(scene().monuments).toHaveLength(1);
    expect(scene().focus).toEqual({ kind: 'monument', id: 'premium-monument' });
  });
  it('opens one ship alone and lets the reviewer change the model, view and engine', () => {
    render(<PremiumSpaceGallery />);
    expect(inspector()).toMatchObject({ craft: 'DART', angle: 'quarter', engines: true });
    fireEvent.change(screen.getByRole('combobox', { name: 'İncelenecek gemi' }), { target: { value: 'LEVIATHAN' } });
    expect(inspector().craft).toBe('LEVIATHAN');
    fireEvent.click(screen.getByRole('button', { name: 'Arka' }));
    expect(inspector().angle).toBe('back');
    fireEvent.click(screen.getByRole('button', { name: 'Motoru kapat' }));
    expect(inspector().engines).toBe(false);
  });

  it.each(['ship-red-dragon', 'ship-shark', 'ship-scorpion', 'ship-stingray', 'probe-ufo'])('opens the actual equipped model %s in an isolated, shareable view', craft => {
    window.history.replaceState(null, '', `/v2-gallery.html?view=premium-space&scene=ship&craft=${craft}&angle=side`);
    render(<PremiumSpaceGallery />);
    expect(inspector()).toMatchObject({ craft, angle: 'side', engines: true });
    expect(screen.getByRole('combobox', { name: 'İncelenecek gemi' })).toHaveValue(craft);
  });

  it.each(cosmeticsInCategory('ENGINE').map(item => item.id))('restores the purchased flame %s on the selected ship skin', engineId => {
    window.history.replaceState(null, '', `/v2-gallery.html?view=premium-space&scene=ship&craft=ship-shark&angle=back&engine=${engineId}`);
    render(<PremiumSpaceGallery />);
    expect(inspector()).toMatchObject({ craft: 'ship-shark', angle: 'back', engineId });
    expect(screen.getByRole('combobox', { name: 'Motor alevi' })).toHaveValue(engineId);
  });

  it('persists a flame change and rejects unrelated or unknown cosmetics', () => {
    window.history.replaceState(null, '', '/v2-gallery.html?view=premium-space&scene=ship&craft=CATACLYSM&engine=ring-aurora');
    const mounted = render(<PremiumSpaceGallery />);
    expect(inspector().engineId).toBeUndefined();
    expect(screen.getByRole('combobox', { name: 'Motor alevi' })).toHaveValue('native');
    fireEvent.change(screen.getByRole('combobox', { name: 'Motor alevi' }), { target: { value: 'engine-prism' } });
    expect(inspector()).toMatchObject({ craft: 'CATACLYSM', engineId: 'engine-prism', engines: true });
    expect(new URLSearchParams(window.location.search).get('engine')).toBe('engine-prism');
    mounted.unmount();
    render(<PremiumSpaceGallery />);
    expect(inspector().engineId).toBe('engine-prism');
    fireEvent.change(screen.getByRole('combobox', { name: 'Motor alevi' }), { target: { value: 'native' } });
    expect(inspector().engineId).toBeUndefined();
  });

  it('keeps the engine skin control unavailable for craft with their own propulsion', () => {
    render(<PremiumSpaceGallery />);
    for (const craft of ['death-star', 'probe', 'probe-ufo', 'trade-ship']) {
      fireEvent.change(screen.getByRole('combobox', { name: 'İncelenecek gemi' }), { target: { value: craft } });
      expect(screen.getByRole('combobox', { name: 'Motor alevi' })).toBeDisabled();
    }
  });

  it('isolates the fleet from planets, rocks, wrecks, monuments and strategic traffic', () => {
    render(<PremiumSpaceGallery />);
    fireEvent.click(screen.getByRole('button', { name: 'Filo' }));
    expect(scene().pending).toHaveLength(1);
    expect(scene().pending[0]?.kind).toBe('fleet');
    expect(scene().pending[0]?.fleet).toMatchObject({ DART: 1, TALON: 1, SENTINEL: 1, LEVIATHAN: 1, COURIER: 1 });
    expect(scene().planets).toHaveLength(0);
    expect(scene().asteroids).toHaveLength(0);
    expect(scene().monuments).toHaveLength(0);
    expect(scene().wrecks).toHaveLength(0);
  });

  it('shows only a wreck field or the selected asteroid when those examples are selected', () => {
    render(<PremiumSpaceGallery />);
    fireEvent.click(screen.getByRole('button', { name: 'Enkaz' }));
    expect(scene().wrecks).toHaveLength(1);
    expect(scene().wrecks[0]?.planetId).toBeNull();
    expect(scene().planets).toHaveLength(0);
    expect(scene().pending).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'İzotop asteroidi' }));
    expect(scene().asteroids).toHaveLength(1);
    expect(scene().asteroids[0]?.isotopeRich).toBe(true);
    expect(scene().wrecks).toHaveLength(0);
    expect(scene().pending).toHaveLength(0);
  });

  it('lets the reviewer inspect each ordinary asteroid model separately from the isotope model', () => {
    render(<PremiumSpaceGallery />);
    fireEvent.click(screen.getByRole('button', { name: 'İzotop asteroidi' }));
    for (const [value, model] of ASTEROID_MODELS.entries()) {
      fireEvent.change(screen.getByRole('combobox', { name: 'Asteroid modeli' }), { target: { value: String(value) } });
      const rock = scene().asteroids[0]!;
      expect(rock.isotopeRich).toBe(false);
      expect(asteroidModelUrl(rock)).toBe(model);
      expect(scene().asteroids).toHaveLength(1);
      expect(scene().pending).toHaveLength(0);
      expect(new URLSearchParams(window.location.search).get('asteroid')).toBe(String(value));
    }
    fireEvent.change(screen.getByRole('combobox', { name: 'Asteroid modeli' }), { target: { value: 'isotope' } });
    expect(scene().asteroids[0]?.isotopeRich).toBe(true);
  });

  it('frames debris and asteroids closely and keeps fixed samples away from the galactic core', () => {
    render(<PremiumSpaceGallery />);
    fireEvent.click(screen.getByRole('button', { name: 'Enkaz' }));
    expect(scene().reviewFocusDistance).toBe(2.1);
    const target = scene().wrecks[0]!.at;
    expect(Math.hypot(target.x, target.z)).toBeGreaterThan(1000);
    fireEvent.click(screen.getByRole('button', { name: 'İzotop asteroidi' }));
    expect(scene().reviewFocusDistance).toBe(2.4);
    fireEvent.click(screen.getByRole('button', { name: 'Gezegen' }));
    expect(scene().planets[0]?.position).toEqual(target);
    fireEvent.click(screen.getByRole('button', { name: 'Anıt' }));
    expect(scene().monuments?.[0]?.position).toEqual(target);
    fireEvent.click(screen.getByRole('button', { name: 'Stratejik çarpma' }));
    expect(scene().pending[0]?.path?.to).toEqual(target);
    expect(scene().planets[0]?.position).toEqual(target);
    fireEvent.click(screen.getByRole('button', { name: 'Madencilik' }));
    expect(scene().runs[0]?.intercept).toEqual(target);
  });

  it('keeps each probe and strategic flight alone and repeatable', () => {
    render(<PremiumSpaceGallery />);
    fireEvent.click(screen.getByRole('button', { name: 'Probe uçuşu' }));
    expect(scene().pending).toHaveLength(1);
    expect(scene().pending[0]?.kind).toBe('probe');
    fireEvent.click(screen.getByRole('button', { name: 'Ölüm Yıldızı uçuşu' }));
    const flight = scene().pending[0]!;
    expect(flight.kind).toBe('death_star');
    expect(flight.path!.arriveAt.getTime() - flight.path!.departAt.getTime()).toBeGreaterThan(60_000);
    expect(scene().focus).toEqual({ kind: 'thread', key: flight.id });
    expect(scene().planets).toHaveLength(0);
    const firstId = flight.id;
    fireEvent.click(screen.getByRole('button', { name: 'Tekrar oynat' }));
    expect(scene().pending[0]?.id).not.toBe(firstId);
  });

  it('isolates bombardment and strategic impact to one attacker and one target', () => {
    render(<PremiumSpaceGallery />);
    for (const label of ['Savaş', 'Stratejik çarpma']) {
      fireEvent.click(screen.getByRole('button', { name: label }));
      expect(scene().pending).toHaveLength(1);
      expect(scene().planets).toHaveLength(1);
      expect(scene().planets[0]?.id).toBe('p-2');
      expect(scene().monuments).toHaveLength(0);
      expect(scene().asteroids).toHaveLength(0);
      expect(scene().wrecks).toHaveLength(0);
    }
  });

  it('isolates a monument and selects its model without showing a background fleet', () => {
    render(<PremiumSpaceGallery />);
    fireEvent.click(screen.getByRole('button', { name: 'Anıt' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Anıt modeli' }), { target: { value: '5' } });
    expect(scene().monuments).toHaveLength(1);
    expect(scene().monuments?.[0]?.ordinal).toBe(5);
    expect(scene().pending).toHaveLength(0);
    expect(scene().planets).toHaveLength(0);
  });

  it('lets the reviewer inspect one planet with the actual Dyson ladder', () => {
    render(<PremiumSpaceGallery />);
    fireEvent.click(screen.getByRole('button', { name: 'Gezegen' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Dyson seviyesi' }), { target: { value: '24' } });
    expect(scene().planets).toHaveLength(1);
    expect(scene().planets[0]).toMatchObject({ coreLevel: 24, coreTier: 5 });
    expect(scene().pending).toHaveLength(0);
    expect(scene().monuments).toHaveLength(0);
    fireEvent.change(screen.getByRole('combobox', { name: 'Dyson seviyesi' }), { target: { value: '6' } });
    expect(scene().planets[0]).toMatchObject({ coreLevel: 6, coreTier: 2 });
  });
});
