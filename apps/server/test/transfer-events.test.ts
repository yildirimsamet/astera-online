import { describe, expect, it } from 'vitest';
import { eventKind } from '../src/db/schema.js';
import { TRANSFER_EVENT_POLICIES, transferEventDisposition } from '../src/services/transferReferences.js';

describe('transfer event classification', () => {
  it('requires an explicit policy for every persisted event kind', () => {
    expect(Object.keys(TRANSFER_EVENT_POLICIES).sort()).toEqual([...eventKind.enumValues].sort());
  });
  it.each(['build_complete', 'research_complete', 'death_star_ready'])('moves only a future pending owned %s', (kind) => {
    expect(transferEventDisposition(kind, 'pending', 101, 100)).toBe('MOVE');
    expect(transferEventDisposition(kind, 'pending', 100, 100)).toBe('DEFER');
    expect(transferEventDisposition(kind, 'processing', 101, 100)).toBe('DEFER');
    expect(transferEventDisposition(kind, 'failed', 101, 100)).toBe('DEFER');
    expect(transferEventDisposition(kind, 'done', 101, 100)).toBe('KEEP');
  });
  it.each(['mission_arrival', 'pirate_return', 'trade_return', 'recovery_end', 'occupation_end', 'asteroid_impact'])('defers unresolved %s', (kind) => {
    expect(transferEventDisposition(kind, 'pending', 101, 100)).toBe('DEFER');
    expect(transferEventDisposition(kind, 'done', 99, 100)).toBe('KEEP');
  });
  it.each(['season_end', 'season_rollover', 'season_act', 'galaxy_event_start', 'galaxy_event_end'])('keeps galaxy-global %s in its source', (kind) => {
    expect(transferEventDisposition(kind, 'pending', 101, 100)).toBe('KEEP');
  });
  it('defers unknown active kinds and requires neutral-world ownership reconciliation', () => {
    expect(transferEventDisposition('future_kind', 'pending', 101, 100)).toBe('DEFER');
    expect(transferEventDisposition('neutral_reinforce', 'pending', 101, 100)).toBe('RECONCILE');
    expect(transferEventDisposition('neutral_reinforce', 'processing', 101, 100)).toBe('DEFER');
  });
});
