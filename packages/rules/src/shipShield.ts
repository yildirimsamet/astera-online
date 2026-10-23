/** A focused hit. Only the front survivor may have a partly spent personal shield. */
export function shipShieldHit(count: number, hp: number, wound: number, damage: number, shield: number, shieldLeft = shield) {
  if (!Number.isSafeInteger(count) || count < 0 || !Number.isFinite(hp) || hp <= 0
    || !Number.isFinite(wound) || wound < 0 || wound >= hp
    || !Number.isFinite(damage) || damage < 0 || !Number.isFinite(shield) || shield < 0
    || !Number.isFinite(shieldLeft) || shieldLeft < 0 || shieldLeft > shield) {
    throw new RangeError('invalid personal shield hit');
  }
  if (count === 0) return { count: 0, wound: 0, shieldLeft: 0, absorbed: 0, hullDamage: 0, left: damage };
  const firstHp = hp - wound;
  const firstAbsorbed = Math.min(damage, shieldLeft);
  let left = damage - firstAbsorbed;
  if (left < firstHp) {
    return { count, wound: wound + left, shieldLeft: shieldLeft - firstAbsorbed, absorbed: firstAbsorbed, hullDamage: left, left: 0 };
  }
  left -= firstHp;
  const restKilled = Math.min(count - 1, Math.floor(left / (hp + shield)));
  left -= restKilled * (hp + shield);
  const survivors = count - 1 - restKilled;
  const lastAbsorbed = survivors > 0 ? Math.min(left, shield) : 0;
  const lastWound = survivors > 0 ? Math.max(0, left - lastAbsorbed) : 0;
  return { count: survivors, wound: lastWound, shieldLeft: survivors > 0 ? shield - lastAbsorbed : 0,
    absorbed: firstAbsorbed + restKilled * shield + lastAbsorbed,
    hullDamage: firstHp + restKilled * hp + lastWound,
    left: survivors > 0 ? 0 : left };
}
