import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { keys } from '../src/api/keys.js';
import { WorldProvider } from '../src/api/world.js';
import i18n from '../src/i18n/index.js';
import { GalaxyView, type Panel } from '../src/screens/GalaxyView.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { createCosmeticTrialClient } from '../src/v2/gallery/CosmeticTrialGallery.js';

vi.mock('../src/galaxy/GalaxyCanvas.js', () => ({ GalaxyCanvas: () => null }));
vi.mock('../src/lib/preload.js', () => ({ GALAXY_ASSETS: [], usePreload: () => ({ ready: true, progress: 1 }) }));
vi.mock('../src/lib/openingCover.js', () => ({ useOpeningCover: () => false }));

/** A storm blowing now, as the events route hands it over. */
const storm = () => {
  const now = Date.now();
  return { id: '00000000-0000-4000-8000-0000000000a1', kind: 'ASTERIUM_STORM' as const, startsAt: new Date(now - 60_000), endsAt: new Date(now + 30 * 60_000) };
};

function show({ arena }: { arena: boolean }) {
  const client = createCosmeticTrialClient();
  client.setQueryData(keys.galaxyEvents, { next: null, events: [storm()] });
  const onPanel = vi.fn<(panel: Panel) => void>();
  const silent: typeof fetch = () => new Promise<Response>(() => undefined);
  render(<QueryClientProvider client={client}><ApiProvider api={new Api({ fetch: silent })}>
    <WorldProvider><ToastProvider><GalaxyView panel={null} onPanel={onPanel} commander="Orion" onSignOut={vi.fn()} showChat={false} showGuidance
      {...(arena ? { onEnterArena: vi.fn() } : {})} /></ToastProvider></WorldProvider>
  </ApiProvider></QueryClientProvider>);
  return onPanel;
}

const chip = () => screen.getByRole('button', { name: new RegExp(`^${i18n.t('synthesis.storm.chip')}`) });

/*
  THE STORM'S CHIP GOES TO THE SHIP (owner 2026-11-27: "Fırtına badge'ine tıklayınca Gemi menüsüne gitsin").
  The storm is something to fly into: the ship tab is where the hangar sends the commander ship to the
  Yarık, so the chip opens that, not the schedule of events.
*/
describe('the Asteryum storm chip on the galaxy', () => {
  it('opens the ship tab, where the hangar flies into the Yarık', () => {
    const onPanel = show({ arena: true });
    fireEvent.click(chip());
    expect(onPanel).toHaveBeenCalledWith('ship');
    expect(screen.queryByRole('dialog', { name: i18n.t('galaxy.eventsGuide.title') })).toBeNull();
  });

  it('falls back to the events guide where there is no hangar to open', () => {
    const onPanel = show({ arena: false });
    fireEvent.click(chip());
    expect(onPanel).not.toHaveBeenCalledWith('ship');
    expect(screen.getByRole('dialog', { name: i18n.t('galaxy.eventsGuide.title') })).toBeInTheDocument();
  });
});
