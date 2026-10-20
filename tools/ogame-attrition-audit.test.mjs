import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTrashSim } from './ogame-attrition-audit.mjs';

const source = process.env.TRASHSIM_SOURCE;

test('unmodified TrashSim engine is deterministic and conserves every ship', { skip: !source }, () => {
  const engine = createTrashSim(source);
  const a = { 204: 100, 206: 10 }, d = { 204: 70, 207: 5 };
  const first = engine.battle(a, d, 42);
  assert.equal(JSON.stringify(first), JSON.stringify(engine.battle(a, d, 42)));
  assert.ok(first.rounds >= 1 && first.rounds <= 6);
  for (const [side, fleet] of [['attackers', a], ['defenders', d]]) {
    for (const [id, n] of Object.entries(fleet)) {
      assert.equal((first.remaining[side][0][id] ?? 0) + (first.lost[side][0][id] ?? 0), n);
    }
  }
});

test('overwhelming battleship attack destroys one light fighter', { skip: !source }, () => {
  const engine = createTrashSim(source);
  const result = engine.battle({ 207: 100 }, { 204: 1 }, 42);
  assert.equal(result.lost.defenders[0][204], 1);
  assert.equal(result.remaining.attackers[0][207], 100);
});

test('zero-weapon probe mirrors remain a six-round draw', { skip: !source }, () => {
  const engine = createTrashSim(source);
  const result = engine.battle({ 210: 10 }, { 210: 10 }, 42);
  assert.equal(result.rounds, 6);
  assert.equal(result.result.draw, 1);
  assert.equal(result.remaining.attackers[0][210], 10);
  assert.equal(result.remaining.defenders[0][210], 10);
});

test('shield ablation is explicit and does not leak into a normal engine', { skip: !source }, () => {
  const normal = createTrashSim(source);
  const disabled = createTrashSim(source, { shields: false });
  assert.equal(normal.info[207].shield, 200);
  assert.equal(disabled.info[207].shield, 0);
  assert.equal(disabled.info[207].armour, normal.info[207].armour);
  assert.equal(disabled.info[207].weapon, normal.info[207].weapon);
  assert.equal(createTrashSim(source).info[207].shield, 200);
});
