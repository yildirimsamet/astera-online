import { Capacitor } from '@capacitor/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ECONOMY_PROFILE } from '@astera/rules';
import { buildHeader, readShellBuild } from '../src/platform/updateGate.js';
import type * as UpdateGateModule from '../src/platform/updateGate.js';
import { UpdateRequired } from '../src/shell/UpdateRequired.js';

const reload = vi.hoisted(() => vi.fn());
vi.mock('../src/brand/OpeningScene.js', () => ({ OpeningScene: () => <div /> }));
vi.mock('../src/platform/updateGate.js', async importOriginal => ({
  ...await importOriginal<typeof UpdateGateModule>(), reloadWebApp: reload,
}));
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); reload.mockClear(); });

describe('the season rules update', () => {
  it('declares the current profile on browser requests', async () => {
    vi.stubEnv('VITE_ASTERA_RELEASE', '');
    await readShellBuild(() => Promise.resolve({ build: '42' }));
    expect(buildHeader()).toEqual({ 'x-astera-rules': ECONOMY_PROFILE.id });
  });
  it('names the web bundle by its commit when the build knows it (OTA F1)', () => {
    vi.stubEnv('VITE_ASTERA_RELEASE', 'a'.repeat(40));
    expect(buildHeader()).toEqual({ 'x-astera-rules': ECONOMY_PROFILE.id, 'x-astera-web': 'a'.repeat(40) });
  });
  it('names the shell the phone runs, read from native, never a number baked into the web bundle (OTA F1)', async () => {
    vi.stubEnv('VITE_ASTERA_RELEASE', '');
    vi.stubEnv('VITE_ASTERA_NATIVE_BUILD', '7');
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    await readShellBuild(() => Promise.resolve({ build: '42' }));
    expect(buildHeader()).toEqual({ 'x-astera-rules': ECONOMY_PROFILE.id, 'x-astera-build': '42' });
  });
  it.each([['not a versionCode', () => Promise.resolve({ build: 'abc' })], ['a failed bridge', () => Promise.reject(new Error('no bridge'))]])(
    'sends no shell build after %s', async (_case, info) => {
      vi.stubEnv('VITE_ASTERA_RELEASE', '');
      vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
      await readShellBuild(() => Promise.resolve({ build: '42' }));
      await readShellBuild(info);
      expect(buildHeader()).toEqual({ 'x-astera-rules': ECONOMY_PROFILE.id });
    });
  it('never holds the game start on a bridge that does not answer', async () => {
    vi.useFakeTimers();
    try {
      vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
      let done = false;
      void readShellBuild(() => new Promise(() => undefined)).then(() => { done = true; });
      await vi.advanceTimersByTimeAsync(2000);
      expect(done).toBe(true);
      expect(buildHeader()).not.toHaveProperty('x-astera-build');
    } finally { vi.useRealTimers(); }
  });
  it('names the shell once a slow bridge answers after the start, so the build gate still applies', async () => {
    vi.useFakeTimers();
    try {
      vi.stubEnv('VITE_ASTERA_RELEASE', '');
      vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
      void readShellBuild(() => new Promise(resolve => { setTimeout(() => { resolve({ build: '42' }); }, 3000); }));
      await vi.advanceTimersByTimeAsync(2000);
      expect(buildHeader()).not.toHaveProperty('x-astera-build');
      await vi.advanceTimersByTimeAsync(1000);
      expect(buildHeader()).toHaveProperty('x-astera-build', '42');
    } finally { vi.useRealTimers(); }
  });
  it('a late answer from an earlier read does not overwrite a newer one', async () => {
    vi.useFakeTimers();
    try {
      vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
      void readShellBuild(() => new Promise(resolve => { setTimeout(() => { resolve({ build: '7' }); }, 3000); }));
      await vi.advanceTimersByTimeAsync(2000);
      await readShellBuild(() => Promise.resolve({ build: '42' }));
      await vi.advanceTimersByTimeAsync(1000);
      expect(buildHeader()).toHaveProperty('x-astera-build', '42');
    } finally { vi.useRealTimers(); }
  });
  it('offers a real browser reload instead of a store link on the web', () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false);
    render(<UpdateRequired />);
    fireEvent.click(screen.getByRole('button', { name: 'Reload game' }));
    expect(reload).toHaveBeenCalledOnce();
    expect(screen.queryByRole('link')).toBeNull();
  });
  it('retains the Android store update path', () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android');
    render(<UpdateRequired />);
    expect(screen.getByRole('link', { name: 'Update on Google Play' })).toHaveAttribute('href', expect.stringContaining('play.google.com'));
    expect(screen.queryByRole('button')).toBeNull();
  });
});
