import { useEffect, useRef } from 'react';

/**
 * A REQUEST FROM OUTSIDE, AS A COUNTER.
 *
 * The shell asks the galaxy for something — fly home, open the Worlds sheet — by
 * bumping a number, and the galaxy answers each new value exactly once. The value
 * it mounts with is not a request (D56): the rig already frames the opening, and
 * answering it would fight that. The handler is read at the moment of answering,
 * so a caller never has to memoise it.
 */
export function useRequest(request: number | undefined, onRequest: () => void): void {
  const seen = useRef(request);
  const handler = useRef(onRequest);
  handler.current = onRequest;

  useEffect(() => {
    if (request === undefined || request === seen.current) return;
    seen.current = request;
    handler.current();
  }, [request]);
}
