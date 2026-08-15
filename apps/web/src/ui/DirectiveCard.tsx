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
  const label =
    directive.kind === 'threat'
      ? 'Threat'
      : directive.kind === 'opportunity'
        ? 'Opportunity'
        : directive.kind === 'growth'
          ? 'Weakness'
          : 'Nothing pending';

  const accent =
    directive.kind === 'threat'
      ? 'text-[#ff9d8f]'
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
      <p className="mt-1.5 text-[17px] leading-tight text-bone">{directive.title}</p>
      <p className="mt-1.5 text-[13px] leading-snug text-dim">{directive.detail}</p>
      <span
        className={`mt-3 inline-flex items-center gap-1.5 font-display text-[12px] uppercase tracking-[0.12em] ${accent}`}
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
      className="flex w-full items-center gap-3 border-b border-line-soft py-2.5 text-left"
    >
      <span className={`chip ${accent}`}>{directive.kind}</span>
      <span className="min-w-0 flex-1 truncate text-[13px] text-bone">{directive.title}</span>
      <span aria-hidden className="text-faint">
        →
      </span>
    </button>
  );
}
