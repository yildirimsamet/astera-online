import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MIN_PASSWORD, USERNAME_PATTERN } from '../lib/credentials.js';
import { Button } from '../ui/kit/index.js';

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
 * two, as a readonly line that also happens to confirm what they chose.
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
}: {
  planetName: string;
  onClaim: (username: string, password: string) => Promise<void>;
  onSignIn: () => void;
  /** A refusal from the claim, already translated. */
  error?: string;
}) {
  const { t } = useTranslation();
  const [step, setStep] = useState<'name' | 'password'>('name');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
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

  const naming = step === 'name';
  /** What this form got wrong first, then what the server refused. */
  const complaint = problem ?? error;

  const submit = (): void => {
    if (busy) return;

    if (naming) {
      if (!USERNAME_PATTERN.test(username.trim())) {
        setProblem(t('landing.form.badName'));
        return;
      }
      setProblem(null);
      setStep('password');
      return;
    }

    if (password.length < MIN_PASSWORD) {
      setProblem(t('landing.form.shortPassword', { count: MIN_PASSWORD }));
      return;
    }
    setProblem(null);
    setBusy(true);
    void (async () => {
      try {
        await onClaim(username.trim(), password);
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
      <div className="absolute inset-0 bg-void/70 backdrop-blur-sm" />

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
        <h2 className="mt-2 font-display text-[22px] uppercase leading-tight tracking-[0.05em] text-bone">
          {naming
            ? t('onboarding.claim.headingName')
            : t('onboarding.claim.headingPassword', { name: planetName })}
        </h2>
        <p className="mt-2 text-[13px] leading-snug text-dim">
          {naming
            ? t('onboarding.claim.lineName', { name: planetName })
            : t('onboarding.claim.linePassword')}
        </p>

        {/*
          MOUNTED ON BOTH STEPS, ALWAYS. On step two it is a readonly line rather
          than a field — the browser still sees a username submitted beside the
          password, which is the only way the credential gets offered for saving.
        */}
        <label className={`legend mt-6 block ${naming ? '' : 'opacity-60'}`} htmlFor={nameId}>
          {t('onboarding.claim.nameLabel')}
        </label>
        <input
          id={nameId}
          ref={nameRef}
          name="username"
          className={`field mt-2 ${problem !== null && naming ? 'field-bad' : ''} ${
            naming ? '' : 'opacity-60'
          }`}
          value={username}
          onChange={(event) => {
            setUsername(event.target.value);
            setProblem(null);
          }}
          readOnly={!naming}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={16}
          placeholder={t('landing.form.namePlaceholder')}
        />

        {!naming && (
          <>
            <label className="legend mt-4 block" htmlFor={passwordId}>
              {t('onboarding.claim.passwordLabel')}
            </label>
            <input
              id={passwordId}
              ref={passwordRef}
              name="password"
              className={`field mt-2 ${problem !== null ? 'field-bad' : ''}`}
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setProblem(null);
              }}
              autoComplete="new-password"
              maxLength={200}
              placeholder={t('landing.form.passwordPlaceholder', { count: MIN_PASSWORD })}
            />
          </>
        )}

        {complaint !== undefined && (
          <p className="mt-3 text-[13px] text-alert" role="alert">
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

        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            className="text-[12px] text-faint underline-offset-4 hover:underline"
            onClick={onSignIn}
          >
            {t('onboarding.haveAccount')}
          </button>
          {!naming && (
            <button
              type="button"
              className="text-[12px] text-faint underline-offset-4 hover:underline"
              onClick={() => {
                setProblem(null);
                setStep('name');
              }}
            >
              {t('onboarding.claim.back')}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
