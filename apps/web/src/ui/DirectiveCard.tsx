import { useTranslation } from 'react-i18next';
import type { Directive } from '../lib/directives.js';

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

  return (
    <button
      type="button"
      onClick={() => {
        onAct(directive);
      }}
      className={`directive directive-${directive.kind} block w-full text-left`}
    >
      <span className={`legend ${accent}`}>{label}</span>
      <p className="mt-2 text-title leading-tight text-bone">{directive.title}</p>
      <p className="mt-2 text-body leading-snug text-dim">{directive.detail}</p>
      <span
        className={`name mt-3 inline-flex items-center gap-2 ${accent}`}
      >
        {directive.action.label}
        <span aria-hidden>→</span>
      </span>
    </button>
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
