import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '../src/i18n/index.js';
import { CONSENT_STORAGE_KEY, openConsentNotice, readConsent } from '../src/lib/consent.js';
import { ConsentNotice } from '../src/shell/ConsentNotice.js';

/**
 * THE FIRST-PARTY NOTICE, WHICH IS THE ONE TÜRKİYE ACTUALLY SEES.
 *
 * Google's certified message covers the EEA, the UK and Switzerland. Everywhere
 * else — and this game's players are largely in Türkiye — KVKK still requires an
 * informed choice before any non-essential storage, with refusing no harder than
 * accepting. These tests hold the four things that makes true:
 *
 *   1. It only appears where a Google tag actually exists.
 *   2. It never appears on top of Google's own message.
 *   3. Refusing is one tap, beside accepting, and it is remembered.
 *   4. It can be reopened afterwards, from the menu, forever.
 */
const gtagCalls: unknown[][] = [];

beforeEach(async () => {
  gtagCalls.length = 0;
  window.localStorage.clear();
  window.gtag = (...args: [string, ...unknown[]]) => {
    gtagCalls.push(args);
  };
  delete (window as { __tcfapi?: unknown }).__tcfapi;
  window.__asteraConsentDefaults = true;
  await i18n.changeLanguage('tr');
});

afterEach(() => {
  delete window.gtag;
  delete window.__asteraConsentDefaults;
});

const show = (): void => {
  render(<ConsentNotice />);
};

describe('when there is nothing to consent to', () => {
  it('renders nothing on a build with no Google tag', () => {
    delete window.__asteraConsentDefaults;
    show();

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('when Google owns the question', () => {
  it('stays out of the way of the certified message', () => {
    (window as { __tcfapi?: unknown }).__tcfapi = () => undefined;
    show();

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('a first visit outside the certified regions', () => {
  it('asks before anything non-essential is stored', () => {
    show();

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // Asking is not consenting: nothing has moved off the denied defaults.
    expect(gtagCalls).toEqual([]);
    expect(readConsent()).toBeNull();
  });

  /**
   * REFUSING IS AS EASY AS ACCEPTING. Both are buttons, both are one tap, and
   * neither is hidden behind a second screen — the KVKK cookie guidance names
   * the opposite arrangement as a defect rather than a design choice.
   */
  it('offers refusing beside accepting, and a way to read the detail first', () => {
    show();

    expect(screen.getByRole('button', { name: 'Kabul et' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reddet' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /çerez politikası/i })).toHaveAttribute(
      'href',
      '/cerez-politikasi.html',
    );
  });

  it('points an English reader at the English cookie policy', async () => {
    await i18n.changeLanguage('en');
    show();

    expect(screen.getByRole('link', { name: /cookie policy/i })).toHaveAttribute(
      'href',
      '/cookies.html',
    );
  });

  it('grants every signal and closes when the visitor accepts', async () => {
    const user = userEvent.setup();
    show();

    await user.click(screen.getByRole('button', { name: 'Kabul et' }));

    expect(gtagCalls).toEqual([
      [
        'consent',
        'update',
        {
          ad_storage: 'granted',
          ad_user_data: 'granted',
          ad_personalization: 'granted',
          analytics_storage: 'granted',
        },
      ],
    ]);
    expect(readConsent()?.decision).toBe('granted');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('records the refusal so it is never asked again unprompted', async () => {
    const user = userEvent.setup();
    show();

    await user.click(screen.getByRole('button', { name: 'Reddet' }));

    expect(readConsent()?.decision).toBe('denied');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('a visitor who has already answered', () => {
  it('is not asked again', () => {
    window.localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({ version: 1, decision: 'denied', at: '2026-09-01T00:00:00.000Z' }),
    );
    show();

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('has their stored answer re-applied rather than silently reset', () => {
    window.localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({ version: 1, decision: 'granted', at: '2026-09-01T00:00:00.000Z' }),
    );
    show();

    expect(gtagCalls).toEqual([
      [
        'consent',
        'update',
        {
          ad_storage: 'granted',
          ad_user_data: 'granted',
          ad_personalization: 'granted',
          analytics_storage: 'granted',
        },
      ],
    ]);
  });

  /**
   * THE WITHDRAWAL PATH, which is the half of consent a banner usually forgets.
   * The menu row dispatches the event; the notice comes back with the current
   * answer already reflected, so the visitor can see what they chose last time.
   */
  it('can reopen the choice from the menu and change it', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({ version: 1, decision: 'denied', at: '2026-09-01T00:00:00.000Z' }),
    );
    show();

    act(() => {
      openConsentNotice();
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Kabul et' }));
    expect(readConsent()?.decision).toBe('granted');
  });

  /**
   * A reopened notice can be left alone. Dismissing it must not count as an
   * answer in either direction — the stored decision stands untouched.
   */
  it('keeps the previous answer when a reopened notice is dismissed', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({ version: 1, decision: 'granted', at: '2026-09-01T00:00:00.000Z' }),
    );
    show();
    act(() => {
      openConsentNotice();
    });
    gtagCalls.length = 0;

    await user.click(screen.getByRole('button', { name: 'Kapat' }));

    expect(readConsent()?.decision).toBe('granted');
    expect(gtagCalls).toEqual([]);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('cannot be dismissed without answering on a first visit', () => {
    show();

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Kapat' })).toBeNull();
  });
});

describe('the notice as a surface', () => {
  /**
   * Design discipline, question 1: a figure or a control the player is meant to
   * act on has to say what it means. Both buttons name their consequence, and
   * the body says what stays either way — the session cookie the game cannot
   * work without is not part of the bargain and must not look like it is.
   */
  it('says what is always kept and what the choice actually controls', () => {
    show();
    const dialog = screen.getByRole('dialog');

    expect(dialog.textContent).toMatch(/oturum/i);
    expect(dialog.textContent).toMatch(/ölçüm|reklam/i);
  });

  it('labels itself for assistive technology', () => {
    show();

    expect(screen.getByRole('dialog')).toHaveAttribute('aria-labelledby');
  });
});

describe('it never throws the page away', () => {
  it('survives a localStorage that refuses to answer', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });

    expect(() => {
      show();
    }).not.toThrow();
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    getItem.mockRestore();
  });
});
