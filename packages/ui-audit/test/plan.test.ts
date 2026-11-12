import { describe, expect, it } from 'vitest';
import { entryPath, planJobs, previousRun, runFolder, slug, summaryPath } from '../src/run.js';

const visit = (surface: string, reach: `gallery:${string}`) => ({ surface, reach, open: () => Promise.resolve() });

describe('which measurements a visit gets (plan §1.6)', () => {
  const jobs = planJobs([visit('launch', 'gallery:launch')], { langs: ['tr', 'en', 'de', 'ja'], profiles: ['phone', 'desktop', 'narrow'] });
  const of = (profile: string, lang: string) => jobs.find((j) => j.profile.name === profile && j.lang === lang);

  it('measures everything on the phone in Turkish, and presses every control only there', () => {
    expect(of('phone', 'tr')).toMatchObject({ light: false, feedback: true });
    expect(of('phone', 'en')).toMatchObject({ light: false, feedback: false });
  });

  it('measures only overflow for the other languages and on the 320 px phone', () => {
    expect(of('phone', 'de')).toMatchObject({ light: true, feedback: false });
    expect(of('narrow', 'tr')).toMatchObject({ light: true });
    expect(of('narrow', 'ja')).toMatchObject({ light: true });
  });

  it('skips the languages a visit does not exist in', () => {
    const wiki = planJobs([{ ...visit('wiki', 'gallery:wiki'), langs: ['tr', 'en'] }], { langs: ['tr', 'en', 'de'], profiles: ['phone'] });
    expect(wiki.map((j) => j.lang)).toEqual(['tr', 'en']);
  });

  it('skips the screens a visit does not exist on', () => {
    const outline = planJobs([{ ...visit('outline', 'gallery:outline'), profiles: ['desktop'] }], { langs: ['tr', 'en'], profiles: ['phone', 'desktop', 'narrow'] });
    expect(outline.map((j) => `${j.profile.name}/${j.lang}`)).toEqual(['desktop/tr', 'desktop/en']);
  });

  it('measures the desktop in Turkish and English only', () => {
    expect(of('desktop', 'tr')).toMatchObject({ light: false, feedback: false });
    expect(of('desktop', 'de')).toBeUndefined();
  });

  it('measures only overflow, never presses, and skips the desktop in a what-if run', () => {
    const whatIf = planJobs([visit('launch', 'gallery:launch')], { langs: ['tr', 'de'], profiles: ['phone', 'desktop', 'narrow'], overflowOnly: true });
    expect(whatIf.map((j) => `${j.profile.name}/${j.lang}`)).toEqual(['phone/tr', 'phone/de', 'narrow/tr', 'narrow/de']);
    expect(whatIf.every((j) => j.light && !j.feedback)).toBe(true);
  });

  it('keeps to the languages and profiles asked for', () => {
    const only = planJobs([visit('launch', 'gallery:launch')], { langs: ['en'], profiles: ['phone'] });
    expect(only.map((j) => `${j.profile.name}/${j.lang}`)).toEqual(['phone/en']);
  });
});

describe('where an entry is written', () => {
  it('turns a reach into a file-safe name', () => {
    expect(slug('gallery:launch-pirate')).toBe('gallery-launch-pirate');
    expect(slug('client:galaxy-new')).toBe('client-galaxy-new');
  });

  it('nests entries by profile and language', () => {
    expect(entryPath('/out', { surface: 'launch', reach: 'gallery:launch', lang: 'tr', profile: 'phone' })).toBe('/out/raw/phone/tr/launch__gallery-launch');
  });
});

describe('where a run summary is kept', () => {
  it('sits with the run in out/, not in git: a baseline summary is about 6 MB', () => {
    expect(summaryPath('/r/out/ui-audit/2026-11-11')).toBe('/r/out/ui-audit/2026-11-11/summary.json');
  });

  it('compares with the latest earlier day, leaving what-if and device runs and today aside', () => {
    const folders = ['2026-11-01', '2026-11-05-whatif-A', '2026-11-05', '2026-11-09-s22', '2026-11-11'];
    expect(previousRun(folders, '2026-11-11')).toBe('2026-11-05');
    expect(previousRun(['2026-11-11'], '2026-11-11')).toBeNull();
  });

  it('puts a kit run in a folder of its own that is never read as the game baseline (owner 2026-11-12)', () => {
    expect(runFolder('2026-11-12')).toBe('2026-11-12');
    expect(runFolder('2026-11-12', { kit: true })).toBe('kit-2026-11-12');
    expect(previousRun([runFolder('2026-11-11', { kit: true })], '2026-11-12')).toBeNull();
  });
});
