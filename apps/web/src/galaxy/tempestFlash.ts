/**
 * TEMPEST'S MAP FLASHES (owner, 2026-10-20). Round yellow or white flashes in quick bursts of
 * two to five — SSB, SBSBS, SBBS — then a random rest of one to three seconds. Each fleet owns
 * a clock seeded at a random phase, so no two formations flash in step. The shader only draws
 * the current sample; all timing lives here, a few comparisons per fleet per frame.
 */
export const TEMPEST_FLASH = {
  burst: [2, 5],
  restSeconds: [1, 3],
  flashSeconds: [.07, .12],
  spacingSeconds: [.03, .07],
  /** Outer, fully faded edge — CSS pixels across. */
  outerPx: [18, 26],
  /** The dense centre — CSS pixels across. */
  corePx: [4, 8],
} as const;

export interface TempestFlashSample {
  /** 0 at rest; a sharp rise and a fast fade inside each flash. */
  intensity: number;
  white: boolean;
  outerPx: number;
  corePx: number;
  /** Which motor of the formation carries this flash. */
  motor: number;
}

interface Flash { start: number; end: number; white: boolean; outerPx: number; corePx: number; motor: number }

const DARK: TempestFlashSample = { intensity: 0, white: false, outerPx: TEMPEST_FLASH.outerPx[0], corePx: TEMPEST_FLASH.corePx[0], motor: 0 };

export function createTempestFlashClock(random: () => number, startAt: number, motors: number) {
  const between = ([low, high]: readonly [number, number]): number => low + (high - low) * random();
  let flashes: Flash[] = [];
  // A random first rest is what puts fleets that appear together out of step.
  let nextBurst = startAt + random() * TEMPEST_FLASH.restSeconds[1];

  const plan = (at: number): void => {
    flashes = [];
    const count = TEMPEST_FLASH.burst[0] + Math.floor(random() * (TEMPEST_FLASH.burst[1] - TEMPEST_FLASH.burst[0] + 1));
    let start = at;
    for (let i = 0; i < count; i++) {
      const end = start + between(TEMPEST_FLASH.flashSeconds);
      flashes.push({ start, end, white: random() < .5, outerPx: between(TEMPEST_FLASH.outerPx),
        corePx: between(TEMPEST_FLASH.corePx), motor: Math.min(motors - 1, Math.floor(random() * Math.max(1, motors))) });
      start = end + between(TEMPEST_FLASH.spacingSeconds);
    }
    nextBurst = flashes.at(-1)!.end + between(TEMPEST_FLASH.restSeconds);
  };

  return {
    sample(time: number): TempestFlashSample {
      // A hidden tab or a stalled frame resumes with a fresh rest; missed bursts never replay.
      if (time > nextBurst + TEMPEST_FLASH.restSeconds[1]) {
        flashes = [];
        nextBurst = time + between(TEMPEST_FLASH.restSeconds);
      }
      if (time >= nextBurst) plan(nextBurst);
      const flash = flashes.find(row => time >= row.start && time < row.end);
      if (!flash) return DARK;
      const u = (time - flash.start) / (flash.end - flash.start);
      const intensity = Math.min(1, u / .15) * Math.pow(1 - u, 1.5) / Math.pow(.85, 1.5);
      return { intensity: Math.min(1, intensity), white: flash.white, outerPx: flash.outerPx, corePx: flash.corePx, motor: flash.motor };
    },
  };
}
