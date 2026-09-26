import { isCountryCode } from '@astera/rules';
import { countryName } from './country.js';

const flags = import.meta.glob<string>('/node_modules/flag-icons/flags/4x3/*.svg', {
  eager: true,
  import: 'default',
  query: '?url',
});

function flagUrl(code: string): string | null {
  if (!isCountryCode(code)) return null;
  const suffix = `/4x3/${code.toLowerCase()}.svg`;
  const entry = Object.entries(flags).find(([path]) => path.endsWith(suffix));
  return entry?.[1] ?? null;
}

export function Flag({ code, language = 'en', className = '' }: {
  code: string;
  language?: string;
  className?: string;
}) {
  const label = countryName(code, language);
  const src = flagUrl(code);
  if (src === null) {
    return <span role="img" aria-label={code} className={`inline-flex items-center justify-center font-v2-mono text-micro rounded-cell ${className}`}>{code}</span>;
  }
  return <img src={src} alt={label} role="img" className={`inline-block h-3 w-5 rounded-cell object-cover ${className}`} />;
}
