import { PlanetSigil } from '../ui/PlanetSigil.js';

/**
 * The front door.
 *
 * One button, no form, no email. The acceptance test for the whole product is a
 * player looking at their own planet inside sixty seconds, and a login wall makes
 * that impossible. The copy does the only teaching this game does: it states the
 * premise and then gets out of the way.
 */
export function EntryScreen({
  onBegin,
  busy,
  error,
}: {
  onBegin: () => void;
  busy: boolean;
  error?: string;
}) {
  return (
    <main className="flex min-h-dvh flex-col justify-between px-6 pb-[calc(32px+env(safe-area-inset-bottom))] pt-[calc(72px+env(safe-area-inset-top))]">
      <div>
        <h1 className="font-display text-[44px] uppercase leading-none tracking-[0.06em] text-bone">
          Blind
          <span className="text-faint">space</span>
        </h1>
        <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-dim">
          You own one planet in a galaxy of two hundred real people. You cannot see what they
          hold. They cannot see what you hold.
        </p>
        <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-dim">
          Everything either side does about that is the game.
        </p>
      </div>

      <div className="relative my-10 flex justify-center" aria-hidden>
        <PlanetSigil seed="blindspace-entry" size={188} />
      </div>

      <div>
        {error && <p className="mb-3 text-[13px] text-alert">{error}</p>}
        <button type="button" className="btn w-full py-4" onClick={onBegin} disabled={busy}>
          {busy ? 'Finding a slot' : 'Take a planet'}
        </button>
        <p className="mt-3 text-center text-[11px] text-faint">
          No account, no email. This device is your commander.
        </p>
      </div>
    </main>
  );
}
