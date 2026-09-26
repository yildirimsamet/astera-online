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
  const tags = [...nav.languages, nav.language];
  for (const tag of tags) {
    const parts = tag.split('-');
    const region = parts.slice(1).find((part) => /^[A-Za-z]{2}$/.test(part));
    const candidate = region?.toUpperCase();
    if (candidate !== undefined && isCountryCode(candidate)) return candidate;
  }
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
