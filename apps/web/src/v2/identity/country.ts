import { COUNTRY_CODES, isCountryCode, type CountryCode } from '@astera/rules';
import { TIME_ZONE_COUNTRIES } from './timeZoneCountries.js';

export function countryName(code: string, language: string): string {
  try {
    return new Intl.DisplayNames([language], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function foldCountrySearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('tr-TR')
    .replace(/[ıİ]/g, 'i');
}

const ZONE_COUNTRY = new Map<string, CountryCode>();
for (const [country, zones] of Object.entries(TIME_ZONE_COUNTRIES)) {
  if (!isCountryCode(country)) continue;
  for (const zone of zones.split(' ')) ZONE_COUNTRY.set(zone.toLowerCase(), country);
}

/** The country of an IANA zone name; undefined for UTC, offsets and unknown names. IDs are case-insensitive. */
export function countryOfTimeZone(timeZone: string): CountryCode | undefined {
  return ZONE_COUNTRY.get(timeZone.toLowerCase());
}

/** The device clock's IANA zone, read locally — no permission, no network. */
export function browserTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

/**
 * Where the device's clock is set says where the player is better than the language it
 * speaks: a Turkish phone set to English still runs on Europe/Istanbul.
 */
export function detectCountry(nav: Pick<Navigator, 'language' | 'languages'>, timeZone?: string): CountryCode {
  const fromClock = timeZone === undefined ? undefined : countryOfTimeZone(timeZone);
  if (fromClock !== undefined) return fromClock;

  // `language` is the device's primary choice. A secondary `en-US` in
  // `languages` must not silently turn a Turkish or Japanese device American.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const tag = nav.language.length > 0 ? nav.language : (nav.languages?.[0] ?? '');
  const parts = tag.split('-');
  const region = parts.slice(1).find((part) => /^[A-Za-z]{2}$/.test(part));
  const candidate = region?.toUpperCase();
  if (candidate !== undefined && isCountryCode(candidate)) return candidate;

  // A bare language can identify some countries; English and Portuguese cannot.
  const languageCountry: Record<string, CountryCode> = {
    de: 'DE', es: 'ES', fr: 'FR', it: 'IT', ja: 'JP', ko: 'KR', tr: 'TR',
  };
  const fromLanguage = languageCountry[parts[0]?.toLowerCase() ?? ''];
  if (fromLanguage !== undefined) return fromLanguage;
  return 'TR';
}

export function countryOptions(language: string, selected: CountryCode, query: string) {
  const folded = foldCountrySearch(query.trim());
  return [...COUNTRY_CODES]
    .map((code) => ({ code, name: countryName(code, language) }))
    .filter(({ code, name }) => folded.length === 0
      || foldCountrySearch(name).includes(folded)
      || foldCountrySearch(code).includes(folded))
    .sort((a, b) => {
      if (a.code === selected) return -1;
      if (b.code === selected) return 1;
      return a.name.localeCompare(b.name, language, { sensitivity: 'base' });
    });
}
