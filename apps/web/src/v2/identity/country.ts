import { COUNTRY_CODES, isCountryCode, type CountryCode } from '@astera/rules';

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

export function detectCountry(nav: Pick<Navigator, 'language' | 'languages'>): CountryCode {
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
