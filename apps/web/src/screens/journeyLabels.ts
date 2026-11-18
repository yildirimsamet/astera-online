import type { JourneyPlayer } from '../api/journeySchemas.js';

export const STAGE_LABELS: Record<JourneyPlayer['stage'], string> = {
  registered: 'Kayıt', enlisted: 'Gemiye katılım', refinery: 'İlk onarım', mining: 'İlk madencilik', probe: 'İlk sonda',
  yard: 'Tersane açıldı', window: 'Sıçrama penceresi açıldı', built: 'Gemi üretimi', battle: 'İlk savaş', victory: 'İlk zafer', departed: 'Ana galaksiye göç',
};
const LABELS: Record<string, string> = {
  MINE: 'Madencilik gönderdi', PROBE: 'Sonda gönderdi', RAID_SITE: 'Karakola saldırdı', ATTACK: 'Gemiye saldırdı',
  REFINERY: 'Rafineri onarımı', EXTRACTOR: 'Kristal çıkarıcı onarımı', SURVEY: 'Sonda rampası onarımı', SHIPYARD: 'Tersane onarımı',
  TELESCOPE: 'Teleskop onarımı', RADAR: 'Radar onarımı', AEGIS: 'Aegis onarımı', VAULT: 'Kasa onarımı',
  DART: 'Dart üretimi', PIKE: 'Pike üretimi', WARDEN: 'Warden üretimi', DOCK: 'Gemi onarımı',
  collect: 'Kaynak toplama', galaxy: 'Galaksi', planet: 'Gemi ekranı', intel: 'İstihbarat', starter_advisor: 'Sıradaki adımlar',
  online: 'Gemiyi uyandır', orderRefinery: 'İlk rafineri onarımı', waitFirst: 'İlk onarımı bekle',
  orderExtractor: 'Kristal çıkarıcıyı onar', orderTelescope: 'Teleskobu onar', waitTelescope: 'Teleskobu bekle',
  telescopeLook: 'Teleskopla bak', findRock: 'Asteroit bul', zoomRock: 'Asteroide yaklaş', mine: 'Madencilik gönder',
  orderRadar: 'Radarı onar', waitRadar: 'Radarı bekle', orderSurvey: 'Sonda rampasını onar', waitSurvey: 'Sonda rampasını bekle', probe: 'Sonda gönder',
  orderShipyard: 'Tersaneyi onar', waitYard: 'Tersaneyi bekle', buildShip: 'İlk gemini üret', farewell: 'İlk rehberin sonu',
  jumpAsk: 'Sıçrama sorusu', jumpGo: 'Sıçramaya hazırlan',
  openIntel: 'İstihbaratı aç', openReport: 'Sonda raporunu aç', report: 'Sonda raporunu oku', collectMine: 'Maden dönüşünü topla',
  firstCrate: 'İlk kasayı aç', openCrate: 'Kasayı aç', radarRing: 'Radar menzili (eski)', radarContact: 'Radar teması (eski)', sightTrio: 'Görüş türleri (eski)',
  REPAIR_DONE: 'Onarım sonucu görüldü', YARD_DONE: 'Üretim sonucu görüldü', FLEET_HOME: 'Filo dönüşü görüldü',
  PROBE_REPORT: 'Sonda raporu görüldü', BATTLE_REPORT: 'Savaş raporu görüldü', background: 'Arka plana geçti', skipped: 'Rehber kapatıldı',
  INSUFFICIENT_RESOURCES: 'Kaynak yetersiz', insufficient_resources: 'Kaynak yetersiz',
  react_render: 'Ekran çizim hatası', webgl_context_lost: '3D görüntü kesildi', unhandled_error: 'İstemci hatası', unhandled_rejection: 'Tamamlanamayan işlem',
};
export const journeyLabel = (code: string): string => LABELS[code] ?? code;
