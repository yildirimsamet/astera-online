import './dragHint.css';

/**
 * THE VIEW MOVES (owner playtest 2026-11-06). Over the ship on the first look: a hand that sweeps
 * side to side between two arrows, so a commander knows the scene can be dragged before being told
 * anything else. It never takes a touch.
 */
export function DragHint() {
  return (
    <div data-drag-hint aria-hidden="true" className="pointer-events-none fixed inset-0 z-[60] grid place-items-center">
      <svg viewBox="0 0 120 64" className="drag-hint w-28 overflow-visible">
        <path d="M14 32h22M14 32l7-6M14 32l7 6" className="drag-hint-arrow drag-hint-left" />
        <path d="M106 32H84M106 32l-7-6M106 32l-7 6" className="drag-hint-arrow drag-hint-right" />
        <g className="drag-hint-hand">
          <circle cx="60" cy="22" r="9" className="drag-hint-touch" />
          <path d="M56 22V8a4 4 0 0 1 8 0v18l8-3a4 4 0 0 1 4.6 6L68 44a8 8 0 0 1-7 4H54a8 8 0 0 1-8-8V30a4 4 0 0 1 8 0v4"
            className="drag-hint-finger" />
        </g>
      </svg>
    </div>
  );
}
