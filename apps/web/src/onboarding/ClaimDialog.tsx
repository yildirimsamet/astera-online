import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MIN_PASSWORD, validUsername } from '../lib/credentials.js';
import { Button } from '../ui/kit/index.js';
import type { CountryCode } from '@astera/rules';
import { CountryPicker } from '../v2/identity/CountryPicker.js';
import { Flag } from '../v2/identity/Flag.js';
import { countryName, detectCountry } from '../v2/identity/country.js';

/**
 * THE WALL, AT THE ONE MOMENT THE PLAYER WANTS SOMETHING. D56.
 *
 * It is deliberately the last thing rather than the first. A stranger who has just
 * spent ninety seconds building a world, spending a budget to the unit and
 * committing a fleet is a different person from the one who arrived — and the form
 * asks them to keep what they already have rather than to gamble two minutes on
 * whether this game is any good.
 *
 * TWO STEPS, ONE `<form>`. The split is for the player: a name and a password on
 * one screen is a signup, a name on its own is being asked what to call yourself.
 * The single form element is for the BROWSER — a password manager only offers to
 * save a credential when the username and the password are submitted together, so
 * two separate forms would silently cost every player the thing that makes an
 * account survive a reinstall. The name field therefore stays mounted for step
 * two, still editable beside the password so a taken name can be fixed without
 * retracing a step.
 *
 * IT NEVER TRAPS ANYBODY. "I already have a commander" is on both steps: a
 * returning player who pressed the wrong door must be able to leave from here, not
 * only from the front page they can no longer see.
 */
export function ClaimDialog({
  planetName,
  onClaim,
  onSignIn,
  error,
  introduction,
}: {
  planetName: string;
  onClaim: (username: string, password: string, countryCode?: CountryCode) => Promise<void>;
  onSignIn: () => void;
  /** A refusal from the claim, already translated. */
  error?: string;
  /** The caller describes what will actually be transferred; legacy intents differ. */
  introduction?: string;
}) {
  const { t, i18n } = useTranslation();
  const [step, setStep] = useState<'name' | 'password'>('name');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [problemField, setProblemField] = useState<'name' | 'password' | null>(null);
  const [busy, setBusy] = useState(false);
  const [submittedUsername, setSubmittedUsername] = useState<string | null>(null);
  const [countryCode, setCountryCode] = useState<CountryCode>(() => detectCountry(navigator));
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const nameId = useId();
  const passwordId = useId();
  const nameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // Whichever field the step is about starts focused. Via the DOM rather than the
  // `autoFocus` attribute, which is unreliable inside a portal that animates.
  useEffect(() => {
    if (step === 'name') nameRef.current?.focus();
    else passwordRef.current?.focus();
  }, [step]);
  useEffect(() => {
    if (error && step === 'password') nameRef.current?.focus();
  }, [error, step]);

  const naming = step === 'name';
  /** What this form got wrong first, then what the server refused. */
  const complaint = problem ?? (!busy && submittedUsername === username.trim() ? error : undefined);
  const serverComplaint = !problem && !busy && submittedUsername === username.trim() && !!error;

  const submit = (): void => {
    if (busy) return;

    if (!validUsername(username)) {
      setProblem(t('landing.form.badName'));
      setProblemField('name');
      nameRef.current?.focus();
      return;
    }
    if (naming) {
      setProblem(null);
      setProblemField(null);
      setStep('password');
      return;
    }

    if (password.length < MIN_PASSWORD) {
      setProblem(t('landing.form.shortPassword', { count: MIN_PASSWORD }));
      setProblemField('password');
      return;
    }
    setProblem(null);
    setProblemField(null);
    setSubmittedUsername(username.trim());
    setBusy(true);
    void (async () => {
      try {
        await onClaim(username.trim(), password, countryCode);
      } catch {
        // The refusal arrives through `error`; what this owns is letting the
        // player press again without retyping anything.
        setBusy(false);
      }
    })();
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={t('onboarding.claim.headingName')}
    >
      <div className="absolute inset-0 bg-void/70" />

      <form
        className="plate plate-cut relative w-full max-w-md p-6 pb-[calc(24px+env(safe-area-inset-bottom))]"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <p className="legend">
          {naming ? t('onboarding.claim.eyebrowName') : t('onboarding.claim.eyebrowPassword')}
        </p>
        <h2 className="headline text-figure mt-2 leading-tight text-bone">
          {naming
            ? t('onboarding.claim.headingName')
            : t('onboarding.claim.headingPassword', { name: planetName })}
        </h2>
        <p className="mt-2 text-body leading-snug text-dim">
          {naming
            ? introduction ?? t('onboarding.claim.lineName', { name: planetName })
            : t('onboarding.claim.linePassword')}
        </p>

        {/* Keep the name editable beside the password so a taken name can be fixed here. */}
        <label className="legend mt-6 block" htmlFor={nameId}>
          {t('onboarding.claim.nameLabel')}
        </label>
        <input
          id={nameId}
          ref={nameRef}
          name="username"
          className={`field mt-2 ${problemField === 'name' || serverComplaint ? 'field-bad' : ''}`}
          value={username}
          onChange={(event) => {
            setUsername(event.target.value);
            setProblem(null);
            setProblemField(null);
          }}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={64}
          placeholder={t('landing.form.namePlaceholder')}
        />

        {!naming && (
          <>
            <label className="legend mt-2 block" htmlFor={passwordId}>
              {t('onboarding.claim.passwordLabel')}
            </label>
            <input
              id={passwordId}
              ref={passwordRef}
              name="password"
              className={`field mt-2 ${problemField === 'password' ? 'field-bad' : ''}`}
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setProblem(null);
                setProblemField(null);
              }}
              autoComplete="new-password"
              maxLength={200}
              placeholder={t('landing.form.passwordPlaceholder', { count: MIN_PASSWORD })}
            />
            <div className="mt-4">
              <p className="legend">{t('country.label')}</p>
              <button
                type="button"
                className="mt-2 flex min-h-10 w-full items-center gap-2 rounded-control border border-line-soft bg-void/30 px-3 text-left text-caption text-bone"
                onClick={() => { setCountryPickerOpen(true); }}
              >
                <Flag code={countryCode} language={i18n.resolvedLanguage ?? 'en'} />
                <span className="flex-1">{countryName(countryCode, i18n.resolvedLanguage ?? 'en')}</span>
                <span className="text-dim">{t('country.change')}</span>
              </button>
            </div>
          </>
        )}

        {complaint !== undefined && (
          <p className="mt-3 text-body text-threat-ink" role="alert">
            {complaint}
          </p>
        )}

        <Button type="submit" variant="primary" size="lg" full disabled={busy} className="mt-6">
          {busy
            ? t('onboarding.claim.working')
            : naming
              ? t('onboarding.claim.next')
              : t('onboarding.claim.submit')}
        </Button>

        <div className="mt-2 flex items-center justify-between gap-2">
          <button
            type="button"
            className="text-caption text-faint underline-offset-4 hover:underline"
            onClick={onSignIn}
          >
            {t('onboarding.haveAccount')}
          </button>
          {!naming && (
            <button
              type="button"
              className="text-caption text-faint underline-offset-4 hover:underline"
              onClick={() => {
                setProblem(null);
                setProblemField(null);
                setStep('name');
              }}
            >
              {t('onboarding.claim.back')}
            </button>
          )}
        </div>
      </form>
      {countryPickerOpen && (
        <CountryPicker
          value={countryCode}
          onSelect={(next) => {
            setCountryCode(next);
            setCountryPickerOpen(false);
          }}
          onClose={() => { setCountryPickerOpen(false); }}
        />
      )}
    </div>
  );
}
