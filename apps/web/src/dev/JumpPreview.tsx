import { VESSEL_HULLS, VESSEL_LOOKS, starterGalaxyCentre, type Vec3, type VesselHull, type VesselLook } from '@astera/rules';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import { galaxySchema } from '../api/schemas.js';
import { MigrationSequence } from '../galaxy/MigrationSequence.js';
import i18n from '../i18n/index.js';
import { startJump, useJump } from '../starter/jump.js';
import { pressedWorld } from '../starter/jumpWorld.js';
import '../styles.css';

// Dev-only review surface for the jump's flight, served like v2-gallery.html and omitted from the production entry.
// ?hull=SPINE|WEDGE|SEED&look=RENEWED&ordinal=1 — drive its clock from Playwright's page.clock to stop on any second.
const query = new URLSearchParams(location.search);
const pick = <T extends string>(list: readonly T[], value: string | null, fallback: T): T => list.find(item => item === value) ?? fallback;
const hull: VesselHull = pick(VESSEL_HULLS, query.get('hull'), 'SPINE');
const look: VesselLook = pick(VESSEL_LOOKS, query.get('look'), 'RENEWED');
const ordinal = Number(query.get('ordinal') ?? 1);
void i18n.changeLanguage(query.get('lng') ?? 'tr');

let seed = 11;
const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const sphere = (radius: number, inner = 0): Vec3 => {
  const u = random() * 2 - 1, a = random() * Math.PI * 2, r = inner + (radius - inner) * Math.cbrt(random());
  return { x: Math.sqrt(1 - u * u) * Math.cos(a) * r, y: u * r * 0.6, z: Math.sqrt(1 - u * u) * Math.sin(a) * r };
};
const main = Array.from({ length: 420 }, () => sphere(4500, 900));
// The new world on the side of the main galaxy that faces the ship's first galaxy, as most are.
const centre = starterGalaxyCentre(ordinal);
const out = Math.hypot(centre.x, centre.y, centre.z);
const landing = { x: (centre.x / out) * 3300 + 400, y: (centre.y / out) * 3300 + 150, z: (centre.z / out) * 3300 - 300 };
const planet = (over: Record<string, unknown>) => galaxySchema.shape.planets.element.parse({ intel: 'UNKNOWN', isSelf: false, isOwned: false, state: { kind: 'NORMAL' }, ...over });
const berth = { x: 260, y: 40, z: -180 };
const starter = [
  planet({ id: 'self', body: 'VESSEL', look, isSelf: true, position: berth }),
  ...Array.from({ length: 14 }, (_, i) => planet({ id: `ship-${String(i)}`, body: 'VESSEL', look: VESSEL_LOOKS[i % 3], position: sphere(900, 120) })),
  ...Array.from({ length: 5 }, (_, i) => planet({ id: `outpost-${String(i)}`, body: 'OUTPOST', outpost: true, position: sphere(900, 200) })),
];
const world = pressedWorld({ ordinal, berth, landing, planetId: 'preview-new-world', starter, main });

function Preview() {
  const jump = useJump();
  if (!jump) return <button type="button" style={{ color: 'white', padding: 24 }} onClick={() => { location.reload(); }}>again</button>;
  return <MigrationSequence jump={jump} />;
}

startJump({ shardName: 'Vantage', hull, look, world, landing: null, start: Number(query.get('start') ?? 0) });
const root = document.getElementById('root');
if (root) createRoot(root).render(<I18nextProvider i18n={i18n}><Preview /></I18nextProvider>);
