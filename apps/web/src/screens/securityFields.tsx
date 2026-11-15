import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../api/client.js';
import { RoundButton } from '../game-ui/index.js';

/**
 * A FIELD OF THE ACCOUNT, IN THE KIT'S GLASS SLOT (C25): its name over it, a code read large and
 * spaced, and a password shown or hidden by the eye beside it.
 */
export function SecurityField({ label, value, onChange, kind = 'text', autoComplete, disabled = false }: {
  label: string; value: string; onChange: (value: string) => void; kind?: 'text' | 'email' | 'password' | 'code'; autoComplete?: string; disabled?: boolean;
}) {
  const id = useId(); const { t } = useTranslation(); const [visible, setVisible] = useState(false);
  return <div className="gk-field">
    <label htmlFor={id} className="gk-label">{label}</label>
    <div className="gk-secfield">
      <input id={id} className={`gk-field__input${kind === 'code' ? ' gk-field__input--code gk-num' : ''}`}
        type={kind === 'password' && !visible ? 'password' : kind === 'email' ? 'email' : 'text'}
        inputMode={kind === 'code' ? 'numeric' : kind === 'email' ? 'email' : undefined}
        autoComplete={kind === 'code' ? 'one-time-code' : autoComplete} autoCapitalize="none" spellCheck={false}
        value={value} disabled={disabled} required maxLength={kind === 'code' ? undefined : kind === 'password' ? 200 : 254}
        pattern={kind === 'code' ? '[0-9]{6}' : undefined}
        onChange={event => { onChange(kind === 'code' ? event.target.value.replace(/[^0-9]/g, '').slice(0, 6) : event.target.value); }} />
      {kind === 'password' ? <RoundButton glyph="eye" lit={visible} label={t(visible ? 'accountSecurity.hide' : 'accountSecurity.show')}
        onPress={() => { setVisible(current => !current); }} /> : null}
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
