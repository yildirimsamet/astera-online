export type AcademyVisualFixture = (path: string, payload: unknown) => unknown;

declare global {
  interface Window {
    /** Development-only bridge installed by the read-only visual harness. */
    __asteraAcademyVisualFixture?: AcademyVisualFixture;
  }
}

/** Production ignores the browser hook even if a page tries to define it. */
export function applyAcademyVisualFixture<T>(
  path: string,
  payload: T,
  enabled: boolean,
): T {
  if (!enabled) return payload;
  const fixture = window.__asteraAcademyVisualFixture;
  if (!fixture) return payload;
  return (fixture(path, payload) ?? payload) as T;
}
