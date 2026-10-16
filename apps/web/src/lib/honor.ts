import i18n from '../i18n/index.js';

/** Preserve all six accounting digits, even at the safe-integer ceiling. */
export function honorScore(micro: number | bigint): string {
  if (typeof micro === 'number' && !Number.isSafeInteger(micro)) throw new RangeError('Invalid Honor score');
  const amount = BigInt(micro), absolute = amount < 0n ? -amount : amount;
  const locale = i18n.t('units.numberLocale');
  const whole = (absolute / 1_000_000n).toLocaleString(locale);
  const fraction = (absolute % 1_000_000n).toString().padStart(6, '0').replace(/0+$/, '');
  const separator = new Intl.NumberFormat(locale).formatToParts(1.1).find(part => part.type === 'decimal')?.value ?? '.';
  return `${amount < 0n ? '-' : ''}${whole}${fraction ? separator + fraction : ''}`;
}
