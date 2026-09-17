import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CONSENT_EVENT,
  CONSENT_STORAGE_KEY,
  CONSENT_VERSION,
  applyStoredConsent,
  consentMatters,
  googleCmpGoverns,
  openConsentNotice,
  readConsent,
  recordConsent,
  reopenGoogleCmp,
} from '../src/lib/consent.js';

/**
 * CONSENT, AND THE ONE RULE THE WHOLE FILE EXISTS FOR.
 *
 * Nothing non-essential may be stored before the visitor has chosen. Google's
 * four Consent Mode signals start `denied` in `public/consent-bootstrap.js`,
 * before the ad loader runs at all, and this module is the only thing in the
 * client allowed to move them — after an explicit choice and never before.
 *
 * `window.gtag` here is the real queue shape: gtag reads the ARGUMENTS OBJECT off
 * `dataLayer`, so the tests assert on what a Google tag would actually drain.
 */
const gtagCalls: unknown[][] = [];

beforeEach(() => {
  gtagCalls.length = 0;
  window.localStorage.clear();
  window.gtag = (...args: [string, ...unknown[]]) => {
    gtagCalls.push(args);
  };
  delete (window as { __tcfapi?: unknown }).__tcfapi;
  delete (window as { __gpp?: unknown }).__gpp;
  delete (window as { __uspapi?: unknown }).__uspapi;
  delete (window as { googlefc?: unknown }).googlefc;
  delete window.__asteraConsentDefaults;
});

afterEach(() => {
  delete window.gtag;
  vi.unstubAllEnvs();
});

const ALL = ['ad_storage', 'ad_user_data', 'ad_personalization', 'analytics_storage'] as const;
const every = (value: 'granted' | 'denied'): Record<string, string> =>
  Object.fromEntries(ALL.map((signal) => [signal, value]));

describe('before a visitor chooses', () => {
  it('holds no decision at all', () => {
    expect(readConsent()).toBeNull();
  });

  it('touches no Google signal when there is nothing stored', () => {
    applyStoredConsent();

    expect(gtagCalls).toEqual([]);
  });
});

describe('recording a choice', () => {
  it('grants all four signals and remembers the decision', () => {
    const record = recordConsent('granted');

    expect(record.decision).toBe('granted');
    expect(gtagCalls).toEqual([['consent', 'update', every('granted')]]);
    expect(readConsent()).toMatchObject({ decision: 'granted', version: CONSENT_VERSION });
  });

  /**
   * A REFUSAL IS A DECISION AND IT IS WRITTEN DOWN. Storing only the "yes" would
   * mean re-asking a visitor who already said no on every single visit, which is
   * the dark pattern the KVKK cookie guidance names directly.
   */
  it('denies all four signals and remembers that too', () => {
    recordConsent('denied');

    expect(gtagCalls).toEqual([['consent', 'update', every('denied')]]);
    expect(readConsent()?.decision).toBe('denied');
  });

  it('replays a stored grant on the next page load', () => {
    recordConsent('granted');
    gtagCalls.length = 0;

    applyStoredConsent();

    expect(gtagCalls).toEqual([['consent', 'update', every('granted')]]);
  });
});

describe('a stored record that cannot be trusted', () => {
  /**
   * The wording a visitor agreed to is versioned. When the disclosure changes,
   * the old "yes" is not an answer to the new question — so it is discarded and
   * the notice asks again rather than silently inheriting consent.
   */
  it('is ignored when it was written against an older disclosure', () => {
    window.localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({ version: CONSENT_VERSION - 1, decision: 'granted', at: '2026-01-01T00:00:00.000Z' }),
    );

    expect(readConsent()).toBeNull();
  });

  it.each(['not json at all', '{}', '{"version":1,"decision":"maybe"}', 'null'])(
    'is ignored when it is %s',
    (stored) => {
      window.localStorage.setItem(CONSENT_STORAGE_KEY, stored);

      expect(readConsent()).toBeNull();
    },
  );

  /**
   * Safari in private mode throws from `localStorage` rather than returning
   * null. A privacy notice that crashes the page is worse than no notice.
   */
  it('is ignored when storage itself throws', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });

    expect(readConsent()).toBeNull();
    // The signal still has to move: a visitor who says yes in a private window
    // gets what they asked for, it simply is not remembered next time.
    expect(() => recordConsent('granted')).not.toThrow();
    expect(gtagCalls).toEqual([['consent', 'update', every('granted')]]);

    getItem.mockRestore();
    setItem.mockRestore();
  });
});

describe('who owns the question', () => {
  /**
   * In the EEA, the UK and Switzerland a Google-certified CMP is mandatory and
   * Google's own message is the one that runs. Two notices stacked on one screen
   * is both a worse experience and a worse answer — whichever one the visitor
   * dismisses, the other still claims to speak for them.
   */
  it('defers to the Google CMP when its TCF API is present', () => {
    (window as { __tcfapi?: unknown }).__tcfapi = () => undefined;

    expect(googleCmpGoverns()).toBe(true);
  });

  /**
   * TCF IS NOT THE ONLY FRAMEWORK GOOGLE'S CMP SPEAKS.
   *
   * European regulations messages use TCF and define `__tcfapi`. US state
   * regulations messages do not — they carry a GPP string and define `__gpp`
   * (or, on the older US Privacy String, `__uspapi`). Watching only for TCF
   * would leave a Californian visitor answering Google's message and then
   * answering ours on top of it, which is the exact double-ask the EEA branch
   * exists to prevent.
   */
  it.each(['__gpp', '__uspapi'] as const)('also defers when Google speaks %s instead', (api) => {
    window[api] = () => undefined;

    expect(googleCmpGoverns()).toBe(true);
  });

  it('answers the question itself when no certified CMP loaded', () => {
    expect(googleCmpGoverns()).toBe(false);
  });

  it('reopens the Google message through the funding-choices queue', () => {
    const showRevocationMessage = vi.fn();
    (window as { __tcfapi?: unknown }).__tcfapi = () => undefined;
    (window as { googlefc?: unknown }).googlefc = { showRevocationMessage };

    expect(reopenGoogleCmp()).toBe(true);
    expect(showRevocationMessage).toHaveBeenCalledOnce();
  });

  it('reports failure when there is no Google message to reopen', () => {
    expect(reopenGoogleCmp()).toBe(false);
  });
});

describe('whether there is anything to consent to', () => {
  /**
   * A dev server with no measurement id and no ad tag stores nothing beyond the
   * session cookie, so asking would be theatre. The bootstrap flag is the honest
   * signal: it is set by `public/consent-bootstrap.js` in a production build and
   * by `startAnalytics` wherever a measurement id was configured.
   */
  it('is false on a build with no Google tag at all', () => {
    expect(consentMatters()).toBe(false);
  });

  it('is true once a Google tag has queued its denied defaults', () => {
    window.__asteraConsentDefaults = true;

    expect(consentMatters()).toBe(true);
  });
});

describe('reopening the first-party notice', () => {
  it('announces on the window so the menu row does not need a shared store', () => {
    const heard = vi.fn();
    window.addEventListener(CONSENT_EVENT, heard);

    openConsentNotice();

    expect(heard).toHaveBeenCalledOnce();
    window.removeEventListener(CONSENT_EVENT, heard);
  });
});
