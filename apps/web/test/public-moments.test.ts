import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { LATE_REPLAY_MS, rememberStarts, replayStart, replayStarts, screenFloorScale, screenPixels } from '../src/galaxy/publicMoments.js';

/**
 * TWO RULES EVERY PUBLIC STRIKE EFFECT SHARES. Owner, 2026-10-16: a Death Star or radiation
 * bomb hit must be visible outside Telescope sight, and noticeable from a zoomed-out disc
 * "abartmadan" — so a late-discovered hit replays from its start, and a struck world's mark
 * never shrinks below a few pixels.
 */
describe('when a public hit starts on this screen', () => {
  it('keeps the real instant when it was known in time', () => {
    expect(replayStart(10_000, 9_000)).toBe(10_000);
    expect(replayStart(10_000, 10_200)).toBe(10_000);
  });

  it('starts at discovery when the news arrived a little late', () => {
    expect(replayStart(10_000, 11_500)).toBe(11_500);
    expect(replayStart(10_000, 10_000 + LATE_REPLAY_MS - 1)).toBe(10_000 + LATE_REPLAY_MS - 1);
  });

  it('keeps the real clock for news found long afterwards', () => {
    expect(replayStart(10_000, 10_000 + LATE_REPLAY_MS)).toBe(10_000);
  });
});

/**
 * A SALVO LEARNED IN ONE READ STILL LANDS AS A SALVO. Owner, 2026-10-16: *"Vurulmadan hedef'e
 * ulaşan füzelerin hepsi için ard ard'a olsa bile animasyon doğru düzgün oynatılıyor mu?"* The
 * worker wakes once a second, so hits half a second apart usually reach a screen in the same
 * refetch. Replayed one by one from discovery, every one of them started on the same frame and
 * the burst read as a single hit. A batch keeps its spacing: the earliest starts at discovery,
 * the rest follow it as they followed it in space.
 */
describe('when a burst of public hits starts on this screen', () => {
  it('keeps the spacing of hits discovered together, the earliest starting at discovery', () => {
    expect(replayStarts([10_000, 10_500, 11_000], 11_200)).toEqual([11_200, 11_700, 12_200]);
  });

  it('keeps their order when one of them was still on time', () => {
    expect(replayStarts([10_000, 11_100], 11_200)).toEqual([11_200, 12_300]);
  });

  it('leaves hits still to come and hits found long afterwards on their own clock', () => {
    expect(replayStarts([10_000, 13_000], 11_200)).toEqual([11_200, 13_000]);
    expect(replayStarts([1_000, 10_000], 11_200)).toEqual([1_000, 11_200]);
  });

  it('is the single-hit rule for a batch of one', () => {
    for (const seenAt of [9_000, 10_200, 11_500, 10_000 + LATE_REPLAY_MS]) {
      expect(replayStarts([10_000], seenAt)).toEqual([replayStart(10_000, seenAt)]);
    }
  });

  it('remembers each start once, batches only what is new, and forgets what has gone', () => {
    const starts = new Map<string, number>();
    rememberStarts(starts, [{ id: 'a', at: 10_000 }, { id: 'b', at: 10_500 }], 11_200);
    expect([...starts]).toEqual([['a', 11_200], ['b', 11_700]]);
    rememberStarts(starts, [{ id: 'b', at: 10_500 }, { id: 'c', at: 12_000 }], 12_100);
    expect([...starts]).toEqual([['b', 11_700], ['c', 12_000]]);
  });
});

describe('how small a struck world’s mark may become', () => {
  const camera = new PerspectiveCamera(45, 1, 0.1, 5000);
  camera.position.set(0, 0, 100);
  camera.updateProjectionMatrix();
  const at = new Vector3(0, 0, 0);
  const pixelsOf = (worldSize: number, scale: number) =>
    worldSize * scale * 800 * camera.projectionMatrix.elements[5] / (2 * 100);

  it('leaves a mark that is already large enough alone', () => {
    expect(screenFloorScale(20, at, camera, 800, 6)).toBe(1);
  });

  it('measures a world-sized mark in screen pixels', () => {
    expect(screenPixels(0.4, at, camera, 800)).toBeCloseTo(pixelsOf(0.4, 1), 6);
  });

  it('grows a mark seen from far away to the pixel floor, and no further', () => {
    const scale = screenFloorScale(0.4, at, camera, 800, 6);
    expect(scale).toBeGreaterThan(1);
    expect(pixelsOf(0.4, scale)).toBeCloseTo(6, 6);
  });
});
