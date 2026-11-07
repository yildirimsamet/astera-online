import { and, eq, ne } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import { pushDevices, vessels } from '../../db/schema.js';
import { returnMessage, type ReturnNotice } from '../returnCopy.js';
import { sendPush, type PushMessage } from '../notificationCenter.js';

type Locale = (typeof pushDevices.$inferSelect)['locale'];
type Ring = { kind: ReturnNotice; refId: string; count?: number; module?: string } |  { kind: 'incoming_attack'; refId: string; minutes: number } | { kind: 'probe_detected' | 'raid_over' | 'raided' | 'system_open' | 'shield_falling'; refId: string };

const COPY: Record<Locale, Record<Exclude<Ring['kind'], ReturnNotice>, { title: string; body: string }>> = {
  tr: {
    incoming_attack: { title: 'Saldırı geliyor', body: 'Gemine bir filo yaklaşıyor. Varış: {minutes} dk.' },
    probe_detected: { title: 'Sonda tespit edildi', body: 'Bir sonda gemini taradı.' },
    raid_over: { title: 'Akının sonucu geldi', body: 'Rapor hazır. Ne döndüğüne bak.' },
    raided: { title: 'Gemine akın edildi', body: 'Rapor hazır. Neyi kaybettiğine bak.' },
    system_open: { title: 'Yeni sistem açıldı', body: 'Onarım bitti, gemide yeni bir sistem çalışıyor.' },
    shield_falling: { title: 'Kalkanın düşüyor', body: 'Kalkanın 1 saat sonra düşüyor.' },
  },
  en: {
    incoming_attack: { title: 'Attack incoming', body: 'A fleet is closing on your ship. Arrives in {minutes} min.' },
    probe_detected: { title: 'Probe detected', body: 'A probe scanned your ship.' },
    raid_over: { title: 'Raid result is in', body: 'The report is ready. See what came back.' },
    raided: { title: 'Your ship was raided', body: 'The report is ready. See what you lost.' },
    system_open: { title: 'New system open', body: 'A repair finished and a new system is running.' },
    shield_falling: { title: 'Your shield is falling', body: 'Your shield falls in 1 hour.' },
  },
  de: {
    incoming_attack: { title: 'Angriff im Anflug', body: 'Eine Flotte nähert sich deinem Schiff. Ankunft in {minutes} Min.' },
    probe_detected: { title: 'Sonde entdeckt', body: 'Eine Sonde hat dein Schiff gescannt.' },
    raid_over: { title: 'Ergebnis des Überfalls', body: 'Der Bericht ist da. Sieh nach, was zurückkam.' },
    raided: { title: 'Dein Schiff wurde überfallen', body: 'Der Bericht ist da. Sieh nach, was du verloren hast.' },
    system_open: { title: 'Neues System offen', body: 'Eine Reparatur ist fertig, ein neues System läuft.' },
    shield_falling: { title: 'Dein Schild fällt', body: 'Dein Schild fällt in 1 Stunde.' },
  },
  fr: {
    incoming_attack: { title: 'Attaque en approche', body: 'Une flotte approche de ton vaisseau. Arrivée dans {minutes} min.' },
    probe_detected: { title: 'Sonde détectée', body: 'Une sonde a scanné ton vaisseau.' },
    raid_over: { title: 'Résultat du raid', body: 'Le rapport est prêt. Regarde ce qui revient.' },
    raided: { title: 'Ton vaisseau a été attaqué', body: 'Le rapport est prêt. Regarde ce que tu as perdu.' },
    system_open: { title: 'Nouveau système ouvert', body: 'Une réparation est finie, un nouveau système tourne.' },
    shield_falling: { title: 'Ton bouclier tombe', body: 'Ton bouclier tombe dans 1 heure.' },
  },
  es: {
    incoming_attack: { title: 'Ataque en camino', body: 'Una flota se acerca a tu nave. Llega en {minutes} min.' },
    probe_detected: { title: 'Sonda detectada', body: 'Una sonda escaneó tu nave.' },
    raid_over: { title: 'Resultado de la incursión', body: 'El informe está listo. Mira qué ha vuelto.' },
    raided: { title: 'Han atacado tu nave', body: 'El informe está listo. Mira qué has perdido.' },
    system_open: { title: 'Nuevo sistema abierto', body: 'Una reparación ha terminado y funciona un nuevo sistema.' },
    shield_falling: { title: 'Tu escudo cae', body: 'Tu escudo cae en 1 hora.' },
  },
  ja: {
    incoming_attack: { title: '攻撃接近中', body: '艦隊があなたの船に接近中。到着まで{minutes}分。' },
    probe_detected: { title: '探査機を検知', body: 'あなたの船が探査機にスキャンされました。' },
    raid_over: { title: '襲撃の結果が届きました', body: '報告書の準備ができました。戻ったものを確認しましょう。' },
    raided: { title: 'あなたの船が襲撃されました', body: '報告書の準備ができました。失ったものを確認しましょう。' },
    system_open: { title: '新しいシステムが開放', body: '修理が完了し、新しいシステムが稼働しています。' },
    shield_falling: { title: 'シールドが切れます', body: 'シールドはあと1時間で切れます。' },
  },
};

const write = (ring: Ring, locale: Locale): PushMessage => {
  if (ring.kind === 'repair_done' || ring.kind === 'miner_home' || ring.kind === 'repair_funded' || ring.kind === 'while_away') return returnMessage(ring.kind, locale, ring.refId, ring.count, ring.module ? { module: ring.module } : {});
  const copy = COPY[locale][ring.kind];
  return {
    kind: ring.kind, title: copy.title,
    body: ring.kind === 'incoming_attack' ? copy.body.replace('{minutes}', String(ring.minutes)) : copy.body,
    data: { kind: ring.kind, refId: ring.refId },
  };
};

/**
 * THE PHONE, ABOARD. A12 and §3.10: free here, so a player learns what the warning is worth before it
 * costs a wallet, and each of these is a reason to come back. No wallet is read, no alert is armed. A landed ship rings nothing: the main rule has taken
 * over. Called after the commit, and a provider outage stops here: the warning is already on the ship,
 * and the transport reports its own failures.
 */
export async function ringShip(db: Db, vesselId: string, ring: Ring, now = new Date()): Promise<void> {
  try {
    const devices = await db.select({ token: pushDevices.token, locale: pushDevices.locale }).from(pushDevices)
      .innerJoin(vessels, eq(vessels.accountId, pushDevices.accountId))
      .where(and(eq(vessels.id, vesselId), ne(vessels.status, 'DEPARTED')));
    await sendPush(db, devices, locale => write(ring, locale), now);
  } catch {
    return;
  }
}
