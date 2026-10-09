import { copyFileSync, rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { expect, it } from 'vitest';

it('never processes an incoming staging drop as a runtime model', () => {
  const file = `assets/source/models/new_skins/intake-test-${randomUUID()}.glb`;
  try {
    copyFileSync('assets/source/models/ships/skins/red-dragon/model.glb', file);
    const report = execFileSync('node', ['tools/models.mjs', '--inspect', '--only=new_skins/'], { encoding: 'utf8' });
    expect(report).not.toContain('tris');
  } finally { rmSync(file); }
});
