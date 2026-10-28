import { Capacitor } from '@capacitor/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ECONOMY_PROFILE } from '@astera/rules';
import { buildHeader } from '../src/platform/updateGate.js';
import type * as UpdateGateModule from '../src/platform/updateGate.js';
import { UpdateRequired } from '../src/shell/UpdateRequired.js';

const reload = vi.hoisted(() => vi.fn());
vi.mock('../src/brand/OpeningScene.js', () => ({ OpeningScene: () => <div /> }));
vi.mock('../src/platform/updateGate.js', async importOriginal => ({
  ...await importOriginal<typeof UpdateGateModule>(), reloadWebApp: reload,
}));
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); reload.mockClear(); });

describe('the season rules update', () => {
  it('declares the current profile on browser requests', () => {
    vi.stubEnv('VITE_ASTERA_NATIVE_BUILD', '');
    expect(buildHeader()).toEqual({ 'x-astera-rules': ECONOMY_PROFILE.id });
  });
  it('declares the profile alongside the native build', () => {
    vi.stubEnv('VITE_ASTERA_NATIVE_BUILD', '42');
    expect(buildHeader()).toEqual({ 'x-astera-rules': ECONOMY_PROFILE.id, 'x-astera-build': '42' });
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
