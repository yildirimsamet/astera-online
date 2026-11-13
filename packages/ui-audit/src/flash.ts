/**
 * WCAG 2.3.1 THREE FLASHES OR BELOW THRESHOLD.
 *
 * A flash is a pair of opposing changes in relative luminance of 10 % or more where the
 * darker image is below 0.80; a red flash is a pair of opposing changes in saturated red.
 * Content fails when more than three of either fall in one second AND the flashing area
 * is larger than 0.006 sr (a quarter of a 10° field).
 *
 * Frames arrive as a grid of averaged cells. Each cell keeps the extreme it has reached
 * since its last transition, so a fade spread over many frames is one change rather than
 * none, and a cell transitions when it swings back by the threshold. The view transitions
 * when the cells that swung the same way since its last transition cover the area
 * threshold, so a flash that grows in over a few frames (an explosion, a bloom) counts like
 * one that appears at once. The phone's 10° field is about the width of the screen, so all
 * of it is summed: conservative.
 */

export interface FlashFrame {
  /** Seconds. */
  time: number;
  /** sRGB 0–255 averages, three numbers per cell. */
  cells: ArrayLike<number>;
}

export interface FlashOptions {
  /** CSS px² one cell covers. */
  cellArea: number;
  /** CSS px² of same-direction swing that makes a frame a transition. */
  areaThreshold: number;
}

export interface FlashReport {
  generalPerSecond: number;
  redPerSecond: number;
  fails: boolean;
  /** Start of the worst one-second window, or null when nothing flashed. */
  worstAt: number | null;
}

/** 0.006 sr at the viewing distance, in CSS px². */
export function flashAreaThreshold({ viewingDistanceMm, mmPerCssPx }: { viewingDistanceMm: number; mmPerCssPx: number }): number {
  return (0.006 * viewingDistanceMm ** 2) / mmPerCssPx ** 2;
}

const linear = (channel: number): number => {
  const s = channel / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

const encode = (light: number): number => 255 * (light <= 0.0031308 ? light * 12.92 : 1.055 * light ** (1 / 2.4) - 0.055);

/**
 * A screenshot as `cols × rows` cells, row by row, three sRGB numbers per cell. Light is
 * averaged, not sRGB numbers, so a cell half lit reads as half its light.
 */
export function gridCells({ width, height, channels, data }: { width: number; height: number; channels: 3 | 4; data: ArrayLike<number> }, cols: number, rows: number): Float64Array {
  const cells = new Float64Array(cols * rows * 3);
  for (let row = 0; row < rows; row += 1) {
    const y0 = Math.floor((row * height) / rows);
    const y1 = Math.floor(((row + 1) * height) / rows);
    for (let col = 0; col < cols; col += 1) {
      const x0 = Math.floor((col * width) / cols);
      const x1 = Math.floor(((col + 1) * width) / cols);
      const sum = [0, 0, 0];
      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          const at = (y * width + x) * channels;
          for (let k = 0; k < 3; k += 1) sum[k] = (sum[k] ?? 0) + linear(data[at + k] ?? 0);
        }
      }
      const count = Math.max(1, (x1 - x0) * (y1 - y0));
      for (let k = 0; k < 3; k += 1) cells[(row * cols + col) * 3 + k] = encode((sum[k] ?? 0) / count);
    }
  }
  return cells;
}

const luminance = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** WCAG's saturated-red measure: (R − G − B) × 320 where R/(R+G+B) ≥ 0.8, else 0. */
const redness = (r: number, g: number, b: number) => {
  const sum = r + g + b;
  return sum > 0 && r / sum >= 0.8 ? Math.max(0, (r - g - b) * 320) : 0;
};

/** One cell's swings in one measure. */
class Swing {
  private dir: -1 | 0 | 1 = 0;
  private hi: number;
  private lo: number;

  constructor(value: number) {
    this.hi = value;
    this.lo = value;
  }

  step(value: number, threshold: number, darkerCounts: (darker: number) => boolean): -1 | 0 | 1 {
    if (this.dir !== 1 && value - this.lo >= threshold && darkerCounts(this.lo)) return this.turn(1, value);
    if (this.dir !== -1 && this.hi - value >= threshold && darkerCounts(value)) return this.turn(-1, value);
    if (this.dir !== -1) this.hi = Math.max(this.hi, value);
    if (this.dir !== 1) this.lo = Math.min(this.lo, value);
    return 0;
  }

  private turn(dir: -1 | 1, value: number): -1 | 1 {
    this.dir = dir;
    this.hi = value;
    this.lo = value;
    return dir;
  }
}

interface Transition {
  time: number;
  dir: -1 | 1;
}

/**
 * The area that has swung each way since the whole view last transitioned. Each cell counts once, by
 * the way it last swung: a small patch flickering on and off moves its area between the two sides,
 * never piles it up into a large one.
 */
class Sweep {
  private readonly dirs: (-1 | 1 | undefined)[] = [];
  private up = 0;
  private down = 0;
  private last: -1 | 0 | 1 = 0;

  add(cell: number, dir: -1 | 0 | 1, area: number): void {
    const before = this.dirs[cell];
    if (dir === 0 || before === dir) return;
    if (before === 1) this.up -= area;
    if (before === -1) this.down -= area;
    this.dirs[cell] = dir;
    if (dir === 1) this.up += area;
    else this.down += area;
  }

  /** At a frame's end: a transition once one way's area reaches the threshold, then every cell starts again. */
  settle(time: number, threshold: number, into: Transition[]): void {
    const up = this.up >= threshold && this.last !== 1;
    const down = this.down >= threshold && this.last !== -1;
    if (!up && !down) return;
    if (up && down) {
      into.push({ time, dir: 1 }, { time, dir: -1 });
      this.last = -1;
    } else {
      const dir = up ? 1 : -1;
      into.push({ time, dir });
      this.last = dir;
    }
    this.dirs.length = 0;
    this.up = 0;
    this.down = 0;
  }
}

/** Most flashes (pairs of opposing transitions) in any one-second window. */
function peak(transitions: readonly Transition[]): { flashes: number; at: number | null } {
  let flashes = 0;
  let at: number | null = null;
  transitions.forEach((first, i) => {
    let changes = 0;
    let last = 0;
    for (let j = i; j < transitions.length; j += 1) {
      const t = transitions[j];
      if (!t || t.time >= first.time + 1) break;
      if (t.dir !== last) {
        changes += 1;
        last = t.dir;
      }
    }
    if (Math.floor(changes / 2) > flashes) {
      flashes = Math.floor(changes / 2);
      at = first.time;
    }
  });
  return { flashes, at };
}

const GENERAL = 0.1;
const DARKER_BELOW = 0.8;
const RED = 20;

export function flashReport(frames: readonly FlashFrame[], { cellArea, areaThreshold }: FlashOptions): FlashReport {
  const general: Transition[] = [];
  const red: Transition[] = [];
  const swings: { general: Swing; red: Swing }[] = [];
  const sweep = { general: new Sweep(), red: new Sweep() };

  for (const { time, cells } of frames) {
    for (let c = 0; c * 3 + 2 < cells.length; c += 1) {
      const r = linear(cells[c * 3] ?? 0);
      const g = linear(cells[c * 3 + 1] ?? 0);
      const b = linear(cells[c * 3 + 2] ?? 0);
      const lum = luminance(r, g, b);
      const rr = redness(r, g, b);
      const swing = swings[c];
      if (!swing) {
        swings[c] = { general: new Swing(lum), red: new Swing(rr) };
        continue;
      }
      sweep.general.add(c, swing.general.step(lum, GENERAL, (darker) => darker < DARKER_BELOW), cellArea);
      sweep.red.add(c, swing.red.step(rr, RED, () => true), cellArea);
    }
    sweep.general.settle(time, areaThreshold, general);
    sweep.red.settle(time, areaThreshold, red);
  }

  const g = peak(general);
  const r = peak(red);
  return {
    generalPerSecond: g.flashes,
    redPerSecond: r.flashes,
    fails: g.flashes > 3 || r.flashes > 3,
    worstAt: g.flashes >= r.flashes ? g.at : r.at,
  };
}

export interface FlashResult {
  id: string;
  what: string;
  seconds: number;
  report: FlashReport | null;
  error: string | null;
}

const tr = (n: number) => n.toLocaleString('tr-TR');

/** Plan §1.5: one verdict per moment, the assumptions written beside them. */
export function renderFlash(results: readonly FlashResult[], { date, areaThreshold, fps, notFilmed }: {
  date: string; areaThreshold: number; fps: number; notFilmed: readonly { id: string; why: string; when: string }[];
}): string {
  const rows = results.map(({ id, what, seconds, report, error }) => {
    if (!report) return `| \`${id}\` | ${what} | ${tr(seconds)} sn | — | — | — | Ölçülemedi: ${error ?? 'bilinmiyor'} |`;
    const worst = report.worstAt === null ? '—' : `${tr(Math.round(report.worstAt * 100) / 100)} sn`;
    return `| \`${id}\` | ${what} | ${tr(seconds)} sn | ${String(report.generalPerSecond)} | ${String(report.redPerSecond)} | ${worst} | ${report.fails ? '**Kaldı**' : 'Geçti'} |`;
  });
  return [
    `# Flaş güvenliği — ${date}`,
    '',
    `WCAG 2.3.1: bir saniyede 3'ten fazla genel veya kırmızı flaş, 10°'lik görüş alanının %25'ini aşan bir alanda olursa kalır. Telefon 33 cm uzakta, 0,17 mm/CSS px varsayıldı; eşik alan ${tr(Math.round(areaThreshold))} CSS px². Kareler ${String(fps)} fps, sayfa saati tutularak çekildi (\`flashFilm.ts\`).`,
    '',
    '| An | Ne | Süre | Genel flaş/sn | Kırmızı flaş/sn | En kötü saniye | Sonuç |',
    '|---|---|---|---|---|---|---|',
    ...rows,
    '',
    '## Kaydedilmeyenler',
    '',
    ...(notFilmed.length === 0 ? ['Yok.'] : notFilmed.map(({ id, why, when }) => `- \`${id}\`: ${why}. Bakılacağı yer: ${when}.`)),
    '',
  ].join('\n');
}
