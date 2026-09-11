/**
 * THE OWNER'S ECONOMY CATALOGUE, GENERATED FROM THE LIVE RULES CODE.
 *
 * Owner request: every building, ship, research project and instrument, every level,
 * with what it costs, how long it takes and what it gives. Infinite ladders are cut
 * at 25. Writes `docs/astera-ekonomi-katalog.xlsx`.
 *
 * IT READS `@astera/rules` DIRECTLY AND NEVER A DOCUMENT, which is the whole point:
 * the owner asked *"dökümanlardan değil koddan hesapladın yani?"*. Anything derived
 * — hull fuel, build minutes, storage hours — is called, never retyped, so the
 * spreadsheet cannot drift from the game the way a hand-kept table does.
 *
 * Re-run it after any economy change: `npx tsx tools/economy-catalog.ts`.
 */
import { writeXlsx, type Cell, type Sheet } from './xlsx.js';
import {
  alloyRate, crystalRate, deuteriumRate, buildingCost, buildMinutes, instrumentCost,
  satelliteCost, storageHours, protectedHours, flightSlots,
  groundSlots, satelliteSlots, constructionThroughput, yardThroughput, defenceThroughput,
  shipMinutes, defenceMinutes, researchMinutes, shieldHp,
} from '../packages/rules/src/economy.js';
import { HULLS } from '../packages/rules/src/hulls.js';
import { hullFuelMass } from '../packages/rules/src/fuel.js';
import { RESEARCH_PROJECTS } from '../packages/rules/src/research.js';
import { cargoMult, yardSpeedMult, robotSpeedMult, prospectorHoldMult, hullTech } from '../packages/rules/src/tech.js';
import {
  telescopeRange, telescopeWatchRange, telescopeSlots, telescopeCooldownHours,
  radarRange, radarContactRange, interceptionRange, clarity,
} from '../packages/rules/src/intel.js';
import { BUILDING_IDS, INSTRUMENT_IDS, SATELLITE_IDS, RESEARCH_PROJECT_IDS } from '../packages/rules/src/types.js';
import { SATELLITES, DEATH_STAR, ANTI_STRATEGIC } from '../packages/rules/src/constants.js';
import { ECONOMY_PROFILE } from '../packages/rules/src/economy-profile.js';

const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;
const MAX = 25;

/* ---------------- BİNALAR ---------------- */
const BUILDING_TR: Record<string, string> = {
  CORE: 'Çekirdek (Core)', REFINERY: 'Rafineri (Alloy)', EXTRACTOR: 'Çıkarıcı (Crystal)',
  VAULT: 'Depo (Vault)', SHIPYARD: 'Tersane (Shipyard)',
  DEUTERIUM_PLANT: 'Deuterium Tesisi',
};
const buildingEffect = (id: string, lvl: number): [string, Cell] => {
  switch (id) {
    case 'CORE': return ['orbit yuva / uçuş yuvası / yer yuvası / inşa hızı',
      `${String(satelliteSlots(lvl))} / ${String(flightSlots(lvl))} / ${String(groundSlots(lvl))} / ${String(r1(constructionThroughput(lvl)))} kaynak-dk`];
    case 'REFINERY': return ['alloy üretimi (saat)', Math.round(alloyRate(lvl))];
    case 'EXTRACTOR': return ['crystal üretimi (saat)', Math.round(crystalRate(lvl))];
    case 'VAULT': return ['depo saati / korunan saat',
      `${String(r1(storageHours(lvl)))} sa / ${String(r1(protectedHours(lvl)))} sa`];
    case 'SHIPYARD': return ['gemi hızı / savunma hızı',
      `${String(r1(yardThroughput(lvl)))} / ${String(r1(defenceThroughput(lvl)))} kaynak-dk`];
    case 'DEUTERIUM_PLANT': return ['deuterium üretimi (saat)', r1(deuteriumRate(lvl))];
    default: return ['', ''];
  }
};
const buildings: Cell[][] = [[
  'Bina', 'ID', 'Seviye', 'Alloy', 'Crystal', 'Deuterium', 'Toplam kaynak',
  'İnşa süresi (dk)', 'İnşa süresi', 'Etki', 'Etki değeri', 'Toplam yatırım (kümülatif)',
]];
for (const id of BUILDING_IDS) {
  let cum = 0;
  for (let lvl = 1; lvl <= MAX; lvl++) {
    const cost = buildingCost(id, lvl - 1);
    const total = cost.alloy + cost.crystal + cost.deuterium;
    cum += total;
    // Core kendi seviyesinde varsayılır; inşa hızı Core'a bağlıdır.
    const core = id === 'CORE' ? lvl - 1 : lvl;
    const mins = buildMinutes(cost, Math.max(1, core), {});
    const [label, value] = buildingEffect(id, lvl);
    buildings.push([BUILDING_TR[id] ?? id, id, lvl, cost.alloy, cost.crystal, cost.deuterium,
      total, Math.round(mins), fmtDuration(mins), label, value, cum]);
  }
}

function fmtDuration(mins: number): string {
  const m = Math.round(mins);
  if (m < 60) return `${String(m)} dk`;
  const h = Math.floor(m / 60), rem = m % 60;
  if (h < 24) return rem === 0 ? `${String(h)} sa` : `${String(h)} sa ${String(rem)} dk`;
  const d = Math.floor(h / 24);
  return `${String(d)} gün ${String(h % 24)} sa`;
}

/* ---------------- ALETLER ---------------- */
const INSTRUMENT_TR: Record<string, string> = {
  TELESCOPE: 'Teleskop (tanımlar)', RADAR: 'Radar (tespit eder)',
  AEGIS: 'Aegis (kalkan)', VEIL: 'Veil (gizler)',
};
const instrumentEffect = (id: string, lvl: number): [string, Cell] => {
  switch (id) {
    case 'TELESCOPE': return ['menzil / izleme menzili / yuva / bekleme',
      `${String(telescopeRange(lvl))} br / ${String(telescopeWatchRange(lvl))} br / ${String(telescopeSlots(lvl))} yuva / ${String(telescopeCooldownHours(lvl))} sa`];
    case 'RADAR': return ['tespit menzili / temas menzili / önleme menzili',
      `${String(radarRange(lvl))} br / ${String(radarContactRange(lvl))} br / ${String(interceptionRange(lvl))} br`];
    case 'AEGIS': return ['kalkan HP', shieldHp(lvl)];
    case 'VEIL': return ['Teleskop 5 karşısında netlik', r2(clarity(5, lvl))];
    default: return ['', ''];
  }
};
const instruments: Cell[][] = [['Alet', 'ID', 'Seviye', 'Alloy', 'Crystal', 'Toplam', 'Etki', 'Etki değeri']];
for (const id of INSTRUMENT_IDS) {
  for (let lvl = 1; lvl <= 5; lvl++) {
    const cost = instrumentCost(id, lvl - 1);
    const [label, value] = instrumentEffect(id, lvl);
    instruments.push([INSTRUMENT_TR[id] ?? id, id, lvl, cost.alloy, cost.crystal,
      cost.alloy + cost.crystal, label, value]);
  }
}

/* ---------------- UYDULAR ---------------- */
const SAT_TR: Record<string, [string, string]> = {
  UPLINK: ['Uplink', 'Teleskop/Radar kapısı — orbit yuvası kullanır'],
  FOUNDRY: ['Foundry', 'Dünya üretimini çarpar'],
  DERRICK: ['Derrick', 'Madenci ambarı ve hızı'],
  BEACON: ['Beacon', 'Buradan kalkan her filo daha hızlı'],
};
const satellites: Cell[][] = [['Uydu', 'ID', 'Alloy', 'Crystal', 'Toplam', 'Etki', 'Değer']];
for (const id of SATELLITE_IDS) {
  const cost = satelliteCost(id);
  const s = SATELLITES[id] as Record<string, number | undefined>;
  const value = [s.production ? `üretim x${String(s.production)}` : '', s.hold ? `ambar x${String(s.hold)}` : '',
    s.speed ? `hız x${String(s.speed)}` : ''].filter(Boolean).join(', ') || 'kapı (etki yok)';
  satellites.push([SAT_TR[id]?.[0] ?? id, id, cost.alloy, cost.crystal, cost.alloy + cost.crystal,
    SAT_TR[id]?.[1] ?? '', value]);
}

const RESEARCH_TR: Record<string, string> = {
  ISOTOPE_SPECTROMETRY: 'İzotop Spektrometrisi', DENSE_FUEL_CELLS: 'Yoğun Yakıt Hücreleri',
  GRAVITIC_CHARGES: 'Gravitik Yükler', DEATH_STAR_PROTOCOL: 'Ölüm Yıldızı Protokolü',
  DEUTERIUM_SYNTHESIS: 'Deuterium Sentezi', YARD_AUTOMATION: 'Tersane Otomasyonu',
  AI_ROBOTS: 'Yapay Zekâ Robotları',
  PROSPECTOR_HOLDS: 'Madenci Ambarları', CARGO_HOLDS: 'Kargo Ambarları',
  STARSHIP_ENGINEERING: 'Yıldız Gemisi Mühendisliği', SHIP_POWER: 'Gemi Gücü (ATK)',
  SHIP_ARMOR: 'Gemi Zırhı (HP)', SHIP_PROPULSION: 'Gemi İtkisi (hız)',
  EMPLACEMENT_DOCTRINE: 'Mevzi Doktrini (yer savunması)', INTERCEPTION_GRID: 'Önleme Ağı',
  STRATEGIC_STOCKPILE: 'Stratejik Stok',
};

/* ---------------- GEMİLER ---------------- */
const ships: Cell[][] = [[
  'Gemi', 'ID', 'Kademe', 'Sınıf', 'Rol', 'Alloy', 'Crystal', 'Deuterium', 'Toplam',
  'Yapım (dk) Tersane 1', 'Yapım (dk) Tersane 5', 'ATK', 'HP', 'Hız', 'Kargo', 'Bulk (yer savunması odası)',
  'Yakıt kütlesi', '1250 br gidiş-dönüş (dk)', 'Min Tersane', 'Gerekli araştırma',
]];
for (const id of (Object.keys(HULLS) as (keyof typeof HULLS)[])) {
  const h = HULLS[id] as Record<string, never> & typeof HULLS[keyof typeof HULLS];
  const cost = { alloy: h.alloy, crystal: h.crystal, deuterium: h.deuterium };
  const total = cost.alloy + cost.crystal + cost.deuterium;
  const ground = h.ground;
  const m1 = ground ? defenceMinutes(cost, 1) : shipMinutes(cost, Math.max(1, h.minShipyard), {});
  const m5 = ground ? defenceMinutes(cost, 5) : shipMinutes(cost, 5, {});
  const round = h.speed > 0 ? r1(2 * 1250 / h.speed) : '';
  ships.push([h.name, id, h.tier ?? (ground ? 'yer' : '-'), h.cls, ground ? 'yer savunması' : h.profile,
    cost.alloy, cost.crystal, cost.deuterium, total, Math.round(m1), Math.round(m5),
    h.atk, h.hp, h.speed, h.cargo, (h as unknown as { bulk?: number }).bulk ?? '',
    ground ? '' : r1(hullFuelMass(id)), round, h.minShipyard,
    /*
      A REQUIREMENT IS AN OBJECT, NOT A STRING. `join` on `{ project, level }[]`
      printed "[object Object]" in every ship row that has a prerequisite — which is
      every hull from tier 3 up — so the column that tells a reader WHY they cannot
      build a Cataclysm said nothing at all. Caught by lint, not by reading.
    */
    h.requiredResearch.map((r) => `${RESEARCH_TR[r.project] ?? r.project} ${String(r.level)}`)
      .join(', ') || '-']);
}

/* ---------------- ARAŞTIRMA ---------------- */
const researchEffect = (id: string, lvl: number): [string, Cell] => {
  const t = { [id]: lvl };
  switch (id) {
    case 'YARD_AUTOMATION': return ['tersane hızı', `x${String(r2(yardSpeedMult(t)))}`];
    case 'AI_ROBOTS': return ['inşaat hızı', `x${String(r2(robotSpeedMult(t)))}`];
    case 'PROSPECTOR_HOLDS': return ['madenci ambarı', `x${String(r2(prospectorHoldMult(t)))}`];
    case 'CARGO_HOLDS': return ['kargo kapasitesi', `x${String(r2(cargoMult(t)))}`];
    case 'SHIP_POWER': return ['filo ATK', `x${String(r2(hullTech(t, 'DART').atk))}`];
    case 'SHIP_ARMOR': return ['filo HP', `x${String(r2(hullTech(t, 'DART').hp))}`];
    case 'SHIP_PROPULSION': return ['filo hızı', `x${String(r2(hullTech(t, 'DART').speed))}`];
    case 'EMPLACEMENT_DOCTRINE': return ['yer savunması ATK+HP', `x${String(r2(hullTech(t, 'THORN').atk))}`];
    case 'DEUTERIUM_SYNTHESIS': return ['Deuterium Tesisi seviye tavanı', lvl * 2];
    case 'STARSHIP_ENGINEERING': return ['gövde izni (kademe açar)', `kademe ${String(lvl + 1)}`];
    case 'ISOTOPE_SPECTROMETRY': return ['izin: izotop madenciliği', 'açar'];
    case 'DENSE_FUEL_CELLS': return ['izin: yoğun yakıt', 'açar'];
    case 'GRAVITIC_CHARGES': return ['izin: gravitik yük', 'açar'];
    case 'DEATH_STAR_PROTOCOL': return ['izin: stratejik silah', 'açar'];
    case 'INTERCEPTION_GRID': return ['izin: önleme bataryası', 'açar'];
    case 'STRATEGIC_STOCKPILE': return ['pad üzerindeki silah sayısı', lvl > 0 ? 2 : 1];
    default: return ['', ''];
  }
};
const research: Cell[][] = [[
  'Araştırma', 'ID', 'Seviye', 'Max seviye', 'Alloy', 'Crystal', 'Deuterium', 'Toplam',
  'Süre (dk) Core 10', 'Süre', 'Etki', 'Etki değeri', 'Ön koşul', 'Gerekli Core',
]];
for (const id of RESEARCH_PROJECT_IDS) {
  const p = RESEARCH_PROJECTS[id];
  for (let lvl = 1; lvl <= p.maxLevel; lvl++) {
    const cost = p.costAt(lvl);
    const total = cost.alloy + cost.crystal + cost.deuterium;
    const mins = researchMinutes(cost, 10);
    const [label, value] = researchEffect(id, lvl);
    research.push([RESEARCH_TR[id] ?? id, id, lvl, p.maxLevel, cost.alloy, cost.crystal,
      cost.deuterium, total, Math.round(mins), fmtDuration(mins), label, value,
      p.prerequisite ?? '-', p.requiredCore ?? '-']);
  }
}

/* ---------------- STRATEJİK ---------------- */
const strategic: Cell[][] = [['Varlık', 'Alloy', 'Crystal', 'Deuterium', 'Toplam', 'Yapım (dk)', 'Gerekli Core', 'Gerekli Tersane', 'Gerekli araştırma', 'Not']];
strategic.push(['Ölüm Yıldızı (Death Star)', DEATH_STAR.cost.alloy, DEATH_STAR.cost.crystal,
  DEATH_STAR.cost.deuterium, DEATH_STAR.cost.alloy + DEATH_STAR.cost.crystal + DEATH_STAR.cost.deuterium,
  DEATH_STAR.buildMinutes, DEATH_STAR.requiredCore, DEATH_STAR.requiredShipyard,
  DEATH_STAR.requiredResearch, 'Tek kullanımlık; 2 saat kesinti, dünya el değiştirmez']);
strategic.push(['Önleme Bataryası (Anti-Strategic)', ANTI_STRATEGIC.cost.alloy, ANTI_STRATEGIC.cost.crystal,
  ANTI_STRATEGIC.cost.deuterium, ANTI_STRATEGIC.cost.alloy + ANTI_STRATEGIC.cost.crystal + ANTI_STRATEGIC.cost.deuterium,
  ANTI_STRATEGIC.buildMinutes, '-', '-', ANTI_STRATEGIC.requiredResearch,
  `Radar ${String(ANTI_STRATEGIC.requiredRadar)}+ gerekir; pad'de ${String(ANTI_STRATEGIC.maxCharges)} şarj`]);

/* ---------------- OKUMA NOTU ---------------- */
const notes: Cell[][] = [
  ['Astera Online — ekonomi kataloğu'],
  [`Ekonomi profili: ${ECONOMY_PROFILE.id} · sezon ${String(ECONOMY_PROFILE.seasonDays)} gün · ilerleme ufku ${String(ECONOMY_PROFILE.progressionDays)} gün`],
  [`Üretildiği an: ${new Date().toISOString()} · kaynak: packages/rules çalışma ağacı (commit edilmemiş değişiklikler dahil)`],
  [],
  ['Sayfa', 'İçerik', 'Dikkat'],
  ['Binalar', `7 bina x ${String(MAX)} seviye: maliyet, süre, etki, kümülatif yatırım`,
    'İnşa süresi Core seviyesine bağlıdır; tablo Core=bina seviyesi varsayar (Core satırlarında Core=kendi seviyesi-1)'],
  ['Aletler', 'Teleskop/Radar/Aegis/Veil, 1-5', 'Fiyat artık alete göre DEĞİŞMİYOR: dördü de aynı merdiveni ödüyor'],
  ['Uydular', 'Uplink/Foundry/Derrick/Beacon — tek seferlik', 'Uplink orbit yuvası harcar, kendisi etki vermez'],
  ['Gemiler', 'Tüm gövdeler + yer savunması', 'Yapım süresi tersane seviyesine bağlı; iki sütun veriyorum'],
  ['Araştırma', 'Tüm projeler, tüm seviyeler', 'Süre Core 10 varsayımıyla; araştırma iptal edilemez'],
  ['Stratejik', 'Ölüm Yıldızı ve Önleme Bataryası', 'Bu iki fiyat elle yazılmıştır, ekonomiyle ölçeklenmez'],
];

const sheets: Sheet[] = [
  { name: 'Okuma Notu', rows: notes },
  { name: 'Binalar', rows: buildings },
  { name: 'Gemiler', rows: ships },
  { name: 'Araştırma', rows: research },
  { name: 'Aletler', rows: instruments },
  { name: 'Uydular', rows: satellites },
  { name: 'Stratejik', rows: strategic },
];
const out = '/home/yildirim/Desktop/Coding/MyProjects/blindspace/docs/astera-ekonomi-katalog.xlsx';
writeXlsx(out, sheets);
console.log('yazıldı:', out);
for (const s of sheets) console.log(`  ${s.name.padEnd(14)} ${String(s.rows.length - 1)} satır`);
