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
 * informed choice before any non-essential storage. Owner 2026-11-27: the first visit
 * gets a thin note with one close button, and any touch on the game puts it away.
 * Putting it away keeps only the essentials (the owner chose this over "a touch means
 * yes", which KVKK does not count as consent). These tests hold what makes that true:
 *
 *   1. It only appears where a Google tag actually exists.
 *   2. It never appears on top of Google's own message.
 *   3. Closing it, or touching anything else, keeps only the essentials and is remembered.
 *   4. The full choice can be reopened afterwards, from the menu, forever.
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

it('keeps the public-page choice inside its normal-flow host without changing refusal', async () => {
  const host = document.createElement('div');
  document.body.append(host);
  const view = render(<ConsentNotice inlineHost={host} />);
  expect(host).toContainElement(screen.getByRole('dialog'));
  await userEvent.setup().click(screen.getByRole('button', { name: 'Kapat' }));
  expect(readConsent()?.decision).toBe('denied');
  const scrollIntoView = vi.fn();
  host.scrollIntoView = scrollIntoView;
  act(() => { openConsentNotice(); });
  expect(scrollIntoView).toHaveBeenCalledOnce();
  view.unmount();
  host.remove();
});

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
  it('tells before anything non-essential is stored', () => {
    show();

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // Telling is not consenting: nothing has moved off the denied defaults.
    expect(gtagCalls).toEqual([]);
    expect(readConsent()).toBeNull();
  });

  /**
   * ONE CLOSE BUTTON (owner 2026-11-27). Nothing non-essential is on while the note
   * shows, so it asks for no decision: the only control is the one that puts it away,
   * and the policy is one tap deeper.
   */
  it('offers only a close button, and the policy one tap away', () => {
    show();

    expect(screen.getByRole('button', { name: 'Kapat' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Kabul et' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reddet' })).toBeNull();
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

  it('keeps only the essentials when closed, and remembers it', async () => {
    const user = userEvent.setup();
    show();

    await user.click(screen.getByRole('button', { name: 'Kapat' }));

    expect(gtagCalls).toEqual([
      [
        'consent',
        'update',
        {
          ad_storage: 'denied',
          ad_user_data: 'denied',
          ad_personalization: 'denied',
          analytics_storage: 'denied',
        },
      ],
    ]);
    expect(readConsent()?.decision).toBe('denied');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  /**
   * ANY TOUCH ON THE GAME PUTS IT AWAY (owner 2026-11-27), and the touch still does
   * what it was for: the first pull of the breaker is not spent on a cookie note.
   */
  it('goes away on a touch anywhere else, and lets that touch through', async () => {
    const user = userEvent.setup();
    const pressed = vi.fn();
    render(<><button type="button" onClick={pressed}>Şalter</button><ConsentNotice /></>);

    await user.click(screen.getByRole('button', { name: 'Şalter' }));

    expect(pressed).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(readConsent()?.decision).toBe('denied');
  });

  it('stays while the touch is on the note itself', async () => {
    const user = userEvent.setup();
    show();

    await user.pointer({ keys: '[MouseLeft]', target: screen.getByText('Yalnız gerekli çerezler') });

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(readConsent()).toBeNull();
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
    gtagCalls.length = 0;

    await user.click(screen.getByRole('button', { name: 'Kabul et' }));
    expect(readConsent()?.decision).toBe('granted');
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

  /** The menu is the one place a yes is given, so the reopened choice offers both answers side by side. */
  it('offers both answers when reopened, even before any answer was stored', () => {
    show();
    act(() => {
      openConsentNotice();
    });

    expect(screen.getByRole('button', { name: 'Kabul et' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reddet' })).toBeInTheDocument();
  });

  it('puts a reopened choice away on a touch elsewhere, without changing the answer', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({ version: 1, decision: 'granted', at: '2026-09-01T00:00:00.000Z' }),
    );
    render(<><button type="button">Galaksi</button><ConsentNotice /></>);
    act(() => {
      openConsentNotice();
    });
    gtagCalls.length = 0;

    await user.click(screen.getByRole('button', { name: 'Galaksi' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(readConsent()?.decision).toBe('granted');
    expect(gtagCalls).toEqual([]);
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

});

describe('the notice as a surface', () => {
  /**
   * Design discipline, question 1: the note says what is on (only the essentials),
   * what is off (measurement and personalised ads) and where that is changed.
   */
  it('says only the essentials are on, what is off, and where to change it', () => {
    show();
    const dialog = screen.getByRole('dialog');

    expect(dialog.textContent).toMatch(/gerekli/i);
    expect(dialog.textContent).toMatch(/ölçüm/i);
    expect(dialog.textContent).toMatch(/Menü › Gizlilik/);
  });

  it('says what is always kept and what the choice controls once reopened', () => {
    show();
    act(() => {
      openConsentNotice();
    });
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

/*
  Owner, 2026-10-20: during the Academy the bar sat over the claim sheet's Continue button.
  While it is open it is exempt from the lesson gate and publishes its height, so a
  bottom sheet can stand on top of it instead of underneath.
*/
describe('the notice among other bottom surfaces', () => {
  it('marks itself as the privacy choice the lesson gate never locks', () => {
    show();
    expect(screen.getByRole('dialog')).toHaveAttribute('data-consent-notice');
  });

  it('publishes its height while open and withdraws it once answered', async () => {
    show();
    expect(document.documentElement.style.getPropertyValue('--consent-h')).toMatch(/^\d+px$/);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Kapat' }));
    expect(document.documentElement.style.getPropertyValue('--consent-h')).toBe('');
  });

  it('withdraws its height when it leaves the page', () => {
    const view = render(<ConsentNotice />);
    view.unmount();
    expect(document.documentElement.style.getPropertyValue('--consent-h')).toBe('');
  });
});
