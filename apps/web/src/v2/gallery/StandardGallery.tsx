/**
 * THE STANDARD'S OPEN DECISIONS (stage 2.2–2.8, 2026-11-12). Development only.
 *
 * `?view=ui-kit-standard`: each decision with its options drawn in kit parts, so the
 * owner picks by looking and pressing on the phone. Nothing here changes a game screen.
 * The measurements and the reasoning behind each option:
 * docs/ui-standart-karar-paketleri-2026-11-12.md.
 */
import { useId, useState, type ReactNode } from 'react';
import {
  Banner, Chip, GameButton, GameHold, GameTabs, InfoPeek, ListRow, MultiplierBadge, Plate, ResourceHud, RoundButton, SectionTag,
  StatPlaque, StatusChip, Toggle, type HudResource,
} from '../../game-ui/index.js';
import type { CssVars } from '../../game-ui/style.js';
import { haptic, type Weight } from '../../lib/haptics.js';
import { playSound, type SoundCue } from '../../lib/sound.js';
import { RESOURCE_ART, planetArt } from '../../ui/assets.js';

/* ── 2.2 type: one composition, three ladders ───────────────────────────────── */

export interface TypeLadder {
  /** meta: a time, a unit, a count */
  floor: number;
  /** a label, a rule line */
  small: number;
  /** every sentence a player reads */
  body: number;
  /** button words, a value */
  lead: number;
  title: number;
  /** a sheet's title */
  head: number;
  number: number;
  hero: number;
}

/**
 * today: the game's screens now (`styles.css`: micro 9, caption 10, body 12; the launch
 * button reads 12). rival: Whiteout and Clash Royale measured on the S22 (research §7.1–7.2).
 * kit: the game kit's own ladder (`tokens.css`).
 */
export const TYPE_LADDERS = {
  today: { floor: 9, small: 10, body: 12, lead: 12, title: 16, head: 18, number: 17, hero: 27 },
  rival: { floor: 10, small: 11, body: 13, lead: 16, title: 18, head: 20, number: 18, hero: 27 },
  kit: { floor: 12, small: 13, body: 14, lead: 16, title: 19, head: 24, number: 18, hero: 30 },
} as const satisfies Record<string, TypeLadder>;

export type LadderId = keyof typeof TYPE_LADDERS;
const isLadder = (id: string): id is LadderId => id in TYPE_LADDERS;

/** A ladder as the kit's type tokens, scaled by the text size setting to whole pixels. */
export function ladderVars(id: LadderId, factor: number): CssVars {
  const ladder: TypeLadder = TYPE_LADDERS[id];
  const px = (value: number): string => `${String(Math.round(value * factor))}px`;
  return {
    '--gk-t-floor': px(ladder.floor),
    '--gk-t-small': px(ladder.small),
    '--gk-t-body': px(ladder.body),
    '--gk-t-lead': px(ladder.lead),
    '--gk-t-title': px(ladder.title),
    '--gk-t-head': px(ladder.head),
    '--gk-t-number': px(ladder.number),
    '--gk-t-hero': px(ladder.hero),
  };
}

/* ── 2.8 numbers ────────────────────────────────────────────────────────────── */

export type NumberStyle = 'today' | 'game' | 'full';
const isNumberStyle = (id: string): id is NumberStyle => id === 'today' || id === 'game' || id === 'full';

const whole = new Intl.NumberFormat('tr-TR');
const fixed = (value: number, digits: number): string =>
  value.toLocaleString('tr-TR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const upTo = (value: number): string => value.toLocaleString('tr-TR', { maximumFractionDigits: 1 });

/**
 * A big number three ways. `today` is `lib/format` `stock` in Turkish (whole up to
 * 99.999, then "240 B", "1,4 Mn"); `game` keeps the Turkish comma and takes the K and M
 * every game prints, Whiteout in Turkish included ("240,1K"); `full` never shortens.
 */
export function shortNumber(value: number, style: NumberStyle): string {
  const n = Math.round(value);
  if (style === 'full' || n < 100_000) return whole.format(n);
  if (style === 'today') {
    return n >= 1_000_000 ? `${fixed(n / 1_000_000, n >= 10_000_000 ? 0 : 1)}\u00a0Mn` : `${fixed(n / 1_000, 0)}\u00a0B`;
  }
  const thousands = Math.round(n / 100) / 10;
  return thousands < 1_000 ? `${upTo(thousands)}K` : `${upTo(Math.round(n / 100_000) / 10)}M`;
}

/* ── 2.3 words ──────────────────────────────────────────────────────────────── */

/** Words as the audit counts them (W1): every piece holding a letter or a digit. */
export const countWords = (text: string): number => text.split(/\s+/).filter((piece) => /[\p{L}\p{N}]/u.test(piece)).length;

/* ── the page ───────────────────────────────────────────────────────────────── */

export function StandardGallery() {
  return (
    <div className="gk-catalog gk-std">
      <header className="grid gap-1">
        <h1 className="gk-display gk-outlined" style={{ fontSize: 'var(--gk-t-head)' }}>STANDART KARARLARI</h1>
        <p className="gk-sub">Her karar için seçeneklere dokun; aynı parça seçilen kuralla yeniden çizilir.</p>
      </header>
      <TypeDecision />
      <BudgetDecision />
      <TouchDecision />
      <ColourDecision />
      <TimingDecision />
      <SpaceDecision />
      <NumberDecision />
    </div>
  );
}

function Decision({ no, title, question, advice, children }: { no: string; title: string; question: string; advice: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="grid gap-2">
      <SectionTag><span id={id}>{no} · {title}</span></SectionTag>
      <p className="gk-sub">{question}</p>
      {children}
      <Banner variant="strip" tone="good" glyph="star" title="Önerim" body={advice} />
    </section>
  );
}

function TypeDecision() {
  const [ladder, setLadder] = useState<LadderId>('kit');
  const [bigger, setBigger] = useState(false);
  const steps: TypeLadder = TYPE_LADDERS[ladder];
  return (
    <Decision
      no="2.2"
      title="Yazı ölçeği"
      question="Okunan yazı kaç px olsun? Aynı kart, üç ölçek."
      advice="B: taban 12, cümle 14, buton 16, başlık 24. Ayarlarda %115 seçeneği 5. aşamada gelir."
    >
      <GameTabs
        label="Yazı ölçeği seçenekleri"
        value={ladder}
        onChange={(id) => { if (isLadder(id)) setLadder(id); }}
        tabs={[{ id: 'today', label: 'Bugün' }, { id: 'rival', label: 'A · Rakip' }, { id: 'kit', label: 'B · Kit' }]}
      />
      <Toggle checked={bigger} onChange={setBigger} label="Yazı boyutu ayarı %115" sub="60 yaş üstü için ayar" />
      <p className="gk-sub gk-num">
        taban {steps.floor} · etiket {steps.small} · cümle {steps.body} · buton {steps.lead} · başlık {steps.head}
      </p>
      <div data-std-sample className="gk-std__sample" style={ladderVars(ladder, bigger ? 1.15 : 1)}>
        <Plate className="grid gap-2.5 p-3">
          <div className="grid gap-0.5">
            <span className="gk-label">Kestrel-12 · Üs</span>
            <span className="gk-display gk-outlined" style={{ fontSize: 'var(--gk-t-head)' }}>Stratejik savunma bataryası</span>
            <span className="gk-sub">Aegis, Depo ve yer savunmalarını burada geliştirirsin.</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <StatPlaque glyph="clock" label="Süre" value="2 sa 40 dk" sub="inşaat yuvası 1 / 1" />
            <StatPlaque glyph="shield" label="Aegis" value="+1.240" sub="Sv. 4 → 5" tone="good" />
          </div>
          <InfoPeek
            fact="Aegis hasarı ilk alır"
            rule="Aktif Aegis, savaş hasarını gemilerden ve yer savunmalarından önce alır. Savaşta sıfırlanırsa yeniden dolmaya başlaması 15 dakika sürer."
          />
          <GameButton tone="action" size="lg" wide glyph="up" detail="2 sa 40 dk" onPress={() => undefined}>YÜKSELT</GameButton>
        </Plate>
      </div>
    </Decision>
  );
}

function BudgetDecision() {
  const [budget, setBudget] = useState('today');
  return (
    <Decision
      no="2.3"
      title="Metin bütçesi"
      question="Bir ekranda kaç cümle? Bugünkü klan desteği ekranı ve aynı bilginin bütçeli hâli."
      advice="Detay ekranında en çok 1–3 cümle; kural satırda değil, “?” ile açılan kutuda."
    >
      <GameTabs
        label="Metin bütçesi seçenekleri"
        value={budget}
        onChange={setBudget}
        tabs={[{ id: 'today', label: 'Bugün' }, { id: 'budget', label: 'Bütçeli' }]}
      />
      <div data-std-sample className="gk-std__sample">
        {budget === 'today' ? <SupportToday /> : <SupportBudget />}
      </div>
    </Decision>
  );
}

/** The clan support sheet's own Turkish copy (`i18n/locales/tr/clanSupport.ts`), as it reads today. */
function SupportToday() {
  return (
    <Plate className="grid gap-2 p-3">
      <span className="gk-label">Klan desteği → Vega-4</span>
      <span className="gk-sub">Bu klan arkadaşının dünyasına gemi konuşlandır. Saldırı gelirse orada savaşırlar.</span>
      <div className="grid grid-cols-2 gap-1.5">
        <StatPlaque glyph="fuel" label="Yakıt" value="120" sub="gidiş ve dönüş · iade yok" />
        <StatPlaque glyph="clock" label="Varış" value="12:40" />
        <StatPlaque glyph="support" label="Ev sahibi yeri" value="4" sub="bu dalgadan sonra" />
        <StatPlaque glyph="rocket" label="Uçuş yuvası" value="2 / 3" sub="eve dönene dek dolu" />
      </div>
      <span className="gk-sub">En çok 8 sa kalır · 21:40 sonra biter</span>
      <span className="gk-sub">Sen kademe 3 · ev sahibi kademe 3 · ±1 içinde</span>
      <span className="gk-sub">
        Destekçi olarak Hâkimiyetin değişmez. Kalıcı gemi kayıpların, ev sahibinin Hâkimiyet hesabına kaynak değeriyle eklenir.
        Destek çarpanı ev sahibinin kendi savaş kaybını büyütür ve kazancını azaltır; senin kaybını çarpmaz.
      </span>
      <span className="gk-sub">
        Ev sahibinin geri çekilmesi açıksa ve saldırı tüm hattı ezecekse gemilerin yakıt harcamadan hatla birlikte kalkar. Değilse savaşır.
      </span>
      <span className="gk-sub">Havadayken geri döndür ya da indikten sonra istediğin an eve çağır.</span>
      <GameButton tone="action" size="lg" wide glyph="support" onPress={() => undefined}>6 GEMİ GÖNDER</GameButton>
    </Plate>
  );
}

/** The same facts on budget: values on plates, one sentence, the rules one tap away. */
function SupportBudget() {
  return (
    <Plate className="grid gap-2 p-3">
      <span className="gk-label">Klan desteği → Vega-4</span>
      <span className="gk-sub">Gemilerin orada nöbet tutar; saldırı gelirse savaşır.</span>
      <div className="grid grid-cols-2 gap-1.5">
        <StatPlaque glyph="fuel" label="Yakıt" value="120" sub="iade yok" />
        <StatPlaque glyph="clock" label="Varış" value="12:40" />
        <StatPlaque glyph="timed" label="Kalış" value="8 sa" />
        <StatPlaque glyph="rocket" label="Yuva" value="2 / 3" />
      </div>
      <InfoPeek
        fact="Hâkimiyetin değişmez"
        rule="Kalıcı gemi kayıpların, ev sahibinin Hâkimiyet hesabına kaynak değeriyle eklenir. Destek çarpanı senin kaybını çarpmaz."
      />
      <InfoPeek
        fact="Hat ezilecekse birlikte kalkar"
        rule="Ev sahibinin geri çekilmesi açıksa gemilerin yakıt harcamadan hatla birlikte kalkar. Değilse savaşır."
      />
      <GameButton tone="action" size="lg" wide glyph="support" onPress={() => undefined}>6 GEMİ GÖNDER</GameButton>
    </Plate>
  );
}

function TouchDecision() {
  const [hit, setHit] = useState('44');
  const [hits, setHits] = useState(false);
  const [tab, setTab] = useState('honor');
  const style: CssVars = { '--gk-hit': `${hit}px` };
  return (
    <Decision
      no="2.4"
      title="Dokunma ve yerleşim"
      question="En küçük dokunma alanı 44 mü 48 mi? Görünen boyut küçük kalabilir; alan küçülmez."
      advice="44 px taban; sık ve önemli eylem 56 px ve altta; kapat hep sağ üstte."
    >
      <GameTabs
        label="Dokunma alanı seçenekleri"
        value={hit}
        onChange={setHit}
        tabs={[{ id: '44', label: '44 px' }, { id: '48', label: '48 px' }]}
      />
      <Toggle checked={hits} onChange={setHits} label="Dokunma alanını göster" sub="kesik çizgi = parmağın vurduğu alan" />
      <div data-std-sample className="gk-std__sample grid gap-2" style={style} {...(hits ? { 'data-std-hits': '' } : {})}>
        <GameTabs label="Örnek sekmeler" value={tab} onChange={setTab} tabs={[{ id: 'honor', label: 'Onur' }, { id: 'dominion', label: 'Hakimiyet' }, { id: 'clan', label: 'Klan' }]} />
        <div className="flex flex-wrap items-center gap-1">
          <Chip onPress={() => undefined} on>Maks</Chip>
          <Chip onPress={() => undefined}>Yarısı</Chip>
          <Chip onPress={() => undefined}>Sıfırla</Chip>
          <span className="flex-1" />
          <RoundButton glyph="help" label="Nasıl çalışır" onPress={() => undefined} />
          <RoundButton glyph="close" label="Kapat" onPress={() => undefined} />
        </div>
        <div className="grid gap-1">
          <ListRow rank={1} crest="VG" name="Vargas" sub="Kızıl Kanat · 3 koloni" value="48.210" onPress={() => undefined} />
          <ListRow rank={7} crest="SN" name="Sen" sub="Kestrel-12 · 1 koloni" value="19.552" me onPress={() => undefined} />
        </div>
        <div className="grid grid-cols-[auto_1fr] gap-2">
          <GameButton size="sm" onPress={() => undefined}>Vazgeç</GameButton>
          <GameButton tone="action" size="lg" wide glyph="rocket" onPress={() => undefined}>GÖNDER</GameButton>
        </div>
      </div>
    </Decision>
  );
}

/**
 * Colour vision at full strength, Machado, Oliveira & Fernandes 2009 (severity 1.0),
 * applied in linear RGB as the audit's simulation does.
 */
const VISION = {
  normal: null,
  deutan: '0.367322 0.860646 -0.227968 0 0 0.280085 0.672501 0.047413 0 0 -0.01182 0.04294 0.968881 0 0 0 0 0 1 0',
  protan: '0.152286 1.052583 -0.204868 0 0 0.114503 0.786281 0.099216 0 0 -0.003882 -0.048116 1.051998 0 0 0 0 0 1 0',
  tritan: '1.255528 -0.076749 -0.178779 0 0 -0.078411 0.930809 0.147602 0 0 0.004733 0.691367 0.3039 0 0 0 0 0 1 0',
} as const;
type Vision = keyof typeof VISION;
const isVision = (id: string): id is Vision => id in VISION;

const HUD: readonly HudResource[] = [
  { id: 'alloy', art: RESOURCE_ART.alloy, amount: '9.840', rate: '+2.200', store: 0.62, tone: 'alloy', label: 'Alaşım' },
  { id: 'crystal', art: RESOURCE_ART.crystal, amount: '2.140', rate: '+640', store: 1, tone: 'crystal', label: 'Kristal' },
  { id: 'deut', art: RESOURCE_ART.deuterium, amount: '860', rate: '+180', store: 0.3, tone: 'deut', label: 'Döteryum' },
];

function ColourDecision() {
  const [vision, setVision] = useState<Vision>('normal');
  const base = `gk-cvd${useId().replace(/[^\w-]/g, '')}`;
  const matrix = VISION[vision];
  const style: CssVars = matrix === null ? {} : { filter: `url(#${base}-${vision})` };
  return (
    <Decision
      no="2.5"
      title="Renk rolleri ve kontrast"
      question="Her renk tek bir anlam taşır ve yanında hep ikon, şekil ya da yazı olur. Sekmeler o rengi göremeyen oyuncunun gözüdür (tam renk körlüğü)."
      advice="Kitin 6 rolü: amber eylem, turkuaz sen, kırmızı düşman, yeşil kazanç, sarı risk, mavi bilgi. Resim üstündeki yazı plakada."
    >
      <svg className="gk-std__defs" aria-hidden="true" focusable="false">
        <defs>
          {(['deutan', 'protan', 'tritan'] as const).map((id) => (
            <filter key={id} id={`${base}-${id}`} colorInterpolationFilters="linearRGB">
              <feColorMatrix type="matrix" values={VISION[id]} />
            </filter>
          ))}
        </defs>
      </svg>
      <GameTabs
        label="Renk görüşü"
        value={vision}
        onChange={(id) => { if (isVision(id)) setVision(id); }}
        tabs={[{ id: 'normal', label: 'Normal' }, { id: 'deutan', label: 'Yeşil' }, { id: 'protan', label: 'Kırmızı' }, { id: 'tritan', label: 'Mavi' }]}
      />
      <div data-std-sample className="gk-std__sample grid gap-2" style={style}>
        <ResourceHud items={HUD} />
        <div className="flex flex-wrap gap-1.5">
          <GameButton tone="action" glyph="attack" onPress={() => undefined}>SALDIR</GameButton>
          <GameButton tone="self" glyph="check" onPress={() => undefined}>Seçili</GameButton>
          <GameButton tone="danger" glyph="close" onPress={() => undefined}>Bırak</GameButton>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <StatusChip glyph="speed_up" tone="good" label="Hız artışı" value="+20%" />
          <StatusChip glyph="defense_down" tone="hostile" label="Savunma düşüşü" value="−15%" />
          <StatusChip glyph="radiation" tone="warn" label="Radyasyon" value="Bölgede" />
          <StatusChip glyph="shield" tone="info" label="Kalkan" value="Kalkan" until="45 dk" />
        </div>
        <div className="flex items-center gap-2">
          <span className="gk-sub">Karşı sınıf:</span>
          <MultiplierBadge value={1.5} />
          <MultiplierBadge value={0.625} />
        </div>
        <div className="gk-std__ground" style={{ backgroundImage: `url(${planetArt('tharsis')})` }}>
          <span className="gk-sub">Çıplak yazı · 12:40 varış</span>
          <span className="gk-display gk-outlined">Konturlu · 12:40 varış</span>
          <span className="gk-std__plate gk-sub">Plakada · 12:40 varış</span>
        </div>
      </div>
    </Decision>
  );
}

const HAPTICS: readonly { weight: Weight; sound: SoundCue; label: string }[] = [
  { weight: 'tap', sound: 'tap', label: 'Dokunuş' },
  { weight: 'commit', sound: 'confirm', label: 'Onay' },
  { weight: 'warn', sound: 'alert', label: 'Uyarı' },
  { weight: 'thunk', sound: 'switch', label: 'Şalter' },
];

function TimingDecision() {
  const [speed, setSpeed] = useState('240');
  const [open, setOpen] = useState(false);
  const drawer: CssVars = { '--std-ms': `${speed}ms` };
  return (
    <Decision
      no="2.6"
      title="Süreler ve geri bildirim"
      question="Basılı tutma eylemin ağırlığına göre uzar. Telefonda bas ve hisset."
      advice="Geri alınan 0,6 sn, kaynak harcayan 1 sn, geri alınamayan 1,5 sn. Basma tepkisi 80 ms, panel 240 ms."
    >
      <div className="grid gap-1">
        <span className="gk-label">Geri alınır · filo geri çağrılabilir</span>
        <GameHold label="Gönder" detail="0,6 sn" weight="reversible" onCommit={() => undefined} />
        <span className="gk-label mt-1">Kaynak harcar</span>
        <GameHold label="Yükselt" detail="1 sn" glyph="up" weight="spends" onCommit={() => undefined} />
        <span className="gk-label mt-1">Geri alınamaz</span>
        <GameHold label="Ayrıl" detail="1,5 sn" tone="danger" glyph="close" weight="final" onCommit={() => undefined} />
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <div className="grid gap-1">
          <span className="gk-label">Bugün: tepki yok</span>
          <button type="button" className="gk-std__flat">Filonu seç</button>
        </div>
        <div className="grid gap-1">
          <span className="gk-label">Kit: 80 ms'de göçer</span>
          <GameButton wide onPress={() => undefined}>Filonu seç</GameButton>
        </div>
      </div>
      <GameTabs
        label="Panel açılış hızı"
        value={speed}
        onChange={setSpeed}
        tabs={[{ id: '160', label: '160 ms' }, { id: '240', label: '240 ms' }, { id: '320', label: '320 ms' }]}
      />
      <div className="gk-std__stage" style={drawer}>
        <GameButton size="sm" glyph={open ? 'down' : 'up'} onPress={() => { setOpen((was) => !was); }}>{open ? 'Paneli kapat' : 'Paneli aç'}</GameButton>
        <div className="gk-std__drawer" {...(open ? { 'data-open': '' } : {})} aria-hidden={!open}>
          <Plate className="grid gap-1 p-2.5">
            <span className="gk-label">Tharsis</span>
            <span className="gk-sub">Panel açılış hızı seçilen sürede</span>
          </Plate>
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {HAPTICS.map((tier) => (
          <Chip key={tier.weight} onPress={() => { playSound(tier.sound); haptic(tier.weight); }}>{tier.label}</Chip>
        ))}
      </div>
    </Decision>
  );
}

function SpaceDecision() {
  const [gutter, setGutter] = useState('12');
  const style: CssVars = { '--std-gutter': `${gutter}px` };
  return (
    <Decision
      no="2.7"
      title="Boşluk"
      question="Ekran kenarı 12 mi 16 mı? Değerler 4 px adımında; kontrol içinde 2 px yarım adım."
      advice="12 px kenar (350 px'te iki sayı sütunu sığar), 4'ün katları; yarım adım yalnız kontrol içinde."
    >
      <GameTabs
        label="Kenar boşluğu seçenekleri"
        value={gutter}
        onChange={setGutter}
        tabs={[{ id: '12', label: '12 px kenar' }, { id: '16', label: '16 px kenar' }]}
      />
      <div data-std-sample className="gk-std__sample gk-std__gutter grid gap-1" style={style}>
        <ListRow rank={1} crest="VG" name="Vargas" sub="Kızıl Kanat · 3 koloni" value="48.210" onPress={() => undefined} />
        <ListRow rank={2} crest="IL" name="Ilyra" sub="Kuzey Yayı · 3 koloni" value="41.905" onPress={() => undefined} />
        <div className="grid grid-cols-2 gap-1.5">
          <StatPlaque glyph="clock" label="Süre" value="2 sa 40 dk" />
          <StatPlaque glyph="fuel" label="Yakıt" value="1.240" />
        </div>
      </div>
    </Decision>
  );
}

const SAMPLES = [6_422, 99_999, 240_100, 1_400_000, 12_400_000] as const;

function NumberDecision() {
  const [style, setStyle] = useState<NumberStyle>('game');
  const hud: readonly HudResource[] = [
    { id: 'alloy', art: RESOURCE_ART.alloy, amount: shortNumber(240_100, style), rate: `+${shortNumber(2_200, style)}`, store: 0.62, tone: 'alloy', label: 'Alaşım' },
    { id: 'crystal', art: RESOURCE_ART.crystal, amount: shortNumber(1_400_000, style), rate: '+640', store: 1, tone: 'crystal', label: 'Kristal' },
    { id: 'deut', art: RESOURCE_ART.deuterium, amount: shortNumber(6_422, style), rate: '+180', store: 0.3, tone: 'deut', label: 'Döteryum' },
  ];
  return (
    <Decision
      no="2.8"
      title="Sayı biçimi"
      question="Büyük sayılar nasıl kısalsın? Türkçede virgül kalır; soru harfte: B/Mn mi, K/M mi?"
      advice="K/M: 240,1K · 1,4M. “B” İngilizcede milyar okunur; Whiteout Türkçede de K/M yazıyor."
    >
      <GameTabs
        label="Sayı biçimi seçenekleri"
        value={style}
        onChange={(id) => { if (isNumberStyle(id)) setStyle(id); }}
        tabs={[{ id: 'today', label: 'Bugün · B/Mn' }, { id: 'game', label: 'K/M' }, { id: 'full', label: 'Tam' }]}
      />
      <div data-std-sample className="gk-std__sample grid gap-2">
        <ResourceHud items={hud} />
        <div className="gk-well grid grid-cols-2 gap-x-3 gap-y-0.5 px-2.5 py-2">
          {SAMPLES.map((value) => (
            <span key={value} className="contents">
              <span className="gk-sub gk-num">{whole.format(value)}</span>
              <span className="gk-display gk-num">{shortNumber(value, style)}</span>
            </span>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <StatPlaque glyph="up" label="Seviye" value="Sv. 4 → 5" sub="ok: adım adım" />
          <StatPlaque glyph="speed_up" label="Hız" value={<>21,5 <span className="gk-tone-good">+0,5</span></>} sub="fark: sürekli" />
        </div>
      </div>
    </Decision>
  );
}
