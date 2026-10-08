import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Worlds are opaque (owner, 2026-10-08): a craft, a mark or a satellite glow behind
// a nearer planet must lose to that planet's depth instead of drawing through it.
const read = (file: string) => readFileSync(`src/galaxy/${file}`, 'utf8');

describe('nothing draws through a world', () => {
  it('draws craft against the worlds already on screen instead of clearing their depth', () => {
    expect(read('Fleets.tsx')).not.toMatch(/\.clearDepth\(/);
  });
  it.each(['Fleets.tsx', 'Satellites.tsx', 'IntergalacticConvoy.tsx'])('%s never switches depth testing off', (file) => {
    expect(read(file)).not.toMatch(/depthTest(:\s*|=\{)(false|!)/);
  });
  it('lets squadron pips and rank badges lead their own hulls by one hull, never past half the camera range', () => {
    const source = read('Fleets.tsx');
    // Depth-tested marks above and below a hull would vanish behind it from a
    // steep camera; the lead keeps them over their own squadron, not over a world.
    expect(source.match(/attribute float aLead;/g)).toHaveLength(2);
    expect(source.match(/\$\{MARK_LEAD_DEPTH\}/g)).toHaveLength(2);
    expect(source).toContain('min(mv.z + aLead, mv.z * 0.5)');
    expect(source.match(/setAttribute\('aLead'/g)).toHaveLength(2);
  });
  it('hides a raid volley fired from behind the world it strikes, and only when a world is struck', () => {
    expect(read('Bombardment.tsx')).toMatch(/strikesWorld && behindTarget\(/);
    // Own raid, sensed raid and concealed raid strike worlds; pirate, return and convoy fire do not.
    expect(read('Fleets.tsx').match(/strikesWorld=/g)).toHaveLength(3);
  });
});
