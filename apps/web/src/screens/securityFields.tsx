import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../api/client.js';

export const securityInputClass = 'min-h-12 w-full rounded-control border border-v2-line-hi bg-v2-deep px-3 font-v2-ui text-body text-v2-ink outline-none focus:border-v2-self focus:ring-1 focus:ring-v2-self/30';
export function SecurityField({ label, value, onChange, kind = 'text', autoComplete, disabled = false }: {
  label: string; value: string; onChange: (value: string) => void; kind?: 'text' | 'email' | 'password' | 'code'; autoComplete?: string; disabled?: boolean;
}) {
  const id = useId(); const { t } = useTranslation(); const [visible, setVisible] = useState(false);
  return <div className="flex flex-col gap-1.5">
    <label htmlFor={id} className="text-caption font-medium text-v2-ink-2">{label}</label>
    <div className="flex items-center gap-2">
      <input id={id} className={`${securityInputClass} ${kind === 'code' ? 'font-v2-mono text-center text-figure tracking-wide' : ''}`}
        type={kind === 'password' && !visible ? 'password' : kind === 'email' ? 'email' : 'text'}
        inputMode={kind === 'code' ? 'numeric' : kind === 'email' ? 'email' : undefined}
        autoComplete={kind === 'code' ? 'one-time-code' : autoComplete} autoCapitalize="none" spellCheck={false}
        value={value} disabled={disabled} required maxLength={kind === 'code' ? undefined : kind === 'password' ? 200 : 254}
        pattern={kind === 'code' ? '[0-9]{6}' : undefined}
        onChange={event => { onChange(kind === 'code' ? event.target.value.replace(/[^0-9]/g, '').slice(0, 6) : event.target.value); }} />
      {kind === 'password' ? <button type="button" className="min-h-11 shrink-0 text-caption text-v2-self" aria-controls={id}
        onClick={() => { setVisible(current => !current); }}>{t(visible ? 'accountSecurity.hide' : 'accountSecurity.show')}</button> : null}
    </div>
  </div>;
}
export function useSecurityError() {
  const { t } = useTranslation();
  return (error: unknown): string => {
    if (error instanceof ApiError) {
      if (error.code === 'EMAIL_IN_USE') return t('accountSecurity.inUse');
      if (error.code === 'EMAIL_CODE_INVALID') return t('accountSecurity.invalid');
      if (error.code === 'RATE_LIMITED') return t('accountSecurity.limited');
      if (error.code === 'BAD_CREDENTIALS') return t('accountSecurity.credentials');
      if (error.code === 'EMAIL_UNAVAILABLE') return t('accountSecurity.unavailable');
    }
    return t('accountSecurity.error');
  };
}
