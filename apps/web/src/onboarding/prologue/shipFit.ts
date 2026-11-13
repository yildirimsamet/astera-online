/** The closest the claim camera may come. */
export const MIN_DISTANCE = 1.4;

/**
 * HOW FAR THE CAMERA STANDS SO THE TURNING HULL NEVER LEAVES THE SCREEN. A sphere round the hull is
 * the same from every side, so whatever way the hull has turned it stays inside both field angles
 * (play-test 2026-11-13: at 350 px the wide hull ran off the left edge). `wide` and `tall` are how far
 * the hull reaches from the point the camera turns about, sideways and up or down.
 */
export function fitDistance({ wide, tall, fov, aspect }: { wide: number; tall: number; fov: number; aspect: number }): number {
  const halfTall = (fov / 2) * (Math.PI / 180);
  const halfWide = Math.atan(Math.tan(halfTall) * aspect);
  return Math.max(MIN_DISTANCE, wide / Math.sin(halfWide), tall / Math.sin(halfTall));
}
