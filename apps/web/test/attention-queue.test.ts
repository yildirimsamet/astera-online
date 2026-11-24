import { describe, expect, it } from 'vitest';
import { attentionQuiet, emptyAttention, reduceAttention, type AttentionEvent, type AttentionState } from '../src/shell/attention/queue.js';

const card = { priority: 100, blocking: true } as const;
const rewards = { priority: 90, blocking: true } as const;
const quiz = { priority: 50, blocking: true } as const;
const tip = { priority: 30, blocking: false } as const;
const install = { priority: 20, blocking: false } as const;

const settle: AttentionEvent = { kind: 'settle' };
/** Requests made in one moment are weighed together: the store settles after the moment, as here. */
const run = (...events: AttentionEvent[]): AttentionState => [...events, settle].reduce(reduceAttention, emptyAttention());
const shown = (state: AttentionState): string[] => [...state.shown].sort();

describe('the attention queue (plan 2026-11-20 §5.5)', () => {
  it('shows one blocking surface at a time, the most important first', () => {
    const state = run(
      { kind: 'want', id: 'brand_quiz', spec: quiz, at: 1 },
      { kind: 'want', id: 'landing_rewards', spec: rewards, at: 2 },
      { kind: 'want', id: 'arrival_card', spec: card, at: 3 },
    );
    expect(shown(state)).toEqual(['arrival_card']);
  });

  it('keeps a surface it has shown even when a more important one asks later', () => {
    const state = run({ kind: 'want', id: 'brand_quiz', spec: quiz, at: 1 }, settle, { kind: 'want', id: 'arrival_card', spec: card, at: 2 });
    expect(shown(state)).toEqual(['brand_quiz']);
  });

  it('takes equal priorities in the order they asked', () => {
    const state = run({ kind: 'want', id: 'b', spec: quiz, at: 2 }, { kind: 'want', id: 'a', spec: quiz, at: 5 });
    expect(shown(state)).toEqual(['b']);
  });

  it('waits for the player\'s own hand after a blocking surface is closed, before the next one', () => {
    let state = run({ kind: 'want', id: 'arrival_card', spec: card, at: 1 }, { kind: 'want', id: 'landing_rewards', spec: rewards, at: 2 });
    state = reduceAttention(state, { kind: 'release', id: 'arrival_card' });
    expect(shown(state)).toEqual([]);
    expect(state.awaitingAction).toBe(true);
    state = reduceAttention(state, { kind: 'interact' });
    expect(shown(state)).toEqual(['landing_rewards']);
  });

  it('does not make the next surface wait when one simply goes away by itself', () => {
    let state = run({ kind: 'want', id: 'arrival_card', spec: card, at: 1 }, { kind: 'want', id: 'landing_rewards', spec: rewards, at: 2 });
    state = reduceAttention(state, { kind: 'drop', id: 'arrival_card' });
    expect(shown(state)).toEqual(['landing_rewards']);
  });

  it('opens nothing new while the player has a page of their own open or a lesson speaks, and keeps what is open', () => {
    let state = run({ kind: 'want', id: 'brand_quiz', spec: quiz, at: 1 }, settle, { kind: 'busy', id: 'shell', busy: true });
    state = [{ kind: 'want', id: 'landing_tip', spec: tip, at: 2 } as const, settle].reduce(reduceAttention, state);
    expect(shown(state)).toEqual(['brand_quiz']);
    state = reduceAttention(state, { kind: 'drop', id: 'brand_quiz' });
    expect(shown(state)).toEqual([]);
    state = reduceAttention(state, { kind: 'busy', id: 'shell', busy: false });
    expect(shown(state)).toEqual(['landing_tip']);
  });

  it('stays busy while any one holder is busy: one page closing does not free the screen under another', () => {
    let state = run({ kind: 'busy', id: 'shell', busy: true }, { kind: 'busy', id: 'galaxy', busy: true }, { kind: 'want', id: 'brand_quiz', spec: quiz, at: 1 });
    state = [{ kind: 'busy', id: 'shell', busy: false } as const, settle].reduce(reduceAttention, state);
    expect(shown(state)).toEqual([]);
    state = reduceAttention(state, { kind: 'busy', id: 'galaxy', busy: false });
    expect(shown(state)).toEqual(['brand_quiz']);
  });

  it('never lays a light surface over a blocking one, and shows one light surface at a time', () => {
    let state = run({ kind: 'want', id: 'landing_tip', spec: tip, at: 1 }, { kind: 'want', id: 'return_card', spec: install, at: 2 });
    expect(shown(state)).toEqual(['landing_tip']);
    state = [{ kind: 'want', id: 'brand_quiz', spec: quiz, at: 3 } as const, settle].reduce(reduceAttention, state);
    expect(shown(state)).toEqual(['brand_quiz', 'landing_tip']);
    state = run({ kind: 'want', id: 'brand_quiz', spec: quiz, at: 1 }, { kind: 'want', id: 'landing_tip', spec: tip, at: 2 });
    expect(shown(state)).toEqual(['brand_quiz']);
  });

  it('lets only the scenario\'s own surfaces through a lock, and the rest after it lifts', () => {
    let state = run({ kind: 'lock', allow: ['scenario_step'] }, { kind: 'want', id: 'brand_quiz', spec: quiz, at: 1 },
      { kind: 'want', id: 'scenario_step', spec: { priority: 10, blocking: true }, at: 2 });
    expect(shown(state)).toEqual(['scenario_step']);
    state = reduceAttention(state, { kind: 'drop', id: 'scenario_step' });
    expect(shown(state)).toEqual([]);
    state = reduceAttention(state, { kind: 'lock', allow: null });
    expect(shown(state)).toEqual(['brand_quiz']);
  });

  it('forgets a surface that no longer wants the screen before its turn came', () => {
    let state = run({ kind: 'want', id: 'arrival_card', spec: card, at: 1 }, { kind: 'want', id: 'brand_quiz', spec: quiz, at: 2 });
    state = reduceAttention(state, { kind: 'drop', id: 'brand_quiz' });
    state = reduceAttention(state, { kind: 'release', id: 'arrival_card' });
    state = reduceAttention(state, { kind: 'interact' });
    expect(shown(state)).toEqual([]);
    expect(state.wanted.size).toBe(0);
  });

  it('is quiet while a blocking surface is open or a lock holds, so news does not land on top', () => {
    expect(attentionQuiet(run())).toBe(false);
    expect(attentionQuiet(run({ kind: 'want', id: 'landing_tip', spec: tip, at: 1 }))).toBe(false);
    expect(attentionQuiet(run({ kind: 'want', id: 'arrival_card', spec: card, at: 1 }))).toBe(true);
    expect(attentionQuiet(run({ kind: 'lock', allow: [] }))).toBe(true);
  });

  it('weighs requests made in the same moment together, so the order components mount in does not decide', () => {
    const state = [{ kind: 'want', id: 'brand_quiz', spec: quiz, at: 1 } as const, { kind: 'want', id: 'arrival_card', spec: card, at: 1 } as const]
      .reduce(reduceAttention, emptyAttention());
    expect(shown(state)).toEqual([]);
    expect(shown(reduceAttention(state, settle))).toEqual(['arrival_card']);
  });

  it('treats a repeated want as the same request, not a second one', () => {
    const state = run({ kind: 'want', id: 'brand_quiz', spec: quiz, at: 1 }, { kind: 'want', id: 'brand_quiz', spec: quiz, at: 9 });
    expect(state.wanted.get('brand_quiz')?.since).toBe(1);
  });
});
