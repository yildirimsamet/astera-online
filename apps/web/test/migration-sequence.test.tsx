import { describe, expect, it } from 'vitest';
import { BEATS, SCENE_SECONDS, beatAt, fromTheLanding, sceneStart } from '../src/starter/jump.js';

describe('the jump as a scene', () => {
  it('lasts about 25 seconds, beat after beat with no gap', () => {
    expect(SCENE_SECONDS).toBe(25);
    expect(BEATS[0]!.from).toBe(0);
    for (let i = 1; i < BEATS.length; i++) expect(BEATS[i]!.from).toBe(BEATS[i - 1]!.to);
    expect(BEATS.at(-1)!.to).toBe(SCENE_SECONDS);
  });

  it('knows which beat a moment falls in', () => {
    expect(beatAt(0).id).toBe('lit');
    expect(beatAt(6).id).toBe('leaving');
    expect(beatAt(12).id).toBe('gap');
    expect(beatAt(19).id).toBe('fall');
    expect(beatAt(24).id).toBe('world');
    expect(beatAt(99).id).toBe('world');
  });

  it('plays whole for the one who pressed', () => {
    expect(sceneStart('pressed')).toBe(0);
  });

  it('shows only the last part to one whose scene was cut: they are already on their planet', () => {
    expect(sceneStart('cut')).toBe(fromTheLanding);
    expect(fromTheLanding).toBe(BEATS.find(beat => beat.id === 'fall')!.from);
  });
});
