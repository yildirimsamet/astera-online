#!/usr/bin/env -S pnpm exec tsx
/** Generates a Turkish, Excel-openable snapshot from the authoritative rule package. */
import { mkdirSync, writeFileSync } from 'node:fs';
import {
  ANTI_STRATEGIC, BUILDING_IDS, DEATH_STAR, HULLS, INSTRUMENT_IDS,
  INSTRUMENT_MAX_LEVEL, PROBE, RESEARCH_PROJECT_IDS, RESEARCH_PROJECTS,
  SATELLITE_IDS, alloyRate, buildingCost, buildMinutes, crystalRate,
  defenceMinutes, deuteriumRate, flightSlots, groundSlots, hangarCapacity,
  hullBulk, instrumentCost, plantCeiling, radarRange, researchEffectAt,
  researchMinutes, satelliteCost, satelliteSlots, sensorReach, shieldHp,
  shipMinutes, storageHours, telescopeCooldownHours, telescopeSlots,
  upgradeCost, yardThroughput,
} from '../packages/rules/src/index.js';
import type { BuildingId, InstrumentId, ResearchProjectId, Resources } from '../packages/rules/src/index.js';

type Cell = string | number;
type Sheet = { name: string; rows: Cell[][] };
const trBuilding: Record<BuildingId, string> = {
  CORE: 'Komuta Çekirdeği', REFINERY: 'Alaşım Rafinerisi', EXTRACTOR: 'Kristal Ocağı',
  VAULT: 'Kasa', SHIPYARD: 'Tersane', HANGAR: 'Hangar', DEUTERIUM_PLANT: 'Döteryum Rafinerisi',
};
const trInstrument: Record<InstrumentId, string> = {
  TELESCOPE: 'Teleskop', RADAR: 'Radar', AEGIS: 'Aegis', VEIL: 'Perde',
};
const trResearch: Record<ResearchProjectId, string> = {
  ISOTOPE_SPECTROMETRY: 'İzotop Spektrometrisi', DENSE_FUEL_CELLS: 'Yoğun Yakıt Hücreleri',
  GRAVITIC_CHARGES: 'Gravitik Yükler', DEATH_STAR_PROTOCOL: 'Ölüm Yıldızı Protokolü',
  DEUTERIUM_SYNTHESIS: 'Döteryum Sentezi', YARD_AUTOMATION: 'Tersane Otomasyonu',
  PROSPECTOR_HOLDS: 'Kazıcı Ambarları', CARGO_HOLDS: 'Gemi Ambarları',
  STARSHIP_ENGINEERING: 'Yıldız Gemisi Mühendisliği', SHIP_POWER: 'Gemi Gücü',
  SHIP_ARMOR: 'Gemi Zırhı', SHIP_PROPULSION: 'Gemi İtkisi',
  EMPLACEMENT_DOCTRINE: 'Tabya/Kirpi Doktrini', STRATEGIC_STOCKPILE: 'Stratejik Stok',
  INTERCEPTION_GRID: 'Önleme Ağı',
};
const trHull: Record<string, string> = {
  DART: 'Ok', PIKE: 'Kargı', RAMPART: 'Sur', WARDEN: 'Muhafız', COURIER: 'Kurye',
  VIPER: 'Engerek', TALON: 'Pençe', STRONGHOLD: 'Hisar', SENTINEL: 'Nöbetçi',
  WAYFARER: 'Seyyah', TEMPEST: 'Fırtına', BALLISTA: 'Balista', LEVIATHAN: 'Leviathan',
  PRAETORIAN: 'Pretoryen', ATLAS: 'Atlas', NULLIFIER: 'Söndürücü', CATACLYSM: 'Felaket',
  CITADEL: 'Hisar', BASTION: 'Tabya', THORN: 'Kirpi', PROSPECTOR: 'Kazıcı',
};
const f = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 });
const res = (c: Resources): Cell[] => [c.alloy, c.crystal, c.deuterium];
const effect = (id: BuildingId, level: number): string => {
  switch (id) {
    case 'CORE': return `Bina tavanı ${level}; yörünge ${satelliteSlots(level)}; uçuş rampası ${flightSlots(level)}; yer savunması ${groundSlots(level)}`;
    case 'REFINERY': return `${f.format(alloyRate(level))} Alaşım/saat`;
    case 'EXTRACTOR': return `${f.format(crystalRate(level))} Kristal/saat`;
    case 'VAULT': return `${f.format(storageHours(level))} saatlik depo kapasitesi`;
    case 'SHIPYARD': return `Gemi üretim hızı ${f.format(yardThroughput(level))} kaynak/dk; sonda doğruluğu/gizliliği artar`;
    case 'HANGAR': return `${hangarCapacity(level)} Hangar alanı`;
    case 'DEUTERIUM_PLANT': return `${f.format(deuteriumRate(level))} Döteryum/saat (Sentez tavanı ayrıca gerekir)`;
  }
};
const researchEffect = (id: ResearchProjectId, level: number): string => {
  const value = researchEffectAt(id, level);
  if (['SHIP_POWER', 'SHIP_ARMOR', 'EMPLACEMENT_DOCTRINE'].includes(id)) return `Temel ilgili istatistik çarpanı ×${f.format(value)}`;
  if (id === 'SHIP_PROPULSION') return `18 hareketli gövdenin hız çarpanı ×${f.format(value)}`;
  if (id === 'YARD_AUTOMATION') return `Hareketli gemi süresi çarpanı ×${f.format(value)} (daha düşük daha hızlı)`;
  if (id === 'PROSPECTOR_HOLDS') return `Kazıcı ambar çarpanı ×${f.format(value)}`;
  if (id === 'CARGO_HOLDS') return `Akın ganimet ambar çarpanı ×${f.format(value)}`;
  if (id === 'DEUTERIUM_SYNTHESIS') return `Döteryum Rafinerisi tavanı ${value}`;
  if (id === 'STARSHIP_ENGINEERING') return `En yüksek izinli gemi kademesi ${value + 2}`;
  if (id === 'STRATEGIC_STOCKPILE') return `Dünya başına hazır Ölüm Yıldızı kapasitesi ${value}`;
  return value ? 'İzin/özellik açıldı' : 'Henüz açılmadı';
};
const instrumentEffect = (id: InstrumentId, level: number): string => {
  if (id === 'TELESCOPE') return `Tanımlama menzili ${sensorReach(level)}; izleme yuvası ${telescopeSlots(level)}; yenileme ${telescopeCooldownHours(level)} sa.`;
  if (id === 'RADAR') return `Algılama menzili ${radarRange(level)}${level >= 2 ? '; yön' : ''}${level >= 3 ? '; Önleme Ağını etkinleştirir' : ''}${level >= 4 ? '; yaklaşık güç' : ''}${level >= 5 ? '; çıkış + filo dökümü' : ''}`;
  if (id === 'AEGIS') return `Kalkan dayanımı ${f.format(shieldHp(level))}; saatte %35 yenilenir`;
  return `Rakip Teleskop netliği −${level}; eşit Tersane sondası doğruluğu düşer`;
};
const xml = (text: Cell): string => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const rowXml = (row: Cell[], heading = false): string => `<Row>${row.map((v) => `<Cell ss:StyleID="${heading ? 'head' : typeof v === 'number' ? 'num' : 'text'}"><Data ss:Type="${typeof v === 'number' ? 'Number' : 'String'}">${xml(v)}</Data></Cell>`).join('')}</Row>`;
const sheetXml = (sheet: Sheet): string => `<Worksheet ss:Name="${xml(sheet.name)}"><Table>${sheet.rows.map((r, i) => rowXml(r, i === 0)).join('')}</Table><WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><FreezePanes/><FrozenNoSplit/><SplitHorizontal>1</SplitHorizontal><TopRowBottomPane>1</TopRowBottomPane><ProtectObjects>False</ProtectObjects><ProtectScenarios>False</ProtectScenarios></WorksheetOptions></Worksheet>`;

export function buildEconomyReportXml(): string {
  const buildings: Cell[][] = [['Kod', 'Bina', 'Hedef seviye', 'Geçiş', 'Alaşım', 'Kristal', 'Döteryum', 'Referans süre (dk)', 'Bu seviyede sağlanan', 'Koşul/not']];
  for (const id of BUILDING_IDS) for (let target = 1; target <= 20; target++) {
    const from = target - 1; const cost = buildingCost(id, from);
    const core = id === 'CORE' ? Math.max(1, from) : target;
    buildings.push([id, trBuilding[id], target, `${from} → ${target}`, ...res(cost), Number(buildMinutes(cost, core).toFixed(2)), effect(id, target), id === 'DEUTERIUM_PLANT' ? `Komuta Çekirdeği ≥ ${target}; Döteryum Sentezi tavanı ≥ ${target} (Sentez ${Math.ceil(target / 3)})` : id === 'CORE' ? 'Diğer tüm binaların seviyesi Çekirdeği geçemez' : `Komuta Çekirdeği ≥ ${target}`]);
  }
  const instruments: Cell[][] = [['Kod', 'Cihaz', 'Hedef seviye', 'Geçiş', 'Alaşım', 'Kristal', 'Döteryum', 'Referans süre (dk)', 'Bu seviyede sağlanan', 'Koşul/not']];
  for (const id of INSTRUMENT_IDS) {
    const max = INSTRUMENT_MAX_LEVEL[id] ?? 20;
    for (let target = 1; target <= max; target++) {
      const cost = instrumentCost(id, target - 1);
      instruments.push([id, trInstrument[id], target, `${target - 1} → ${target}`, ...res(cost), Number(buildMinutes(cost, 1).toFixed(2)), instrumentEffect(id, target), ['TELESCOPE', 'RADAR'].includes(id) ? 'Yörüngede Anten (Uplink) gerekir' : 'Komuta Çekirdeği bina tavanı yok; 20’de raporlama sınırı']);
    }
  }
  const research: Cell[][] = [['Kod', 'Araştırma', 'Hedef seviye', 'Geçiş', 'Alaşım', 'Kristal', 'Döteryum', 'Referans süre (dk)', 'Bu seviyede sağlanan', 'Koşul/not']];
  for (const id of RESEARCH_PROJECT_IDS) {
    const p = RESEARCH_PROJECTS[id];
    for (let target = 1; target <= p.maxLevel; target++) {
      const cost = p.costAt(target);
      research.push([id, trResearch[id], target, `${target - 1} → ${target}`, ...res(cost), Number(researchMinutes(cost, p.requiredCore ?? 1).toFixed(2)), researchEffect(id, target), `${p.prerequisite ? `Önkoşul: ${trResearch[p.prerequisite]}; ` : ''}${p.requiredCore ? `Komuta Çekirdeği ≥ ${p.requiredCore}; ` : ''}${p.availableAtMinutes ? `Sezonun ${p.availableAtMinutes}. dakikasından sonra` : 'İlk dakikadan açık'}`]);
    }
  }
  const units: Cell[][] = [['Kod', 'Üretilen varlık', 'Tür', 'Kademe', 'Alaşım', 'Kristal', 'Döteryum', 'Referans süre (dk)', 'Savaş/değerler', 'Üretim koşulu']];
  for (const [id, h] of Object.entries(HULLS)) {
    const cost = { alloy: h.alloy, crystal: h.crystal, deuterium: h.deuterium };
    units.push([id, trHull[id] ?? h.name, h.ground ? 'Yer savunması' : id === 'PROSPECTOR' ? 'Madenci' : 'Gemi', h.tier ?? 'Özel', ...res(cost), Number((h.ground ? defenceMinutes(cost, h.minShipyard) : shipMinutes(cost, h.minShipyard, {})).toFixed(2)), `Saldırı ${h.atk}; dayanım ${h.hp}; hız ${h.speed}; ambar ${h.cargo}; Hangar alanı ${h.ground ? 0 : hullBulk(id)}`, `Tersane ≥ ${h.minShipyard}${h.requiredResearch.length ? `; ${h.requiredResearch.map((x) => `${trResearch[x.project]} ${x.level}`).join(', ')}` : ''}`]);
  }
  units.push(['PROBE', 'Sonda', 'Tüketilen keşif aracı', '—', PROBE.alloy, PROBE.crystal, 0, 'Üretim yok', `Hız ${PROBE.speed}; tek keşif uçuşunda harcanır`, 'Tersane gerektirmez; genel uçuş rampası kullanır']);
  units.push(['DEATH_STAR', 'Ölüm Yıldızı', 'Stratejik silah', '—', ...res(DEATH_STAR.cost), DEATH_STAR.buildMinutes, `Hız ${DEATH_STAR.speed}; atışta tüketilir`, `Komuta Çekirdeği ≥ ${DEATH_STAR.requiredCore}; Tersane ≥ ${DEATH_STAR.requiredShipyard}; ${trResearch.DEATH_STAR_PROTOCOL}`]);
  units.push(['INTERCEPTOR', 'Önleyici mühimmat', 'Stratejik savunma', '—', ...res(ANTI_STRATEGIC.cost), ANTI_STRATEGIC.buildMinutes, 'İlk görünür Ölüm Yıldızını imha eder; kullanımdan sonra tükenir', `Radar ≥ ${ANTI_STRATEGIC.requiredRadar}; ${trResearch.INTERCEPTION_GRID}; dünya başına en çok ${ANTI_STRATEGIC.maxCharges}`]);
  const satellites: Cell[][] = [['Kod', 'Yörünge varlığı', 'Seviye', 'Alaşım', 'Kristal', 'Döteryum', 'Referans süre (dk)', 'Sağladığı', 'Koşul/not']];
  for (const id of SATELLITE_IDS) {
    const c = satelliteCost(id); const d = id === 'FOUNDRY' ? 'Bu dünyanın üç üretimini %6 artırır' : id === 'UPLINK' ? 'Teleskop ve Radarı açar' : id === 'DERRICK' ? 'Kazıcı ambarı ×2,6; hızı ×1,5' : 'Bu dünyadan kalkan filoların hızı ×1,3';
    satellites.push([id, ({ FOUNDRY: 'Körük', UPLINK: 'Anten', DERRICK: 'Matkap', BEACON: 'Kılavuz' } as Record<string, string>)[id], 1, ...res(c), Number(buildMinutes(c, 1).toFixed(2)), d, 'Yörünge yuvası gerekir: Çekirdek 1/3/5/9’da sırasıyla 1/2/3/4 yuva']);
  }
  const readme: Cell[][] = [
    ['Astera Online — Ekonomi ve Üretim Raporu', ''],
    ['Kapsam', 'Binalar 1–20; sonsuz Aegis ve Perde 1–20; sınırlı cihaz/araştırmalar gerçek maksimumunda; tüm gemiler, savunmalar, uydular ve stratejik varlıklar.'],
    ['Geçiş anlamı', 'Örn. “1 → 2”, seviye 1’den 2’ye geçişin maliyetini, süresini ve 2. seviyede elde edilen sonucu gösterir.'],
    ['Süre varsayımı', 'Bina satırında ilgili hedef seviyeyi yasal kılan en düşük Çekirdek seviyesi; gemi/savunmada minimum Tersane; araştırmada Core 1 veya belirtilen Core koşulu kullanıldı. Gerçek süre daha yüksek Çekirdek/Tersane ve Tersane Otomasyonu ile daha kısadır.'],
    ['Kuyruklar', 'İnşaat ve Tersane dünya başına ayrı, Araştırma komutan geneli ayrı çalışır; her birinin sıra derinliği 3’tür.'],
    ['Süre formülü', 'Bina: toplam maliyet / (40 × (1 + 0,20 × Çekirdek)); gemi: toplam maliyet / (260 × (1 + 0,35 × Tersane)) × Otomasyon; savunma daha hızlı ayrı hat. Tüm normal süreler 480 dk tavanlıdır.'],
    ['Veri kaynağı', 'packages/rules/src — rapor oluşturulduğunda kurallardan hesaplanan anlık görüntü.'],
  ];
  return `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Top" ss:WrapText="1"/></Style><Style ss:ID="head"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#1D4ED8" ss:Pattern="Solid"/><Alignment ss:Vertical="Top" ss:WrapText="1"/></Style><Style ss:ID="num"><NumberFormat ss:Format="# ##0.00"/></Style><Style ss:ID="text"><Alignment ss:Vertical="Top" ss:WrapText="1"/></Style></Styles>${[ { name: 'Kılavuz', rows: readme }, { name: 'Binalar', rows: buildings }, { name: 'Cihazlar', rows: instruments }, { name: 'Araştırmalar', rows: research }, { name: 'Gemiler ve Savunma', rows: units }, { name: 'Uydular', rows: satellites } ].map(sheetXml).join('')}</Workbook>`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  mkdirSync('reports', { recursive: true });
  writeFileSync('reports/astera_ekonomi_ve_uretim_raporu.xml', buildEconomyReportXml());
}
