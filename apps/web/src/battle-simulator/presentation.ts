/** A positive hit must remain visibly different from no damage. */
export function damageLabel(value: number, locale?: string): string {
  if (value <= 0) return '';
  return value < .1 ? `−<${(.1).toLocaleString(locale)}`
    : `−${value.toLocaleString(locale, { maximumFractionDigits: 1 })}`;
}

export function combatNumber(value: number, locale?: string): string {
  if (value > 0 && value < .0001) return `<${(.0001).toLocaleString(locale, { maximumFractionDigits: 4 })}`;
  return value.toLocaleString(locale, { maximumFractionDigits: value > 0 && value < .1 ? 4 : 2 });
}
