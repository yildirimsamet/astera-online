import { GALAXY, fleetEntries } from '@astera/rules';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../api/client.js';
import type { Landing, MigrationView } from '../api/starterSchemas.js';
import { hullLabel } from '../i18n/names.js';
import { full } from '../lib/format.js';
import { RESOURCE_ART } from '../ui/assets.js';
import { describe, useToast } from '../ui/Toast.js';
import { HoldButton } from '../v2/kit/HoldButton.js';
import { Sheet } from '../v2/kit/Sheet.js';
import { pressJump, releaseJump } from './jump.js';
import { useMigrate, useMigration } from './queries.js';

/** The emptiest first, so the card always reads from safe to dangerous. */
const toneOf = (index: number, count: number): 'quiet' | 'mixed' | 'busy' =>
  count === 1 ? 'mixed' : index === 0 ? 'quiet' : index === count - 1 ? 'busy' : 'mixed';

/** Where the three sit in the galaxy, seen from above: a place on a disc needs no name to be chosen. */
function AddressMap({ choices, picked }: { choices: MigrationView['choices']; picked: number | null }) {
  const reach = GALAXY.radius * 1.1;
  return (
    <svg aria-hidden="true" viewBox="-100 -100 200 200" className="size-[84px] shrink-0">
      <defs>
        <radialGradient id="landing-disc">
          <stop offset="0" stopColor="var(--color-v2-self)" stopOpacity=".3" />
          <stop offset=".6" stopColor="var(--color-v2-self)" stopOpacity=".08" />
          <stop offset="1" stopColor="var(--color-v2-self)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle r="98" fill="url(#landing-disc)" />
      <circle r="62" fill="none" stroke="var(--color-v2-line-hi)" strokeWidth=".7" strokeDasharray="2 4" />
      <circle r="96" fill="none" stroke="var(--color-v2-line-hi)" strokeWidth=".7" />
      {choices.map(choice => {
        const x = (choice.x / reach) * 92, y = (choice.z / reach) * 92;
        const on = choice.index === picked;
        return <g key={choice.index} transform={`translate(${String(x)} ${String(y)})`}>
          {on && <circle r="14" fill="none" stroke="var(--color-v2-self)" strokeWidth="2" />}
          <circle r={on ? 7 : 5} fill={on ? 'var(--color-v2-self)' : 'var(--color-v2-ink-2)'} />
        </g>;
      })}
    </svg>
  );
}

function Amount({ resource, amount }: { resource: 'alloy' | 'crystal' | 'deuterium'; amount: number }) {
  const { t } = useTranslation();
  return (
    <span className="flex items-center gap-1 font-v2-mono text-caption tabular-nums text-v2-ink">
      <img src={RESOURCE_ART[resource]} alt={t(`vocabulary.resource.${resource}`)} className="size-3.5 object-contain" />
      {full(amount)}
    </span>
  );
}

/** What will not make the jump, said wherever the jump is weighed (player test: seen only at the end). */
export function LeftBehind({ left }: { left: MigrationView['left'] }) {
  const { t } = useTranslation();
  if (left.alloy + left.crystal + left.deuterium + left.ships <= 0) return null;
  return (
    <p data-testid="jump-left" className="text-micro leading-snug text-v2-ink-2">
      {t('starter.jump.left', { alloy: full(left.alloy), crystal: full(left.crystal), deuterium: full(left.deuterium), ships: left.ships })}
    </p>
  );
}

/**
 * THE LAST SCREEN OF THE SHIP. Where it lands, what comes down, what is lost, and one long press. The
 * neighbours are counted because a count is all a stranger could see from here (plan §3.8).
 */
export function LandingChoice({ view: opened, onCancel, onLanded }: {
  view: MigrationView;
  onCancel: () => void;
  onLanded: (landing: Landing) => void;
}) {
  const { t } = useTranslation();
  const say = useToast();
  const migrate = useMigrate();
  // Live, so an address that has gone is replaced under the player's eyes rather than refused twice.
  const view = useMigration().data ?? opened;
  const [wanted, setWanted] = useState<number | null>(view.choices[0]?.index ?? null);
  const picked = view.choices.some(choice => choice.index === wanted) ? wanted : view.choices[0]?.index ?? null;
  // The scene is on its way before the press, so the moment of leaving never waits on the network.
  useEffect(() => { void import('../galaxy/MigrationSequence.js'); }, []);
  const name = view.target?.name ?? '';
  return (
    <Sheet
      title={t('starter.jump.title', { name })}
      eyebrow={t('starter.eyebrow')}
      onClose={onCancel}
      footer={
        <HoldButton
          label={t('starter.jump.hold')}
          disabledReason={migrate.isPending ? t('starter.jump.leaving') : null}
          onCommit={() => {
            pressJump();
            // The promise and not the press's own callbacks: the landing is answered even if this sheet is gone.
            void migrate.mutateAsync(picked).then(onLanded, (error: unknown) => {
              releaseJump();
              say(describe(error), 'error');
              // The ship is untouched and new addresses are on their way: the choice is still the right screen.
              if (!(error instanceof ApiError && error.code === 'LANDING_GONE')) onCancel();
            });
          }}
        />
      }
    >
      <div className="flex flex-col gap-3 pt-1 font-v2-ui">
        {view.choices.length > 0 && (
          <section className="flex flex-col gap-1.5">
            <h3 className="text-label font-semibold uppercase tracking-label text-v2-ink-2">{t('starter.jump.addresses')}</h3>
            <div className="flex items-stretch gap-2">
              <AddressMap choices={view.choices} picked={picked} />
              <div role="radiogroup" aria-label={t('starter.jump.addresses')} className="flex min-w-0 flex-1 flex-col gap-1">
                {view.choices.map((choice, index) => {
                  const tone = toneOf(index, view.choices.length);
                  const on = picked === choice.index;
                  return (
                    <button key={choice.index} type="button" role="radio" aria-checked={on}
                      aria-label={`${t(`starter.jump.tone.${tone}`)}. ${t('starter.jump.neighbours', { count: choice.neighbours })}`}
                      onClick={() => { setWanted(choice.index); }}
                      className={`min-h-10 rounded-control border px-2 py-1 text-left ${on ? 'border-v2-self bg-v2-self/10' : 'border-v2-line bg-v2-void/50'}`}>
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-caption font-medium text-v2-ink">{t(`starter.jump.tone.${tone}`)}</span>
                        <span className="shrink-0 font-v2-mono text-micro text-v2-ink-2">{t('starter.jump.neighbours', { count: choice.neighbours })}</span>
                      </span>
                      <span className="block text-micro leading-snug text-v2-ink-3">{t(`starter.jump.toneNote.${tone}`)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        <section className="flex flex-col gap-1.5">
          <h3 className="text-label font-semibold uppercase tracking-label text-v2-ink-2">{t('starter.jump.cargo')}</h3>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-control border border-v2-line bg-v2-void/50 px-2 py-1.5">
            <Amount resource="alloy" amount={view.cargo.alloy} />
            <Amount resource="crystal" amount={view.cargo.crystal} />
            <Amount resource="deuterium" amount={view.cargo.deuterium} />
            {fleetEntries(view.cargo.fleet).map(([hull, count]) => (
              <span key={hull} className="font-v2-mono text-caption text-v2-ink">{count} {hullLabel(hull)}</span>
            ))}
          </div>
          <p className="text-micro leading-snug text-v2-ink-3">{t('starter.jump.package')}</p>
        </section>

        <LeftBehind left={view.left} />
        <p data-testid="jump-warning" role="note" className="rounded-control border border-v2-warn/40 bg-v2-warn/10 px-2 py-1.5 text-caption leading-snug text-v2-warn">
          {t('starter.jump.warn')}
        </p>
      </div>
    </Sheet>
  );
}
