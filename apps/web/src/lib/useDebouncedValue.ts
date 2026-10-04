import { useEffect, useState } from 'react';

/** Settle a burst of edits before pricing it. Consumers still compare with the live input before committing. */
export function useDebouncedValue<T>(value: T, delayMs = 200): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => { setSettled(value); }, delayMs);
    return () => { clearTimeout(timer); };
  }, [value, delayMs]);
  return settled;
}
