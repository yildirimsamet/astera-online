/**
 * THE GAME KIT GALLERY (direction B, owner 2026-11-11). Development only.
 *
 * `?view=ui-kit` lays every part out; the other views compose them into the screens a
 * player meets, so the kit is judged as a whole UI and not as loose parts:
 * `ui-kit-launch` (`&layout=bay` for the slider row), `ui-kit-base`, `ui-kit-hud`,
 * `ui-kit-list`, `ui-kit-report`.
 * Colours only through `--gk-*` tokens (test/game-ui/tokens.test.ts).
 */
import '../../game-ui/game-ui.css';
import type { HullClass } from '@astera/rules';
import { useEffect, useState, type ReactNode } from 'react';
import {
  Banner, BottomNav, CargoBar, Chip, CoachMark, CountBadge, CutPlate, Dialog, Dot, Emblem, EmptyState, GameButton, GameHold,
  GameTabs, Glyph, InfoPeek, LevelBadge, Lever, ListRow, LockBadge, MultiplierBadge, Plate, ProgressBar, RangeBars,
  ResourceHud, RoundButton, SectionTag, SheetFrame, Slider, SpendBar, StatPlaque, TextField, Timer, Toggle, UnitBay, UnitCard,
  Well, GLYPH_IDS, type HudResource,
} from '../../game-ui/index.js';
import { haptic } from '../../lib/haptics.js';
import { playSound } from '../../lib/sound.js';
import { BUILDING_ART, HULL_ART, RESOURCE_ART, planetArt } from '../../ui/assets.js';
import { StarField } from '../kit/StarField.js';

export const KIT_VIEWS = ['ui-kit', 'ui-kit-launch', 'ui-kit-base', 'ui-kit-hud', 'ui-kit-list', 'ui-kit-report'] as const;
export type KitView = typeof KIT_VIEWS[number];
export const isKitView = (view: string): view is KitView => (KIT_VIEWS as readonly string[]).includes(view);

const query = (name: string): string | null => new URLSearchParams(window.location.search).get(name);

const number = new Intl.NumberFormat('tr', { maximumFractionDigits: 1 });
const fmt = (value: number): string => number.format(value);
const art = (path: string | null): string => path ?? '';
const HAND = '/assets/images/general/tutorial-hand-icon.png';
const TARGET_ART = planetArt('tharsis');
const HOME_ART = planetArt('kestrel-12');

/** A phone-width page over the galaxy: every composed screen sits on the same ground. */
function Screen({ children, sky = true }: { children: ReactNode; sky?: boolean }) {
  return (
    <div className="gk gk-screen">
      {sky && <StarField className="absolute inset-0" />}
      {children}
    </div>
  );
}

export function GameKitGallery({ view, layout }: { view: KitView; layout?: 'cards' | 'bay' }) {
  const chosenLayout = layout ?? (query('layout') === 'bay' ? 'bay' : 'cards');
  if (view === 'ui-kit') return <Catalog />;
  return (
    <Screen>
      {view === 'ui-kit-launch' && <LaunchScreen layout={chosenLayout} />}
      {view === 'ui-kit-base' && <BaseScreen />}
      {view === 'ui-kit-hud' && <HudScreen />}
      {view === 'ui-kit-list' && <ListScreen />}
      {view === 'ui-kit-report' && <ReportScreen />}
    </Screen>
  );
}

/* ── the launch: the moment the kit is built around ─────────────────────────── */

interface Ship {
  id: 'DART' | 'PIKE' | 'RAMPART' | 'COURIER';
  name: string;
  cls: HullClass;
  home: number;
  start: number;
  /** Against the target's main class (Lance); null for a ship that does not fight. */
  mult: number | null;
  power: number;
  cargo: number;
  fuel: number;
}

const SHIPS: readonly Ship[] = [
  { id: 'DART', name: 'Ok', cls: 'SKIRMISHER', home: 52, start: 24, mult: 0.6, power: 0.5, cargo: 0.5, fuel: 2.8 },
  { id: 'PIKE', name: 'Kargı', cls: 'LANCE', home: 20, start: 8, mult: 1, power: 1.4, cargo: 0.25, fuel: 3.4 },
  { id: 'RAMPART', name: 'Sur', cls: 'BULWARK', home: 12, start: 4, mult: 1.6, power: 1.2, cargo: 0.15, fuel: 4.2 },
  { id: 'COURIER', name: 'Kurye', cls: 'SUPPORT', home: 17, start: 3, mult: null, power: 0, cargo: 0.7, fuel: 3 },
];
const PACES = [
  { id: 'full', label: 'Tam hız', minutes: 12, fuel: 1 },
  { id: '75', label: '%75', minutes: 16, fuel: 0.7 },
  { id: '50', label: '%50', minutes: 24, fuel: 0.45 },
] as const;
const FUEL_STOCK = 860;
const LOOT = { low: 13, high: 17 };
const NOW_MINUTES = 12 * 60 + 28;
const clock = (minutes: number): string =>
  `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

type Fleet = Record<Ship['id'], number>;
const START: Fleet = { DART: 24, PIKE: 8, RAMPART: 4, COURIER: 3 };

function LaunchScreen({ layout }: { layout: 'cards' | 'bay' }) {
  const [fleet, setFleet] = useState<Fleet>(START);
  const [pace, setPace] = useState<string>('full');
  const [escort, setEscort] = useState(true);
  const [picked, setPicked] = useState<Ship['id']>('DART');
  const [sent, setSent] = useState(0);
  const setShip = (id: Ship['id'], value: number): void => { setFleet((now) => ({ ...now, [id]: value })); };

  const total = SHIPS.reduce((sum, ship) => sum + fleet[ship.id], 0);
  const homeTotal = SHIPS.reduce((sum, ship) => sum + ship.home, 0);
  const power = SHIPS.reduce((sum, ship) => sum + fleet[ship.id] * ship.power * (ship.mult ?? 0), 0);
  const cargo = SHIPS.reduce((sum, ship) => sum + fleet[ship.id] * ship.cargo, 0);
  const speed = PACES.find((item) => item.id === pace) ?? PACES[0];
  const fuel = Math.round(SHIPS.reduce((sum, ship) => sum + fleet[ship.id] * ship.fuel, 0) * speed.fuel);
  const out = speed.minutes * 2 + 1;
  const covers = cargo >= LOOT.high;
  const pickedShip = SHIPS.find((ship) => ship.id === picked);

  useEffect(() => {
    if (sent === 0) return undefined;
    const done = window.setTimeout(() => { setSent(0); }, 2600);
    return () => { window.clearTimeout(done); };
  }, [sent]);

  return (
    <>
      <img className="gk-scene__target" src={TARGET_ART} alt="" />
      {sent > 0 && (
        <div className="gk-scene__toast">
          <Banner variant="toast" tone="good" glyph="rocket" title={`Filo yolda · ${fmt(total)} gemi`} body={`Tharsis’e varış ${clock(NOW_MINUTES + speed.minutes)}`} />
        </div>
      )}
      <SheetFrame
        className="gk-scene__sheet"
        tone="hostile"
        art={TARGET_ART}
        eyebrow="Akın · Sable’ın kolonisi"
        title="Tharsis"
        meta={<><span className="gk-pill gk-pill--warn">Denk hedef</span><span className="gk-sub inline-flex items-center gap-1"><Glyph id="clock" />3 sa önce görüldü</span></>}
        onClose={() => undefined}
        footer={(
          <GameHold
            label="SALDIR"
            detail={`${fmt(total)} gemi`}
            glyph="attack"
            commitSound="launch"
            disabledReason={total === 0 ? 'En az bir gemi seç' : null}
            onCommit={() => { haptic('warp'); setSent((n) => n + 1); }}
          />
        )}
      >
        <Plate className="grid gap-2 p-2.5">
          <SectionTag aside={<span className="gk-sub">son keşif 3 sa önce</span>}>Güç</SectionTag>
          <RangeBars
            mine={{ low: power * 0.92, high: power * 1.08 }}
            theirs={{ low: 21, high: null }}
            mineLabel="Sen"
            theirsLabel="Onlar"
            mineText={`${fmt(Math.round(power * 0.92))}–${fmt(Math.round(power * 1.08))} B`}
            theirsText="21 B+"
          />
          <InfoPeek
            lead={<Emblem cls="LANCE" hostile />}
            fact="Hedef Mızrak ağırlıklı"
            rule="Sur, Mızrak’ı ×1,6 vurur. Akıncı (Ok) Mızrak’a karşı ×0,6 kalır. Kargı denk vurur."
          />
        </Plate>

        <div className="mt-3">
          <SectionTag aside={<span className="gk-display gk-num">{fmt(total)}<span className="gk-sub"> / {fmt(homeTotal)}</span></span>}>Filo</SectionTag>
        </div>
        {layout === 'cards' ? (
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            {SHIPS.map((ship) => (
              <UnitCard
                key={ship.id}
                name={ship.name}
                art={art(HULL_ART[ship.id])}
                cls={ship.cls}
                multiplier={ship.mult}
                home={ship.home}
                chosen={fleet[ship.id]}
                onChange={(next) => { setShip(ship.id, next); }}
                {...(ship.id === 'COURIER' ? { extra: `+${fmt(fleet.COURIER * ship.cargo)} B kargo` } : {})}
              />
            ))}
          </div>
        ) : (
          <Plate className="mt-1.5 grid gap-2 p-2">
            <div className="grid grid-cols-4 gap-1.5">
              {SHIPS.map((ship) => (
                <UnitBay
                  key={ship.id}
                  name={ship.name}
                  art={art(HULL_ART[ship.id])}
                  cls={ship.cls}
                  multiplier={ship.mult}
                  home={ship.home}
                  chosen={fleet[ship.id]}
                  selected={picked === ship.id}
                  onSelect={() => { setPicked(ship.id); }}
                />
              ))}
            </div>
            {pickedShip && <Slider label={pickedShip.name} value={fleet[pickedShip.id]} max={pickedShip.home} onChange={(next) => { setShip(pickedShip.id, next); }} />}
          </Plate>
        )}

        <Plate className="mt-3 grid gap-2.5 p-2.5">
          <Lever label="Hız" options={PACES.map(({ id, label }) => ({ id, label }))} value={pace} onChange={setPace} note="Yavaş uçuş yakıt kazandırır, dönüşü geciktirir" />
          <Toggle checked={escort} onChange={setEscort} label="Komutan eşliği" sub="Komutan gemin filoya eşlik eder, savaşa girmez" />
          <SpendBar spend={fuel} stock={FUEL_STOCK} label="Yakıt" art={RESOURCE_ART.deuterium} text={`−${fmt(fuel)} / ${fmt(FUEL_STOCK)}`} />
        </Plate>

        <div className="mt-3 grid grid-cols-2 gap-1.5">
          <StatPlaque glyph="clock" label="Varış" value={`${String(speed.minutes)} dk`} sub={clock(NOW_MINUTES + speed.minutes)} />
          <StatPlaque glyph="back_home" label="Dönüş" value={clock(NOW_MINUTES + out)} sub={`dışarıda ${String(out)} dk`} />
          <div className="col-span-2">
            <StatPlaque glyph="crate" label="Kargo" value={`${fmt(cargo)} B`} sub={covers ? `ganimetin tamamı sığar · ~${String(LOOT.low)}–${String(LOOT.high)} B` : `ganimet ~${String(LOOT.low)}–${String(LOOT.high)} B · bir kısmı kalabilir`} tone={covers ? 'good' : 'warn'}>
              <CargoBar capacity={cargo} loot={LOOT} />
            </StatPlaque>
          </div>
          <StatPlaque glyph="bay" label="Uçuş yuvası" value="2 / 3" sub="bu sefer 1" />
          <StatPlaque glyph="shield" label="Evde kalan" value={fmt(homeTotal - total)} sub="gemi üssü korur" />
        </div>

        <div className="mt-3">
          <Banner variant="strip" tone="warn" title={`Kestrel-12 ${String(out)} dk savunmasız`} body="Filo dönene kadar evde yalnız kalan gemiler savunur." />
        </div>
      </SheetFrame>
    </>
  );
}

/* ── the base: a building that is worth raising ─────────────────────────────── */

const UNLOCKS = [
  { id: 'VIPER', name: 'Engerek', cls: 'SKIRMISHER' },
  { id: 'TALON', name: 'Pençe', cls: 'LANCE' },
  { id: 'STRONGHOLD', name: 'Hisar', cls: 'BULWARK' },
  { id: 'SENTINEL', name: 'Nöbetçi', cls: 'BULWARK' },
  { id: 'WAYFARER', name: 'Seyyah', cls: 'SUPPORT' },
] as const;

function BaseScreen() {
  const [building, setBuilding] = useState(false);
  return (
    <>
      <img className="gk-scene__target" src={HOME_ART} alt="" />
      <SheetFrame
        className="gk-scene__sheet gk-scene__sheet--short"
        tone="self"
        art={art(BUILDING_ART.SHIPYARD)}
        eyebrow="Kestrel-12 · Üs"
        title="Tersane"
        meta={<><LevelBadge level={1} /><Glyph id="next" /><LevelBadge level={2} /><span className="gk-sub">Yeni gemileri açar</span></>}
        onClose={() => undefined}
        footer={building ? (
          <div className="grid grid-cols-[1fr_auto] items-center gap-2">
            <div className="grid gap-1">
              <span className="gk-label">Tersane 2 yapılıyor</span>
              <ProgressBar value={12} max={160} thick tone="good" text="2 sa 28 dk" label="Tersane 2" />
            </div>
            <GameButton tone="self" size="sm" glyph="speed" onPress={() => undefined}>Hızlandır</GameButton>
          </div>
        ) : (
          <GameButton tone="action" size="lg" wide glyph="up" detail="2 sa 40 dk" onPress={() => { playSound('weld'); haptic('commit'); setBuilding(true); }}>
            YÜKSELT
          </GameButton>
        )}
      >
        <CutPlate tone="self" className="grid gap-2 p-2.5">
          <SectionTag aside={<span className="gk-sub">Tersane 2</span>}>Açılacak gemiler</SectionTag>
          <div className="grid grid-cols-5 gap-1">
            {UNLOCKS.map((ship) => (
              <div key={ship.id} className="gk-unlock gk-well">
                <span className="gk-unlock__class"><Emblem cls={ship.cls} /></span>
                <img className="gk-unlock__art" src={art(HULL_ART[ship.id])} alt="" />
                <span className="gk-unlock__name">{ship.name}</span>
              </div>
            ))}
          </div>
          <p className="gk-sub">Bu gemiler Tersane 2 ile senin olur: daha hızlı akıncılar, daha ağır kalkanlar.</p>
        </CutPlate>
        <Plate className="mt-3 grid gap-2.5 p-2.5">
          <SectionTag>Bedel</SectionTag>
          <SpendBar spend={2400} stock={9800} label="Alaşım" art={RESOURCE_ART.alloy} text="2,4 B / 9,8 B" />
          <SpendBar spend={900} stock={2100} label="Kristal" art={RESOURCE_ART.crystal} text="900 / 2,1 B" />
        </Plate>
        <div className="mt-3 grid grid-cols-2 gap-1.5">
          <StatPlaque glyph="clock" label="Süre" value="2 sa 40 dk" sub="inşaat yuvası 1 / 1" />
          <StatPlaque glyph="star" label="Sonraki" value="Tersane 3" sub="Kristal yetmiyor" tone="warn" />
        </div>
      </SheetFrame>
    </>
  );
}

/* ── the HUD: the world a player opens the game into ────────────────────────── */

const HUD: readonly HudResource[] = [
  { id: 'alloy', art: RESOURCE_ART.alloy, amount: '9,8 B', rate: '+2,2 B', store: 0.62, tone: 'alloy', label: 'Alaşım' },
  { id: 'crystal', art: RESOURCE_ART.crystal, amount: '2,1 B', rate: '+640', store: 1, tone: 'crystal', label: 'Kristal' },
  { id: 'deut', art: RESOURCE_ART.deuterium, amount: '860', rate: '+180', store: 0.3, tone: 'deut', label: 'Döteryum' },
];

function HudScreen() {
  const [tab, setTab] = useState('galaxy');
  return (
    <div className="gk-scene">
      <ResourceHud items={HUD} end={<RoundButton glyph="bell" label="Bildirimler" onPress={() => undefined} />} />
      <div className="gk-scene__rail">
        <CutPlate tone="hostile" className="gk-scene__flight">
          <Timer remaining={7 * 60} total={12 * 60} text="7:00" glyph="attack" />
          <span className="min-w-0">
            <span className="gk-label block">Akın · Tharsis</span>
            <span className="gk-sub block truncate">39 gemi · varış 12:40</span>
          </span>
        </CutPlate>
        <CutPlate tone="self" className="gk-scene__flight">
          <Timer remaining={50 * 60} total={160 * 60} text="2:28" glyph="up" />
          <span className="min-w-0">
            <span className="gk-label block">Tersane 2</span>
            <span className="gk-sub block truncate">yapılıyor</span>
          </span>
        </CutPlate>
      </div>
      <div className="gk-scene__world">
        <img className="gk-scene__planet" src={HOME_ART} alt="" />
        <span className="gk-scene__name gk-display gk-outlined">KESTREL-12</span>
        <span className="gk-pill gk-pill--self"><Glyph id="shield" />Başkent · korunuyor</span>
      </div>
      <div className="gk-scene__toast gk-scene__toast--low">
        <Banner variant="toast" tone="good" glyph="crate" title="Filo döndü" body="+15,2 B ganimet ambara indi" />
      </div>
      <div className="gk-scene__nav">
        <CoachMark x={50} y={10} hand={HAND} step="2/3" text="Filon hazır: hedef seçmek için Filo’ya dokun" />
        <BottomNav
          label="Ana menü"
          value={tab}
          onChange={setTab}
          items={[
            { id: 'galaxy', label: 'Galaksi', art: TARGET_ART },
            { id: 'base', label: 'Üs', art: art(BUILDING_ART.CORE), badge: 1 },
            { id: 'fleet', label: 'Filo', art: art(HULL_ART.PIKE) },
            { id: 'intel', label: 'İstihbarat', art: '/assets/images/general/telescope_1.png', badge: 3 },
            { id: 'clan', label: 'Klan', art: '/assets/images/clan/perk-banner.webp', locked: 'Tersane 2 ile açılır' },
          ]}
        />
      </div>
    </div>
  );
}

/* ── the ladder ─────────────────────────────────────────────────────────────── */

const LADDER = [
  { name: 'Vargas', crest: 'VG', sub: 'Kızıl Kanat · 3 koloni', value: '48.210' },
  { name: 'Ilyra', crest: 'IL', sub: 'Kuzey Yayı · 3 koloni', value: '41.905' },
  { name: 'Okan', crest: 'OK', sub: 'Kızıl Kanat · 2 koloni', value: '39.660' },
  { name: 'Mirae', crest: 'MI', sub: 'Yalnız · 2 koloni', value: '31.004' },
  { name: 'Sable', crest: 'SA', sub: 'Kuzey Yayı · 2 koloni', value: '28.740' },
  { name: 'Teodor', crest: 'TE', sub: 'Yalnız · 1 koloni', value: '22.118' },
  { name: 'Sen', crest: 'SN', sub: 'Kestrel-12 · 1 koloni', value: '19.552', me: true },
  { name: 'Hale', crest: 'HA', sub: 'Kızıl Kanat · 1 koloni', value: '17.230' },
];

function ListScreen() {
  const [tab, setTab] = useState('honor');
  return (
    <SheetFrame
      className="gk-scene__sheet gk-scene__sheet--tall"
      art="/assets/images/clan/perk-banner.webp"
      eyebrow="Sezon 18 · 4 gün kaldı"
      title="Sıralama"
      meta={<span className="gk-sub">İlk üç sezon sonunda anıta yazılır</span>}
      onClose={() => undefined}
      footer={<ListRow rank={7} crest="SN" name="Sen" sub="6. sıraya 2.566 Onur" value="19.552" me onPress={() => undefined} />}
    >
      <GameTabs
        label="Sıralama türü"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'honor', label: 'Onur' },
          { id: 'dominion', label: 'Hakimiyet', badge: 1 },
          { id: 'clan', label: 'Klan', locked: 'Bir klana katıl' },
        ]}
      />
      <div className="mt-2 grid gap-1">
        {LADDER.map((row, index) => (
          <ListRow key={row.name} rank={index + 1} crest={row.crest} name={row.name} sub={row.sub} value={row.value} me={row.me === true} onPress={() => undefined} />
        ))}
      </div>
    </SheetFrame>
  );
}

/* ── the report: the outcome a player comes back for ────────────────────────── */

function ReportScreen() {
  const [claimed, setClaimed] = useState(false);
  return (
    <>
      <img className="gk-scene__target gk-scene__target--centre" src={TARGET_ART} alt="" />
      <Dialog
        ribbon="ZAFER"
        tone="good"
        rays
        actions={claimed ? (
          <Banner variant="block" tone="good" title="Ganimet ambara indi" body="Kestrel-12 · +15,2 B" />
        ) : (
          <>
            <GameButton tone="action" size="lg" wide glyph="crate" onPress={() => { playSound('crate'); haptic('commit'); setClaimed(true); }}>GANİMETİ AL</GameButton>
            <GameButton tone="ghost" size="sm" wide onPress={() => undefined}>Savaş raporunu aç</GameButton>
          </>
        )}
      >
        <div className="grid justify-items-center gap-1 text-center">
          <span className="gk-display gk-outlined" style={{ fontSize: 'var(--gk-t-title)' }}>Tharsis düştü</span>
          <span className="gk-sub">Sable’ın filosu geri çekildi · 12:40</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          <Loot art={RESOURCE_ART.alloy} value="+8,4 B" label="Alaşım" />
          <Loot art={RESOURCE_ART.crystal} value="+4,1 B" label="Kristal" />
          <Loot art={RESOURCE_ART.deuterium} value="+2,7 B" label="Döteryum" />
        </div>
        <Well className="mt-2 grid grid-cols-[auto_1fr_auto] items-center gap-2 px-2 py-1.5">
          <Emblem cls="SKIRMISHER" />
          <span className="gk-sub">Kayıp: 6 Ok · 1 Kargı</span>
          <span className="gk-display gk-num gk-tone-hostile">−7</span>
        </Well>
        <div className="mt-2">
          <Banner variant="strip" tone="info" glyph="star" title="Yeni istihbarat" body="Sable’ın iki kolonisi haritada belirdi" />
        </div>
      </Dialog>
    </>
  );
}

function Loot({ art: src, value, label }: { art: string; value: string; label: string }) {
  return (
    <div className="gk-loot gk-well" role="group" aria-label={`${label} ${value}`}>
      <img className="gk-loot__art" src={src} alt="" />
      <span className="gk-display gk-num gk-outlined gk-tone-good">{value}</span>
    </div>
  );
}

/* ── the catalogue: every part, side by side ────────────────────────────────── */

const SWATCHES = [
  ['action', 'Eylem · tek ana hamle'], ['self', 'Sen · seçili'], ['hostile', 'Düşman · kayıp'], ['good', 'Kazanç'],
  ['warn', 'Risk (ikonla)'], ['info', 'Bilgi'], ['alloy', 'Alaşım'], ['crystal', 'Kristal'], ['deut', 'Döteryum'], ['gold', 'Altın · 1.'],
] as const;
const TYPE = [
  ['hero', 'Kahraman 30'], ['head', 'Başlık 24'], ['title', 'Unvan 19'], ['number', 'Sayı 18'],
  ['lead', 'Öne çıkan 16'], ['body', 'Gövde 14'], ['small', 'Küçük 13'], ['floor', 'Taban 12'],
] as const;
const GLYPH_SAMPLES = { eye: 'Keşif', colony: 'Koloni', recall: 'Geri çağır', escape: 'Kaçış', support: 'Destek', repair: 'Onarım' } as const;

function Catalog() {
  const [toggle, setToggle] = useState(true);
  const [lever, setLever] = useState('75');
  const [slider, setSlider] = useState(24);
  const [chosen, setChosen] = useState(8);
  const [tab, setTab] = useState('a');
  const [nav, setNav] = useState('base');
  const [name, setName] = useState('Kızıl Kanat');
  const [count, setCount] = useState(3);
  return (
    <Screen sky={false}>
      <div className="gk-catalog">
        <header className="grid gap-2">
          <h1 className="gk-display gk-outlined" style={{ fontSize: 'var(--gk-t-head)' }}>OYUN ARAYÜZ KİTİ</h1>
        </header>

        <Section title="Renk rolleri">
          <div className="grid grid-cols-2 gap-1.5">
            {SWATCHES.map(([id, label]) => (
              <span key={id} className="gk-swatch gk-well">
                <span className="gk-swatch__chip" style={{ background: `var(--gk-${id})` }} />
                <span className="gk-sub">{label}</span>
              </span>
            ))}
          </div>
        </Section>

        <Section title="Yazı ölçeği">
          {TYPE.map(([id, label]) => (
            <div key={id} className="flex items-baseline justify-between gap-2">
              <span className={id === 'body' || id === 'small' || id === 'floor' ? '' : 'gk-display gk-outlined'} style={{ fontSize: `var(--gk-t-${id})` }}>Filo yolda 39</span>
              <span className="gk-sub">{label}</span>
            </div>
          ))}
        </Section>

        <Section title="Butonlar">
          <GameButton tone="action" size="lg" wide glyph="rocket" detail="39 gemi · 12 dk" onPress={() => undefined}>GÖNDER</GameButton>
          <div className="grid grid-cols-2 gap-1.5">
            <GameButton tone="steel" onPress={() => undefined}>İptal</GameButton>
            <GameButton tone="self" glyph="check" onPress={() => undefined}>Seç</GameButton>
            <GameButton tone="danger" glyph="close" onPress={() => undefined}>Geri çağır</GameButton>
            <GameButton tone="ghost" onPress={() => undefined}>Sonra</GameButton>
            <GameButton tone="action" size="sm" cost={<><img src={RESOURCE_ART.alloy} alt="" className="size-4" />2,4 B</>} onPress={() => undefined}>Kur</GameButton>
            <GameButton tone="steel" pending onPress={() => undefined}>Gönderiliyor</GameButton>
          </div>
          <GameButton tone="action" wide disabledReason="Kristal yetmiyor · 2,6 B gerek" onPress={() => undefined}>Yükselt</GameButton>
          <div className="flex items-center gap-1">
            <RoundButton glyph="close" label="Kapat" onPress={() => undefined} />
            <RoundButton glyph="back" label="Geri" onPress={() => undefined} />
            <RoundButton glyph="help" label="Yardım" tone="self" onPress={() => undefined} />
            <RoundButton glyph="close" label="Sil" tone="danger" small onPress={() => undefined} />
            <Chip on onPress={() => undefined}>Tümü</Chip>
            <Chip onPress={() => undefined}>Akın</Chip>
          </div>
        </Section>

        <Section title="Basılı tut · kritik hamle">
          <GameHold label="SALDIR" detail="39 gemi" glyph="attack" commitSound="launch" onCommit={() => undefined} />
          <GameHold label="GERİ ÇAĞIR" detail="dönüş 8 dk" tone="danger" glyph="back_home" onCommit={() => undefined} />
          <GameHold label="SALDIR" onCommit={() => undefined} disabledReason="Uçuş yuvası dolu · 12:40’ta açılır" />
        </Section>

        <Section title="Plakalar">
          <Plate bolts className="p-3"><span className="gk-sub">Metal plaka · cıvatalı</span></Plate>
          <div className="grid grid-cols-2 gap-1.5">
            <Plate edge="self" className="p-2.5"><span className="gk-sub">Seçili kenar</span></Plate>
            <Plate edge="hostile" className="p-2.5"><span className="gk-sub">Düşman kenarı</span></Plate>
            <CutPlate tone="self" className="p-2.5"><span className="gk-sub">Kesik köşe · sen</span></CutPlate>
            <CutPlate tone="hostile" className="p-2.5"><span className="gk-sub">Kesik köşe · düşman</span></CutPlate>
          </div>
          <Well className="p-2.5"><span className="gk-sub">Cam yuva: plakaya gömülü değer alanı</span></Well>
        </Section>

        <Section title="Rozetler">
          <div className="flex flex-wrap items-center gap-2">
            <span className="relative inline-block size-10"><CountBadge value={count} /></span>
            <span className="relative inline-block size-10"><CountBadge value={0} /></span>
            <MultiplierBadge value={1.6} />
            <MultiplierBadge value={1} />
            <MultiplierBadge value={0.6} />
            <LevelBadge level={7} />
            <LockBadge reason="Tersane 2" />
            <span className="relative inline-block size-6"><Dot count={3} /></span>
            <GameButton tone="steel" size="sm" glyph="plus" onPress={() => { setCount((n) => n + 1); }}>Say</GameButton>
          </div>
          <div className="flex items-center gap-2">
            <Emblem cls="SKIRMISHER" /><Emblem cls="LANCE" /><Emblem cls="BULWARK" /><Emblem cls="SUPPORT" />
            <Emblem cls="SKIRMISHER" hostile /><Emblem cls="LANCE" hostile /><Emblem cls="BULWARK" hostile />
          </div>
        </Section>

        <Section title="Glifler · 32 px ve altı">
          <div role="group" aria-label="Glifler" className="gk-well grid grid-cols-10 gap-x-1 gap-y-2 p-2.5" style={{ fontSize: 22 }}>
            {GLYPH_IDS.map((id) => <span key={id} title={id} className="grid place-items-center"><Glyph id={id} /></span>)}
          </div>
          <div className="flex flex-wrap items-center gap-1.5" style={{ fontSize: 16 }}>
            {(['eye', 'colony', 'recall', 'escape', 'support', 'repair'] as const).map((id) => (
              <span key={id} className="gk-pill gk-pill--self"><Glyph id={id} />{GLYPH_SAMPLES[id]}</span>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <RoundButton glyph="settings" label="Ayarlar" onPress={() => undefined} />
            <RoundButton glyph="mail" label="Posta" onPress={() => undefined} />
            <RoundButton glyph="share" label="Paylaş" tone="self" onPress={() => undefined} />
            <GameButton tone="action" size="sm" glyph="eye" onPress={() => undefined}>Sonda</GameButton>
            <GameButton tone="steel" size="sm" glyph="refresh" onPress={() => undefined}>Yenile</GameButton>
          </div>
        </Section>

        <Section title="Çubuklar">
          <ProgressBar value={18} max={24} thick text="18 / 24" label="İnşaat" />
          <ProgressBar value={3} max={5} segments={5} tone="good" label="Görev" />
          <ProgressBar value={1} max={1} tone="warn" text="Depo dolu" label="Depo" />
          <RangeBars mine={{ low: 24, high: 28 }} theirs={{ low: 21, high: null }} mineLabel="Sen" theirsLabel="Onlar" mineText="24–28 B" theirsText="21 B+" />
          <SpendBar spend={120} stock={860} label="Yakıt" art={RESOURCE_ART.deuterium} text="−120 / 860" />
          <div className="grid gap-1"><span className="gk-label">Kargo ve ganimet</span><CargoBar capacity={16.7} loot={LOOT} /></div>
        </Section>

        <Section title="Okumalar">
          <ResourceHud items={HUD} />
          <div className="grid grid-cols-2 gap-1.5">
            <StatPlaque glyph="clock" label="Varış" value="12 dk" sub="12:40" />
            <StatPlaque glyph="shield" label="Risk" value="25 dk" sub="üs savunmasız" tone="warn" />
          </div>
          <div className="flex items-center gap-3">
            <Timer remaining={420} total={720} text="7:00" />
            <Timer remaining={60} total={720} text="1:00" glyph="attack" />
          </div>
        </Section>

        <Section title="Kontroller">
          <Toggle checked={toggle} onChange={setToggle} label="Komutan eşliği" sub="Filoya eşlik eder, savaşa girmez" />
          <Lever label="Hız" options={PACES.map(({ id, label }) => ({ id, label }))} value={lever} onChange={setLever} note="Yavaş uçuş yakıt kazandırır" />
          <Slider label="Ok" value={slider} max={52} onChange={setSlider} />
          <GameTabs label="Klan" value={tab} onChange={setTab} tabs={[{ id: 'a', label: 'Genel' }, { id: 'b', label: 'Üyeler', badge: 2 }, { id: 'c', label: 'Savaş', locked: 'Klan seviyesi 2' }]} />
          <TextField label="Klan adı" value={name} onChange={setName} placeholder="En fazla 24 harf" />
          <InfoPeek lead={<Emblem cls="LANCE" hostile />} fact="Hedef Mızrak ağırlıklı" rule="Sur, Mızrak’ı ×1,6 vurur." />
        </Section>

        <Section title="Geri bildirim">
          <Banner tone="good" title="Filo döndü" body="+15,2 B ganimet ambara indi" />
          <Banner tone="warn" variant="strip" title="Kestrel-12 25 dk savunmasız" />
          <Banner tone="hostile" title="Saldırı geliyor" body="Sable · 8 dk sonra" action={<GameButton tone="danger" size="sm" onPress={() => undefined}>Gör</GameButton>} />
          <Banner tone="info" variant="toast" title="İstihbarat güncellendi" />
          <EmptyState art={art(HULL_ART.PIKE)} title="Hangar boş" body="Tersane’de ilk gemini üret; filo burada toplanır." action={<GameButton tone="action" onPress={() => undefined}>Tersane’ye git</GameButton>} />
        </Section>

        <Section title="Liste">
          <div className="grid gap-1">
            <ListRow rank={1} crest="VG" name="Vargas" sub="Kızıl Kanat" value="48.210" onPress={() => undefined} />
            <ListRow rank={2} crest="IL" name="Ilyra" sub="Kuzey Yayı" value="41.905" onPress={() => undefined} />
            <ListRow rank={3} crest="OK" name="Okan" sub="Kızıl Kanat" value="39.660" onPress={() => undefined} />
            <ListRow rank={7} crest="SN" name="Sen" sub="Kestrel-12" value="19.552" me onPress={() => undefined} />
          </div>
        </Section>

        <Section title="Gemi kartı ve bölme">
          <div className="grid grid-cols-2 gap-2">
            <UnitCard name="Kargı" art={art(HULL_ART.PIKE)} cls="LANCE" multiplier={1} home={20} chosen={chosen} onChange={setChosen} />
            <UnitCard name="Sur" art={art(HULL_ART.RAMPART)} cls="BULWARK" multiplier={1.6} home={12} chosen={0} onChange={() => undefined} />
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            <UnitBay name="Ok" art={art(HULL_ART.DART)} cls="SKIRMISHER" multiplier={0.6} home={52} chosen={24} selected onSelect={() => undefined} />
            <UnitBay name="Kargı" art={art(HULL_ART.PIKE)} cls="LANCE" multiplier={1} home={20} chosen={chosen} selected={false} onSelect={() => undefined} />
            <UnitBay name="Sur" art={art(HULL_ART.RAMPART)} cls="BULWARK" multiplier={1.6} home={12} chosen={4} selected={false} onSelect={() => undefined} />
            <UnitBay name="Kurye" art={art(HULL_ART.COURIER)} cls="SUPPORT" multiplier={null} home={17} chosen={3} selected={false} onSelect={() => undefined} />
          </div>
        </Section>

        <Section title="Alt menü">
          <BottomNav
            label="Örnek menü"
            value={nav}
            onChange={setNav}
            items={[
              { id: 'galaxy', label: 'Galaksi', art: TARGET_ART },
              { id: 'base', label: 'Üs', art: art(BUILDING_ART.CORE), badge: 1 },
              { id: 'fleet', label: 'Filo', art: art(HULL_ART.PIKE) },
              { id: 'clan', label: 'Klan', art: '/assets/images/clan/perk-banner.webp', locked: 'Tersane 2' },
            ]}
          />
        </Section>
      </div>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-2">
      <SectionTag>{title}</SectionTag>
      {children}
    </section>
  );
}
