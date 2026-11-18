import { WELCOME_WEEK } from '@astera/rules';
import { describe, expect, it } from 'vitest';
import { welcomeBoard } from '../src/screens/welcomeBoard.js';

/**
 * NEW COMMANDER 7 DAYS AS ONE BOARD (owner 2026-11-18: "7 günlük ödül tablosu"). Every box has its place:
 * the opened ones, the one to open now or its wait, and the ones still ahead with what they will hold at
 * today's output, so the week reads at a glance and the seventh stands out.
 */
const NOW = Date.UTC(2026, 10, 18, 12);
const HOUR = 3_600_000;
const state = (over: Partial<{ opened: number; box: number | null; readyAt: Date | null; preview: { alloy: number; crystal: number } | null }> = {}) => ({
  opened: 2, box: 3, readyAt: new Date(NOW - 1000), preview: { alloy: 160, crystal: 240 }, ...over,
});

describe('the welcome board', () => {
  it('is not there without a week', () => {
    expect(welcomeBoard(null, NOW)).toBeNull();
    expect(welcomeBoard(undefined, NOW)).toBeNull();
  });

  it('has a place for each of the seven boxes, the seventh the big one', () => {
    const board = welcomeBoard(state(), NOW)!;
    expect(board.map(cell => cell.box)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(board.length).toBe(WELCOME_WEEK.boxes);
    expect(board.filter(cell => cell.big).map(cell => cell.box)).toEqual([7]);
  });

  it('marks the opened boxes, the ready one with its contents, and the ones ahead', () => {
    const board = welcomeBoard(state(), NOW)!;
    expect(board.map(cell => cell.state)).toEqual(['opened', 'opened', 'ready', 'later', 'later', 'later', 'later']);
    expect(board[2]!.holds).toEqual({ alloy: 160, crystal: 240 });
    // What an opened box gave is not kept: it shows as opened, without a number to misread.
    expect(board[0]!.holds).toBeNull();
  });

  it('gives the next box its wait while it is not ready', () => {
    const board = welcomeBoard(state({ readyAt: new Date(NOW + 5 * HOUR) }), NOW)!;
    expect(board[2]).toMatchObject({ state: 'waiting', readyInMs: 5 * HOUR });
    expect(board[3]!.readyInMs).toBeNull();
  });

  it('shows the boxes ahead at today\'s output: one hour each, the seventh three', () => {
    const board = welcomeBoard(state(), NOW)!;
    expect(board[4]!.holds).toEqual({ alloy: 160, crystal: 240 });
    const seventh = board[6]!.holds!;
    expect(seventh.alloy + seventh.crystal).toBe(3 * 400);
    expect(seventh.crystal).toBe(Math.round(1200 * WELCOME_WEEK.crystalShare));
  });

  it('reads a first box and a last box the same way', () => {
    const first = welcomeBoard(state({ opened: 0, box: 1 }), NOW)!;
    expect(first.map(cell => cell.state)).toEqual(['ready', 'later', 'later', 'later', 'later', 'later', 'later']);
    const last = welcomeBoard(state({ opened: 6, box: 7, preview: { alloy: 480, crystal: 720 } }), NOW)!;
    expect(last[6]).toMatchObject({ state: 'ready', holds: { alloy: 480, crystal: 720 } });
    const done = welcomeBoard(state({ opened: 7, box: null, readyAt: null, preview: null }), NOW)!;
    expect(done.every(cell => cell.state === 'opened')).toBe(true);
  });
});
