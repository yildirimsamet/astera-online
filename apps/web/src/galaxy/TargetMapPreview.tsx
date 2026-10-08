import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import type { GalaxyPlanet } from '../api/schemas.js';
import i18n from '../i18n/index.js';
import { GalaxyCanvas } from './GalaxyCanvas.js';
import type { Focus } from './FocusPanel.js';
import '../styles.css';

// A small, deterministic neighbourhood in the real renderer. No API or account.
const HOME = { x: 1100, y: 0, z: 0 };
const world = (id: string, name: string, dx: number, dz: number, over: Partial<GalaxyPlanet> = {}): GalaxyPlanet => ({
  id, name, owner: 'Mira', country: 'JP', kind: 'CAPITAL', coreTier: 1, coreLevel: 3,
  position: { x: HOME.x + dx * 50, y: 0, z: dz * 50 },
  intel: 'RESOLVED', state: { kind: 'NORMAL' }, satellites: [], shielded: false, isSelf: false,
  ...over,
});
const WORLDS = [
  world('home', 'Bellwether', 0, 0, { owner: 'Yıldırım', country: 'TR', coreTier: 2, coreLevel: 6, isSelf: true, isOwned: true }),
  world('vega', 'Vega', -5, -9),
  world('kestrel', 'Kestrel', 6, -9, { owner: 'Ada', country: 'DE' }),
  world('memory', 'Solace', -3.5, 3, { owner: 'Orin', country: 'FR', intel: 'REMEMBERED', seenAt: new Date(Date.now() - 2 * 60 * 60_000) }),
  world('neutral', 'Aster-21', 4, 6, { owner: '', country: undefined, kind: 'NEUTRAL', neutral: { tier: 1, claimUntil: null } }),
  world('unknown', 'Hidden world', 3, 3, { owner: 'Hidden commander', country: 'GB', intel: 'UNKNOWN' }),
];

function TargetMapPreview() {
  const [focus, setFocus] = useState<Focus | null>(null);
  return <div className="h-dvh w-full" data-map-preview-focus={focus?.kind === 'planet' ? focus.id : ''}>
    <GalaxyCanvas planets={WORLDS} pending={[]} contacts={[]} asteroids={[]} runs={[]} wrecks={[]}
      homePosition={HOME} activePlanetId="home" aegisLevel={0} seasonStart={undefined}
      focus={focus} onFocus={setFocus} homeSignal={0} />
  </div>;
}

void i18n.changeLanguage(new URLSearchParams(window.location.search).get('lang') ?? 'tr');
const root = document.getElementById('root');
if (root) createRoot(root).render(<I18nextProvider i18n={i18n}><TargetMapPreview /></I18nextProvider>);
