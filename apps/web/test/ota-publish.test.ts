// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { access, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const script = resolve(import.meta.dirname, '../../../deploy/publish-ota.sh');
const OLD = 'a'.repeat(40);
const NEW = 'b'.repeat(40);
const roots: string[] = [];

afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });

const latest = (version: string) => JSON.stringify({ version, minShell: 1, manifest: `/ota/${version}/manifest.json` });
const manifest = (version: string, hash: string) => JSON.stringify({ version, files: [
  { file_name: 'index.html', file_hash: hash, download_url: `https://asteraonline.space/ota/files/${hash}.html`, size: 3 },
] });

async function fixture(): Promise<{ stage: string; live: string }> {
  const root = await mkdtemp(join(tmpdir(), 'astera-ota-publish-'));
  roots.push(root);
  const stage = join(root, 'stage');
  const live = join(root, 'live');
  await mkdir(join(stage, 'files'), { recursive: true });
  await mkdir(join(stage, NEW), { recursive: true });
  await writeFile(join(stage, 'files', `${'2'.repeat(64)}.html`), 'new');
  await writeFile(join(stage, NEW, 'manifest.json'), manifest(NEW, '2'.repeat(64)));
  await writeFile(join(stage, 'latest.json'), latest(NEW));
  await mkdir(join(live, 'files'), { recursive: true });
  await mkdir(join(live, OLD), { recursive: true });
  await writeFile(join(live, 'files', `${'1'.repeat(64)}.html`), 'old');
  await writeFile(join(live, OLD, 'manifest.json'), manifest(OLD, '1'.repeat(64)));
  await writeFile(join(live, 'latest.json'), latest(OLD));
  return { stage, live };
}

const run = (...args: string[]) => spawnSync('bash', [script, ...args], { encoding: 'utf8' });

/** OTA F2: a phone reads `latest.json` first, so it changes last and only when everything it names is in place. */
describe('publishing an OTA release', () => {
  it('lands the files and the manifest, then points latest at them, keeping the previous release servable', async () => {
    const { stage, live } = await fixture();
    const result = run(stage, live);
    expect(result.status, result.stderr).toBe(0);
    expect(await readFile(join(live, 'latest.json'), 'utf8')).toBe(latest(NEW));
    expect(await readFile(join(live, 'files', `${'2'.repeat(64)}.html`), 'utf8')).toBe('new');
    expect(await readFile(join(live, NEW, 'manifest.json'), 'utf8')).toBe(manifest(NEW, '2'.repeat(64)));
    // A phone midway through the old release still finds every file it names.
    expect(await readFile(join(live, 'files', `${'1'.repeat(64)}.html`), 'utf8')).toBe('old');
    expect(await readFile(join(live, OLD, 'manifest.json'), 'utf8')).toBe(manifest(OLD, '1'.repeat(64)));
    expect(await readFile(join(live, 'latest.previous.json'), 'utf8')).toBe(latest(OLD));
  });

  it.each([
    ['its manifest is missing', (stage: string) => rm(join(stage, NEW, 'manifest.json'))],
    ['a file its manifest names is missing', (stage: string) => rm(join(stage, 'files', `${'2'.repeat(64)}.html`))],
    ['latest is missing', (stage: string) => rm(join(stage, 'latest.json'))],
  ])('leaves latest alone when %s', async (_case, damage) => {
    const { stage, live } = await fixture();
    await damage(stage);
    const result = run(stage, live);
    expect(result.status).not.toBe(0);
    expect(await readFile(join(live, 'latest.json'), 'utf8')).toBe(latest(OLD));
  });

  it('keeps the real previous release when the same deploy runs twice', async () => {
    const { stage, live } = await fixture();
    expect(run(stage, live).status).toBe(0);
    expect(run(stage, live).status).toBe(0);
    expect(await readFile(join(live, 'latest.previous.json'), 'utf8')).toBe(latest(OLD));
  });

  it('puts the previous release back in one step (EN-07)', async () => {
    const { stage, live } = await fixture();
    expect(run(stage, live).status).toBe(0);
    const result = run('--restore-previous', live);
    expect(result.status, result.stderr).toBe(0);
    expect(await readFile(join(live, 'latest.json'), 'utf8')).toBe(latest(OLD));
  });

  it('refuses to restore when there is no previous release', async () => {
    const { live } = await fixture();
    expect(run('--restore-previous', live).status).not.toBe(0);
    expect(await readFile(join(live, 'latest.json'), 'utf8')).toBe(latest(OLD));
  });
});

/** OTA F4: old releases leave the VPS; the last five, the live one and the one a rollback needs stay whole. */
describe('pruning old OTA releases', () => {
  const exists = (path: string) => access(path).then(() => true, () => false);
  async function stageRelease(root: string, version: string, hashes: string[]): Promise<string> {
    const stage = join(root, `stage-${version.slice(0, 1)}`);
    await mkdir(join(stage, 'files'), { recursive: true });
    await mkdir(join(stage, version), { recursive: true });
    for (const hash of hashes) await writeFile(join(stage, 'files', `${hash}.js`), version);
    await writeFile(join(stage, version, 'manifest.json'), JSON.stringify({ version, files: hashes.map(hash => (
      { file_name: `${hash}.js`, file_hash: hash, download_url: `https://asteraonline.space/ota/files/${hash}.js`, size: 3 })) }));
    await writeFile(join(stage, 'latest.json'), latest(version));
    return stage;
  }

  it('keeps the last five releases and every file they name, and removes the rest with their compressed copies', async () => {
    const root = await mkdtemp(join(tmpdir(), 'astera-ota-prune-'));
    roots.push(root);
    const live = join(root, 'live');
    const shared = 'f'.repeat(64);
    const versions = ['1', '2', '3', '4', '5', '6', '7'].map(digit => digit.repeat(40));
    for (const version of versions) {
      const own = version.slice(0, 1).repeat(64);
      const stage = await stageRelease(root, version, [own, shared]);
      await writeFile(join(stage, 'files', `${own}.js.gz`), 'gz');
      const result = run(stage, live);
      expect(result.status, result.stderr).toBe(0);
    }
    const releases = (await readdir(live)).filter(name => /^[a-f0-9]{40}$/u.test(name)).sort();
    expect(releases).toEqual(versions.slice(2));
    expect(await exists(join(live, 'files', `${'1'.repeat(64)}.js`))).toBe(false);
    expect(await exists(join(live, 'files', `${'2'.repeat(64)}.js.gz`))).toBe(false);
    expect(await exists(join(live, 'files', `${'3'.repeat(64)}.js`))).toBe(true);
    expect(await exists(join(live, 'files', `${'3'.repeat(64)}.js.gz`))).toBe(true);
    expect(await exists(join(live, 'files', `${shared}.js`))).toBe(true);
    expect(await readFile(join(live, 'latest.json'), 'utf8')).toBe(latest(versions[6]!));
  });

  it('brings an old release back whole when an old commit is deployed again, and keeps it as the newest', async () => {
    const root = await mkdtemp(join(tmpdir(), 'astera-ota-prune-'));
    roots.push(root);
    const live = join(root, 'live');
    const versions = ['1', '2', '3', '4', '5', '6', '7'].map(digit => digit.repeat(40));
    const files = (version: string) => [version.slice(0, 1).repeat(64)];
    for (const version of versions) expect(run(await stageRelease(root, version, files(version)), live).status).toBe(0);
    expect(await exists(join(live, versions[0]!))).toBe(false);
    expect(run(await stageRelease(root, versions[0]!, files(versions[0]!)), live).status).toBe(0);
    const releases = (await readdir(live)).filter(name => /^[a-f0-9]{40}$/u.test(name)).sort();
    expect(releases).toEqual([versions[0], ...versions.slice(3)]);
    expect(await exists(join(live, 'files', `${'1'.repeat(64)}.js`))).toBe(true);
    expect(await readFile(join(live, 'latest.previous.json'), 'utf8')).toBe(latest(versions[6]!));
  });
});
