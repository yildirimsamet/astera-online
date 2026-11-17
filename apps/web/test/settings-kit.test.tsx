import type { ReactNode } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { MenuPanel } from '../src/shell/MenuPanel.js';
import { setMusicEnabled, setMusicVolume, useMusicEnabled } from '../src/lib/music.js';
import { setFpsMeterEnabled } from '../src/lib/fpsMeter.js';
import { setEffectsEnabled } from '../src/lib/sound.js';
import i18n from '../src/i18n/index.js';

/**
 * THE SETTINGS ON THE KIT (G1-f, 2026-11-14). The worst-measured screen of 2026-11-11: a web
 * form's select box for the language, sliders drawn by hand, four kinds of row. Now every line
 * is a kit control: the language a row of flags, each sound a switch you throw and a slider
 * that says its level, the picture's quality a choice of lit plates, the frame meter a switch.
 */

const press = (element: HTMLElement): void => {
  fireEvent.pointerDown(element, { button: 0 });
  fireEvent.pointerUp(element);
  fireEvent.click(element, { detail: 1 });
};

function show() {
  const api = new Api({ fetch: vi.fn(() => Promise.resolve(new Response(JSON.stringify({ servers: [], placement: null }), { status: 200, headers: { 'content-type': 'application/json' } }))) as unknown as typeof globalThis.fetch });
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queries}><ApiProvider api={api}>{children}</ApiProvider></QueryClientProvider>
  );
  return render(<Wrapper><MenuPanel page="settings" galaxy="Vantage" shard="EU-1" endsAt={null} onOpen={vi.fn()} onSignOut={vi.fn()} /></Wrapper>);
}

function MusicState() { return <span data-testid="music">{String(useMusicEnabled())}</span>; }

beforeEach(async () => {
  if (i18n.resolvedLanguage !== 'en') await i18n.changeLanguage('en');
  setMusicEnabled(true);
  setMusicVolume(0.35);
  setEffectsEnabled(true);
  setFpsMeterEnabled(false);
});

describe('the settings, on the kit', () => {
  it('chooses the language from a row of flags, never a select box', () => {
    show();
    expect(screen.queryByRole('combobox')).toBeNull();
    const languages = screen.getByRole('radiogroup', { name: i18n.t('settings.sectionLabel') });
    expect(within(languages).getAllByRole('radio').length).toBeGreaterThanOrEqual(6);
  });

  it('throws each sound on and off with a switch, and says its level beside its slider', () => {
    show();
    render(<MusicState />);
    const music = screen.getByRole('switch', { name: new RegExp(i18n.t('menu.soundLabel')) });
    expect(music).toHaveAttribute('aria-checked', 'true');
    press(music);
    expect(screen.getByTestId('music')).toHaveTextContent('false');
    expect(screen.getByRole('switch', { name: new RegExp(i18n.t('menu.effectsLabel')) })).toHaveAttribute('aria-checked', 'true');
    const volume = screen.getByRole('slider', { name: i18n.t('menu.volumeLabel') });
    expect(volume).toHaveAttribute('aria-valuenow', '35');
    expect(volume.closest('.gk-slider')?.querySelector('output')).toHaveTextContent(i18n.t('menu.volumeValue', { volume: 35 }));
    expect(screen.getByRole('slider', { name: i18n.t('menu.effectsVolumeLabel') })).toBeInTheDocument();
  });

  it('chooses the picture’s quality from lit plates, at once', () => {
    show();
    const rungs = screen.getByRole('radiogroup', { name: i18n.t('menu.qualityLabel') });
    expect(rungs).toHaveClass('gk-choices');
  });

  it('throws the frame meter with a switch', () => {
    show();
    const fps = screen.getByRole('switch', { name: new RegExp(i18n.t('menu.fpsLabel')) });
    expect(fps).toHaveAttribute('aria-checked', 'false');
    press(fps);
    expect(fps).toHaveAttribute('aria-checked', 'true');
  });

  it('heads the page with the kit’s section tag', () => {
    const { container } = show();
    expect(container.querySelector('.gk-tag')).toHaveTextContent(i18n.t('menu.deviceHeading'));
  });
});
