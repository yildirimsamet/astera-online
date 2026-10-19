import { Capacitor } from '@capacitor/core';
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Api, ApiError } from '../src/api/client.js';
import i18n from '../src/i18n/index.js';
import { LANGUAGES } from '../src/i18n/languages.js';
import { useUpdateRequired } from '../src/platform/updateGate.js';
import { UpdateRequired } from '../src/shell/UpdateRequired.js';

const json = (body: unknown, status = 200): Promise<Response> =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));

function Probe() { return <p>{useUpdateRequired() ? 'update' : 'playing'}</p>; }

afterEach(async () => { vi.unstubAllEnvs(); vi.restoreAllMocks(); await i18n.changeLanguage('en'); });

describe('native update gate', () => {
  it('names the bundled build on every request, and the web sends none', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(() => json({ error: 'BAD_SESSION', message: 'x' }, 401));
    await new Api({ fetch: fetcher, authTransport: null }).me().catch(() => undefined);
    expect(new Headers(fetcher.mock.calls[0]?.[1]?.headers).has('x-astera-build')).toBe(false);
    vi.stubEnv('VITE_ASTERA_NATIVE_BUILD', '7');
    await new Api({ fetch: fetcher, authTransport: null }).me().catch(() => undefined);
    expect(new Headers(fetcher.mock.calls.at(-1)?.[1]?.headers).get('x-astera-build')).toBe('7');
  });

  it('turns an UPDATE_REQUIRED answer into the update screen, not a request error', async () => {
    render(<Probe />);
    expect(screen.getByText('playing')).toBeTruthy();
    const api = new Api({ fetch: () => json({ error: 'UPDATE_REQUIRED', message: 'Update' }, 426), authTransport: null });
    await act(async () => { await expect(api.me()).rejects.toBeInstanceOf(ApiError); });
    expect(screen.getByText('update')).toBeTruthy();
  });

  for (const language of LANGUAGES) {
    it(`explains the update and links the store on Android in ${language}`, async () => {
      await i18n.changeLanguage(language);
      vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
      vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android');
      render(<UpdateRequired />);
      expect(screen.getByRole('heading', { name: i18n.t('app.updateTitle') })).toBeTruthy();
      expect(screen.getByText(i18n.t('app.updateBody'))).toBeTruthy();
      const store = screen.getByRole('link', { name: i18n.t('app.updateStore') });
      expect(store.getAttribute('href')).toBe('https://play.google.com/store/apps/details?id=space.asteraonline.app');
      expect(i18n.t('app.updateTitle')).not.toBe('app.updateTitle');
    });
  }

  it('offers no store link where there is no Android store', () => {
    render(<UpdateRequired />);
    expect(screen.queryByRole('link')).toBeNull();
  });
});
