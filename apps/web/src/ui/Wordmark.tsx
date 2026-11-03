import { LOGO } from './assets.js';

/** The square app artwork, shared by the front door and installed applications. */
export function Wordmark({ width, className }: { width: number; className?: string }) {
  return (
    <img
      src={LOGO.lockup}
      alt="Astera Online"
      width={width}
      height={width}
      draggable={false}
      className={`h-auto max-w-full select-none ${className ?? ''}`}
    />
  );
}
