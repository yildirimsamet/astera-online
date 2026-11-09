import './pinchHint.css';

/**
 * COME CLOSER (owner playtest 2026-11-09). Two fingertips spread apart between two arrows, over the
 * rocks' side of the sky. It never takes a touch.
 */
export function PinchHint() {
  return (
    <div data-pinch-hint aria-hidden="true" className="pointer-events-none fixed inset-0 z-[60] grid place-items-center">
      <svg viewBox="0 0 120 120" className="pinch-hint w-28 overflow-visible">
        <path d="M86 34l14-14M100 20H89M100 20v11" className="pinch-hint-arrow" />
        <path d="M34 86L20 100M20 100h11M20 100V89" className="pinch-hint-arrow" />
        <circle cx="72" cy="48" r="11" className="pinch-hint-tip pinch-hint-up" />
        <circle cx="48" cy="72" r="11" className="pinch-hint-tip pinch-hint-down" />
      </svg>
    </div>
  );
}
