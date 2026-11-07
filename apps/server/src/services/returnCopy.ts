import { returnModuleNames } from './returnModuleNames.js';
import type { PushMessage } from './notificationCenter.js';
export type ReturnNotice = 'repair_done' | 'miner_home' | 'repair_funded' | 'while_away';
type Copy = Record<ReturnNotice, [string, string]>;
const copy: Record<'en' | 'tr' | 'de' | 'fr' | 'es' | 'ja', Copy> = {
  en: { repair_done: ['Repairs complete', '{count} long repairs are complete aboard your ship.'], miner_home: ['Prospector home', 'Your Prospector has returned. Collect its haul from the works.'], repair_funded: ['Your next repair is funded', 'The store and works can now pay for your next repair. Collect and choose your next move.'], while_away: ['While you were away', '{count} events reached your log while you were away. See the repairs, visits and returns.'] },
  tr: { repair_done: ['Onarımlar bitti', 'Gemindeki {count} uzun onarım tamamlandı.'], miner_home: ['Kazıcı döndü', 'Kazıcın döndü. Ganimetini havuzdan topla.'], repair_funded: ['Sıradaki onarımın parası hazır', 'Depo ve havuzdaki kaynaklarla sıradaki onarımı ödeyebilirsin. Topla ve sıradaki hamleni seç.'], while_away: ['Yokken olanlar', 'Sen yokken seyir defterine {count} olay kaydedildi. Onarımlara, ziyaretlere ve dönüşlere bak.'] },
  de: { repair_done: ['Reparaturen abgeschlossen', '{count} lange Reparaturen an deinem Schiff sind fertig.'], miner_home: ['Prospektor zurück', 'Dein Prospektor ist zurück. Sammle seine Ladung aus dem Produktionslager.'], repair_funded: ['Die nächste Reparatur ist bezahlbar', 'Lager und Produktionslager reichen für die nächste Reparatur. Sammle die Ressourcen und wähle deinen nächsten Schritt.'], while_away: ['Während deiner Abwesenheit', '{count} Ereignisse wurden in deinem Logbuch vermerkt. Sieh dir Reparaturen, Besuche und Rückkehrer an.'] },
  fr: { repair_done: ['Réparations terminées', '{count} longues réparations sont terminées sur ton vaisseau.'], miner_home: ['Prospecteur rentré', 'Ton Prospecteur est rentré. Récupère sa cargaison dans le Stock de production.'], repair_funded: ['La prochaine réparation est abordable', 'Le stock et le Stock de production suffisent pour la prochaine réparation. Récupère les ressources et choisis la suite.'], while_away: ['Pendant ton absence', '{count} événements ont été inscrits au journal. Consulte les réparations, visites et retours.'] },
  es: { repair_done: ['Reparaciones terminadas', '{count} reparaciones largas han terminado en tu nave.'], miner_home: ['Prospector de vuelta', 'Tu Prospector ha vuelto. Recoge su carga del Depósito de producción.'], repair_funded: ['Puedes pagar la próxima reparación', 'El almacén y el Depósito de producción bastan para la siguiente reparación. Recoge los recursos y elige tu próximo paso.'], while_away: ['Mientras estabas fuera', '{count} eventos llegaron a tu registro. Consulta las reparaciones, visitas y regresos.'] },
  ja: { repair_done: ['修理完了', '船の長時間修理が{count}件完了しました。'], miner_home: ['プロスペクター帰還', 'プロスペクターが帰還しました。生産施設から採掘資源を回収しましょう。'], repair_funded: ['次の修理費がそろいました', '倉庫と生産施設の資源で次の修理を行えます。回収して次の行動を選びましょう。'], while_away: ['不在中の出来事', '不在中に{count}件の出来事が航海日誌に記録されました。修理、訪問、帰還を確認しましょう。'] },
};
export interface ReturnEvent { kind: 'battle' | 'probe' | 'departure' | 'repair' | 'fleet' | 'other'; name?: string }
interface Detail { module?: string; events?: readonly ReturnEvent[] }
const single: Record<keyof typeof copy, string> = {
  en: '{name} repair complete.', tr: '{name} onarımı bitti.', de: 'Reparatur abgeschlossen: {name}.',
  fr: 'Réparation terminée : {name}.', es: 'Reparación terminada: {name}.', ja: '{name}の修理が完了しました。',
};
const generic: Record<keyof typeof copy, string> = { en: 'Ship', tr: 'Gemi', de: 'Schiff', fr: 'Vaisseau', es: 'Nave', ja: '船' };
const news: Record<keyof typeof copy, Record<ReturnEvent['kind'] | 'more', string>> = {
  en: { battle: 'A battle report arrived.', probe: 'A probe scanned your ship.', departure: '{name} made the jump.', repair: 'A repair finished.', fleet: 'A fleet returned.', other: 'A new entry reached your log.', more: '+{count} more events.' },
  tr: { battle: 'Savaş raporun geldi.', probe: 'Gemine sonda geldi.', departure: '{name} kalktı.', repair: 'Bir onarım bitti.', fleet: 'Bir filon döndü.', other: 'Seyir defterine yeni kayıt geldi.', more: '+{count} olay daha.' },
  de: { battle: 'Ein Kampfbericht ist eingetroffen.', probe: 'Eine Sonde hat dein Schiff gescannt.', departure: '{name} hat den Sprung gemacht.', repair: 'Eine Reparatur ist fertig.', fleet: 'Eine Flotte ist zurück.', other: 'Ein neuer Logbucheintrag ist da.', more: '+{count} weitere Ereignisse.' },
  fr: { battle: 'Un rapport de bataille est arrivé.', probe: 'Une sonde a scanné ton vaisseau.', departure: '{name} a effectué le saut.', repair: 'Une réparation est terminée.', fleet: 'Une flotte est rentrée.', other: 'Une nouvelle entrée est au journal.', more: '+{count} autres événements.' },
  es: { battle: 'Ha llegado un informe de batalla.', probe: 'Una sonda ha escaneado tu nave.', departure: '{name} ha dado el salto.', repair: 'Ha terminado una reparación.', fleet: 'Ha regresado una flota.', other: 'Hay una nueva entrada en el registro.', more: '+{count} eventos más.' },
  ja: { battle: '戦闘報告が届きました。', probe: '船が探査機にスキャンされました。', departure: '{name}がジャンプしました。', repair: '修理が完了しました。', fleet: '艦隊が帰還しました。', other: '航海日誌に新しい記録があります。', more: 'ほか{count}件。' },
};
const priority: Record<ReturnEvent['kind'], number> = { battle: 0, probe: 1, departure: 2, repair: 3, fleet: 4, other: 5 };
export function returnMessage(kind: ReturnNotice, locale: keyof typeof copy, refId: string, count = 1, detail: Detail = {}): PushMessage {
  const [title, template] = copy[locale][kind];
  let body = template.replace('{count}', String(count));
  if (kind === 'repair_done' && count === 1) body = single[locale].replace('{name}', (detail.module ? returnModuleNames[locale]?.[detail.module] : undefined) ?? generic[locale]);
  if (kind === 'while_away') {
    const events = [...(detail.events ?? [])].sort((a, b) => priority[a.kind] - priority[b.kind]);
    body = events.slice(0, 2).map(event => news[locale][event.kind].replace('{name}', event.name ?? generic[locale])).join(' ');
    if (events.length > 2) {
      const remaining = events.length - 2;
      const one: Record<keyof typeof copy, string> = { en: '+1 more event.', tr: '+1 olay daha.', de: '+1 weiteres Ereignis.', fr: '+1 autre événement.', es: '+1 evento más.', ja: 'ほか1件。' };
      body += ' ' + (remaining === 1 ? one[locale] : news[locale].more.replace('{count}', String(remaining)));
    }
  }
  return { kind, title, body, data: { kind, refId } };
}
