import { describe, expect, it } from 'vitest';
import { jetParticle, type JetParticle } from '../src/galaxy/rocketJet.js';

const sample = (): JetParticle => ({ x: 0, y: 0, z: 0, width: 0, length: 0, age: 0, alpha: 0, frame: 0 });
describe('continuous gently bending rocket jet', () => {
  it.each([24, 64])('keeps the stream close to the motor axis with continuous coverage (%i samples)', count => {
    const p = sample();
    for (let time = 0; time < 2; time += 0.037) for (let i = 0; i < count; i++) {
      jetParticle(i, count, time, p);
      expect(Math.abs(p.x)).toBeLessThanOrEqual(.022);
      expect(Math.abs(p.y)).toBeLessThanOrEqual(.014);
      expect(p.z).toBeLessThanOrEqual(0);
      expect(p.z).toBeGreaterThanOrEqual(-1.15);
      expect(Math.hypot(p.x, p.y) + p.width / 2).toBeLessThan(0.13);
      expect(p.length).toBeGreaterThan(p.width);
      expect(p.alpha).toBeGreaterThanOrEqual(0);
      expect(p.alpha).toBeLessThanOrEqual(1);
      expect(p.frame).toBeGreaterThanOrEqual(0);
      expect(p.frame).toBeLessThan(9);
    }
  });
  it('adds a continuous mild tail ripple while keeping the motor mouth fixed', () => {
    const early = sample(), later = sample();
    jetParticle(7, 24, 0, early);
    jetParticle(7, 24, .01, later);
    expect(Math.hypot(early.x, early.y)).toBeGreaterThan(.0005);
    expect([later.x, later.y]).not.toEqual([early.x, early.y]);
    expect(Math.hypot(later.x - early.x, later.y - early.y)).toBeLessThan(.001);
    for (let time = 0; time < 3; time += .017) {
      jetParticle(0, 24, time, early);
      expect([early.x, early.y]).toEqual([0, 0]);
    }
  });
  it('bends both ways as one connected flame rather than scattering individual sparks', () => {
    const p = sample();
    const xs: number[] = [], ys: number[] = [];
    for (let time = 0; time < 4; time += .031) {
      const points: JetParticle[] = [];
      for (let i = 0; i < 24; i++) {
        jetParticle(i, 24, time, p);
        points.push({ ...p });
        if (p.age > .75) { xs.push(p.x); ys.push(p.y); }
      }
      points.sort((a, b) => a.age - b.age);
      for (let i = 1; i < points.length; i++) {
        const near = points[i - 1]!, far = points[i]!;
        expect(Math.hypot(far.x - near.x, far.y - near.y)).toBeLessThan(.012);
      }
    }
    expect(Math.max(...xs)).toBeGreaterThan(.012);
    expect(Math.min(...xs)).toBeLessThan(-.012);
    expect(Math.max(...ys)).toBeGreaterThan(.007);
    expect(Math.min(...ys)).toBeLessThan(-.007);
  });
  it('flows rearward while keeping a continuously lit nozzle and bounded brightness', () => {
    const p = sample(), later = sample();
    jetParticle(7, 24, 0, p);
    jetParticle(7, 24, .05, later);
    expect(later.z).toBeLessThan(p.z);
    for (const count of [24, 64]) {
      const energies: number[] = [];
      for (let time = 0; time < 3; time += .019) {
        jetParticle(0, count, time, p);
        expect(p.z).toBe(-.025);
        expect(p.alpha).toBeGreaterThan(.6);
        const particles: JetParticle[] = [];
        for (let i = 0; i < count; i++) {
          jetParticle(i, count, time, p);
          particles.push({ ...p });
        }
        particles.sort((a, b) => b.z - a.z);
        for (let i = 1; i < particles.length; i++) {
          const near = particles[i - 1]!, far = particles[i]!;
          expect(near.z - far.z).toBeLessThan((near.length + far.length) / 2);
        }
        energies.push(particles.reduce((sum, particle) => sum + particle.alpha, 0));
      }
      expect(Math.max(...energies) / Math.min(...energies)).toBeLessThan(1.1);
    }
  });
  it('is deterministic after tab suspension and reuses the caller-owned sample', () => {
    const first = sample(), second = sample();
    jetParticle(17, 24, 100, first);
    jetParticle(0, 64, 0, second);
    jetParticle(17, 24, 100, second);
    expect(first).toEqual(second);
  });
});
