import { useTranslation } from 'react-i18next';
import type { Directive } from '../lib/directives.js';
import { useAccordion } from '../lib/accordion.js';

/**
 * The answer to "what should I do next", made the loudest thing on the screen.
 *
 * One card, never a list of five. A player who is told about five problems has
 * been told about none — and the ranking already decided which one matters, so
 * showing the runners-up would only undo that work.
 */
export function DirectiveCard({
  directive,
  onAct,
}: {
  directive: Directive;
  onAct: (directive: Directive) => void;
}) {
  const { t } = useTranslation();
  const label = t(
    directive.kind === 'threat'
      ? 'directives.kindThreat'
      : directive.kind === 'opportunity'
        ? 'directives.kindOpportunity'
        : directive.kind === 'growth'
          ? 'directives.kindGrowth'
          : 'directives.kindIdle',
  );

  const accent =
    directive.kind === 'threat'
      ? 'text-threat-ink'
      : directive.kind === 'opportunity'
        ? 'text-opportunity'
        : 'text-dim';

  /**
   * IT FOLDS, AND THE FOLD IS REMEMBERED. Owner instruction: *"kullanıcı sürekli
   * ekranda kocaman bunu görmek istemez."*
   *
   * This card sits over the galaxy permanently, and the galaxy is the product.
   * Even a commander who wants the advice does not want four lines of it under
   * every session — so it folds to one, and the fold is a device preference like
   * every other fold in the client rather than a thing to redo each time.
   *
   * OPEN BY DEFAULT, because the card only reaches a NEW commander at all
   * (`SituationGuide`), and its whole job is to be read once. Folding is what a
   * player does after that, not before.
   *
   * ABOVE EVERYTHING, INCLUDING ANY BRANCH BELOW IT. `useAccordion` is three
   * hooks; a component that reaches it from only some renders takes the whole app
   * down with React #310. See `FocusPanel`, where exactly that shipped.
   */
  const guide = useAccordion('guide', ['directive']);
  const open = guide.isOpen('directive');

  if (!open) {
    return (
      <button
        type="button"
        aria-label={t('directives.show')}
        onClick={() => { guide.toggle('directive'); }}
        className="plate plate-cut flex w-full items-center gap-2 px-3 py-1.5 text-left"
      >
        <span className={`legend shrink-0 ${accent}`}>{label}</span>
        <span className="min-w-0 flex-1 truncate text-caption text-dim">{directive.title}</span>
        <span aria-hidden className="shrink-0 text-faint">▾</span>
      </button>
    );
  }

  return (
    <div className="plate plate-cut relative w-full">
      <button
        type="button"
        onClick={() => {
          onAct(directive);
        }}
        data-directive-act
        className="flex w-full flex-col gap-1 px-3 py-2 pr-12 text-left"
      >
        <span className={`legend ${accent}`}>{label}</span>
        <p data-directive-detail className="text-body leading-tight text-bone">{directive.title}</p>
        <p data-directive-detail className="text-caption leading-snug text-dim">{directive.detail}</p>
        <span
          className={`name inline-flex items-center gap-2 ${accent}`}
        >
          {directive.action.label}
          <span aria-hidden>→</span>
        </span>
      </button>
      {/*
        A SIBLING, NEVER A CHILD. The card itself is the action, and a button
        inside a button is invalid markup whose press the browser routes to
        whichever the parser kept — which would have made folding the card
        navigate away from it.
      */}
      <button
        type="button"
        aria-label={t('directives.hide')}
        onClick={() => { guide.toggle('directive'); }}
        className="absolute right-1 top-1 flex size-8 items-center justify-center text-faint"
      >
        <span aria-hidden>▴</span>
      </button>
    </div>
  );
}

/** Compact form for screens that are not the one the directive points at. */
export function DirectiveStrip({
  directive,
  onAct,
}: {
  directive: Directive;
  onAct: (directive: Directive) => void;
}) {
  const { t } = useTranslation();
  const accent =
    directive.kind === 'threat'
      ? 'chip-threat'
      : directive.kind === 'opportunity'
        ? 'chip-opportunity'
        : 'chip';

  return (
    <button
      type="button"
      onClick={() => {
        onAct(directive);
      }}
      className="flex w-full items-center gap-2 border-b border-line-soft py-3 text-left"
    >
      {/* The KIND as a word, not the enum. The strip used to print `threat` —
          the machine's name for it — which was already wrong in English. */}
      <span className={`chip ${accent}`}>
        {t(
          directive.kind === 'threat'
            ? 'directives.kindThreat'
            : directive.kind === 'opportunity'
              ? 'directives.kindOpportunity'
              : directive.kind === 'growth'
                ? 'directives.kindGrowth'
                : 'directives.kindIdle',
        )}
      </span>
      <span className="min-w-0 flex-1 truncate text-body text-bone">{directive.title}</span>
      <span aria-hidden className="text-faint">
        →
      </span>
    </button>
  );
}
