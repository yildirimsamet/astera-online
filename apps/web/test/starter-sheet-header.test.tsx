import { QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { keys } from '../src/api/keys.js';
import { vesselSchema } from '../src/api/starterSchemas.js';
import { WorldProvider } from '../src/api/world.js';
import { StarterLesson } from '../src/starter/tutorial/visualGoal.js';
import type { TutorialAnswer } from '../src/starter/tutorial/script.js';
import { GalaxyView } from '../src/screens/GalaxyView.js';
import { vesselToPlanetView } from '../src/starter/adapter.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { createCosmeticTrialClient } from '../src/v2/gallery/CosmeticTrialGallery.js';
import { wireVessel } from './starterVesselFixture.js';

const canvas = vi.hoisted(() => vi.fn(() => null));
vi.mock('../src/galaxy/GalaxyCanvas.js', () => ({ GalaxyCanvas: canvas }));
vi.mock('../src/lib/preload.js', () => ({ GALAXY_ASSETS: [], usePreload: () => ({ ready: true, progress: 1 }) }));
vi.mock('../src/lib/openingCover.js', () => ({ useOpeningCover: () => false }));

afterEach(cleanup);

const asked: string[] = [];
const show = (features: readonly string[], lesson: TutorialAnswer | null = null) => {
  asked.length = 0;
  const client = createCosmeticTrialClient();
  const vessel = vesselSchema.parse(wireVessel({ features }));
  // The active world is the trial's capital, so the ship has to answer under that key as well.
  for (const key of [keys.planet, keys.planetById('trial-home')]) client.setQueryData(key, { ...vesselToPlanetView(vessel), vessel }, { updatedAt: Date.now() + 86_400_000 });
  const fetch: typeof globalThis.fetch = (input) => {
    asked.push(new URL(input instanceof Request ? input.url : String(input), 'https://test.invalid').pathname);
    return new Promise<Response>(() => undefined);
  };
  render(<QueryClientProvider client={client}><ApiProvider api={new Api({ fetch })}>
    <WorldProvider><ToastProvider><StarterLesson.Provider value={lesson}><GalaxyView panel="planet" onPanel={vi.fn()} commander="Orion" onSignOut={vi.fn()} /></StarterLesson.Provider></ToastProvider></WorldProvider>
  </ApiProvider></QueryClientProvider>);
};

describe('the starter ship uses the Base sheet header', () => {
  it('keeps the name, badge, art and close in a fixed header before the deck switch', () => {
    show(['fleet']);
    const panel = screen.getByRole('dialog');
    const head = panel.querySelector('header');
    expect(head?.querySelector('h2')).not.toHaveClass('sr-only');
    expect(head?.querySelector('[data-sheet-close]')).not.toBeNull();
    expect(head?.parentElement).not.toHaveClass('absolute');
    expect(panel.querySelector('[data-sheet-art]')).not.toBeNull();
    expect(head?.querySelector('[data-ship-badge]')).not.toBeNull();
    const decks = screen.getByTestId('ship-decks');
    expect(head && head.compareDocumentPosition(decks) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(panel.querySelector('[data-sheet-body] [data-sheet-close]')).toBeNull();
  });
});

it('shows the real telescope reach when the lesson asks for it, without a saved toggle',()=>{
 show(['telescope'],{kind:'step',id:'telescopeLook',step:'read',chapter:7,strict:false,marks:[]});
 expect(canvas).toHaveBeenLastCalledWith(expect.objectContaining({showTelescopeReach:true}),undefined);
});
