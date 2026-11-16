/**
 * The lab's moments and their looks: today's (`now`) beside the prototypes. A `continuous` effect (a
 * burning hull, a shield) runs on one unbroken clock; a one-shot moment replays every ten seconds.
 */
export const LAB_MOMENTS = {
  deathstar: { continuous: false, title: 'Ölüm Yıldızı vuruşu', variants: { now: 'Bugünkü', nuke: 'Nükleer (prototip)' } },
  emp: { continuous: true, title: 'EMP saati', variants: { now: 'Bugünkü', storm: 'Elektrik fırtınası (prototip)' } },
  engines: { continuous: true, title: 'Motor alevleri', variants: { now: 'Bugünkü dört karakter', lab: 'Kütüphaneden üç yeni (prototip)' } },
  warp: { continuous: false, title: 'Filo sıçraması', variants: { depart: 'Kalkış (prototip)', arrive: 'Varış (prototip)', jump: 'Galaksiler arası (prototip)' } },
  mining: { continuous: false, title: 'Madencilik', variants: { now: 'Bugünkü', dig: 'Kazı (prototip)' } },
  scan: { continuous: false, title: 'Teleskop taraması', variants: { now: 'Bugünkü menziller', game: 'Oyundaki (teleskop)', probe: 'Oyundaki (sonda)', reveal: 'Keşif taraması (prototip)' } },
  damage: { continuous: true, title: 'Hasarlı gemi', variants: { now: 'Oyundaki', repair: 'Oyundaki, onarılırken', burn: 'Duman + alev + kıvılcım (prototip)' } },
  levelup: { continuous: false, title: 'Çekirdek seviye atladı', variants: { level: 'Seviye atlar', tier: 'Kademe atlar' } },
  aegis: { continuous: true, title: 'Aegis kalkanı', variants: { now: 'Oyundaki (Weave)', raid: 'Akın isabeti', crowd: '48 kubbe (ölçüm)' } },
} as const;
export type LabMoment = keyof typeof LAB_MOMENTS;

/** The look to show: the asked one if this moment has it, otherwise the moment's first prototype. */
export function labVariant(moment: LabMoment, asked: string | null): string {
  const variants = Object.keys(LAB_MOMENTS[moment].variants);
  if (asked !== null && variants.includes(asked)) return asked;
  return variants.find((variant) => variant !== 'now') ?? variants[0] ?? 'now';
}
