/**
 * THE VISITOR'S CHOICE, AND THE ONLY THING ALLOWED TO MOVE GOOGLE'S SIGNALS.
 *
 * `public/consent-bootstrap.js` runs before Google's ad loader and queues four
 * denied defaults — `ad_storage`, `ad_user_data`, `ad_personalization`,
 * `analytics_storage`. Nothing in the client may update them except this module,
 * and only after a visitor has explicitly chosen. That is the whole design: a
 * first visit stores nothing beyond the session cookie, whatever country it
 * comes from.
 *
 * TWO REGIMES, ONE OF WHICH IS NOT OURS TO RUN.
 *
 *   · EEA / UK / SWITZERLAND — a Google-certified CMP is mandatory, and Google's
 *     own message (AdSense → Privacy & messaging) is the one that shows. When it
 *     is present it also writes the Consent Mode signals itself, so this module
 *     stands down entirely: `googleCmpGoverns()` is the check, and the framework
 *     API it defines is the marker, because a CMP defines it before it shows
 *     anything. The same applies to Google's US state regulations message.
 *   · EVERYWHERE ELSE, INCLUDING TÜRKİYE — Google publishes no message type that
 *     reaches it, so nothing of Google's ever appears there. KVKK still requires
 *     an informed choice before non-essential storage, with refusing as easy as
 *     accepting, and that is the notice in `ConsentNotice.tsx`. It is also why
 *     "no banner appeared" can never mean "consent was assumed".
 *
 * THE DECISION IS VERSIONED. When the disclosure text changes materially the
 * version goes up and every stored answer stops counting, because an old yes is
 * not an answer to a new question.
 *
 * STORAGE MAY THROW, AND EVERY PATH HERE SURVIVES IT. Safari in private browsing
 * raises from `localStorage` rather than returning null; a privacy notice that
 * takes the page down with it is worse than no notice at all. A visitor there
 * gets exactly what they asked for this session — the signal still moves — it is
 * simply not remembered.
 */

/** One decision, covering measurement and advertising together. */
export type ConsentDecision = 'granted' | 'denied';

/** What is written down, and the shape `readConsent` refuses to guess at. */
export interface ConsentRecord {
  version: number;
  decision: ConsentDecision;
  /** ISO instant. Kept so a disclosure dispute has a date to point at. */
  at: string;
}

/** Per device, like language and sound. Never sent to the server. */
export const CONSENT_STORAGE_KEY = 'astera.consent';

/** Raise this whenever the notice's wording changes what was agreed to. */
export const CONSENT_VERSION = 1;

/** How the menu asks the notice to open. See `openConsentNotice`. */
export const CONSENT_EVENT = 'astera:consent-open';

declare global {
  interface Window {
    /** Defined by any TCF v2 consent management platform, Google's included. */
    __tcfapi?: unknown;
    /** IAB Global Privacy Platform. Google's US state messages carry a GPP string. */
    __gpp?: unknown;
    /** The older US Privacy String API, superseded by GPP but still deployed. */
    __uspapi?: unknown;
    /** Google Funding Choices. `showRevocationMessage` reopens its message. */
    googlefc?: { showRevocationMessage?: () => void };
  }
}

const SIGNALS = ['ad_storage', 'ad_user_data', 'ad_personalization', 'analytics_storage'] as const;

const payload = (decision: ConsentDecision): Record<string, ConsentDecision> =>
  Object.fromEntries(SIGNALS.map((signal) => [signal, decision]));

/**
 * Push the update onto whatever queue exists.
 *
 * `window.gtag` is defined synchronously by the bootstrap and by `analytics.ts`,
 * both of which create it before any remote tag loads, so a call made this early
 * queues rather than disappearing. Where no tag was ever configured there is
 * nothing to tell and nothing to do.
 */
function updateSignals(decision: ConsentDecision): void {
  window.gtag?.('consent', 'update', payload(decision));
}

/** What the visitor decided last time, or null if they never did. */
export function readConsent(): ConsentRecord | null {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;

  const { version, decision, at } = parsed as Partial<ConsentRecord>;
  if (version !== CONSENT_VERSION) return null;
  if (decision !== 'granted' && decision !== 'denied') return null;
  return { version, decision, at: typeof at === 'string' ? at : '' };
}

/** Write the decision down and move the signals to match it. */
export function recordConsent(decision: ConsentDecision): ConsentRecord {
  const record: ConsentRecord = {
    version: CONSENT_VERSION,
    decision,
    at: new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Private browsing. The choice holds for this page; it is not remembered.
  }
  updateSignals(decision);
  return record;
}

/**
 * Re-apply a decision made on an earlier visit, once per page load.
 *
 * Without this the defaults would stay denied for a visitor who already said yes
 * — which is not a privacy win, it is a page that ignores the answer it was
 * given and asks the same question forever.
 */
export function applyStoredConsent(): void {
  const stored = readConsent();
  if (stored) updateSignals(stored.decision);
}

/**
 * True where a certified CMP — Google's — owns the question instead of us.
 *
 * THREE APIS, BECAUSE GOOGLE'S CMP SPEAKS THREE FRAMEWORKS. Its European
 * regulations message runs on the IAB TCF and defines `__tcfapi`. Its US state
 * regulations message does not: it carries a Global Privacy Platform string and
 * defines `__gpp`, or `__uspapi` on the older US Privacy String. Watching only
 * for TCF would leave a visitor in California answering Google's message and
 * then answering ours stacked on top of it — the same double-ask the EEA branch
 * exists to prevent.
 *
 * THIS IS ALSO WHERE THE FIRST-PARTY NOTICE'S SCOPE IS DEFINED, and it is
 * defined by subtraction rather than by a country list: the notice asks wherever
 * Google's CMP has nothing to say. Google publishes no message type for Türkiye
 * — the console offers European regulations, US state regulations, ad blocking
 * recovery and Offerwall, and no general cookie-consent message — so Türkiye
 * falls to us, which is exactly where KVKK puts it anyway.
 */
export const googleCmpGoverns = (): boolean =>
  typeof window.__tcfapi === 'function' ||
  typeof window.__gpp === 'function' ||
  typeof window.__uspapi === 'function';

/**
 * Ask Google's message to reopen. Returns false when there is nothing to reopen,
 * which is how the menu row knows to show the first-party notice instead.
 */
export function reopenGoogleCmp(): boolean {
  if (!googleCmpGoverns()) return false;
  const show = window.googlefc?.showRevocationMessage;
  if (typeof show !== 'function') return false;
  show();
  return true;
}

/**
 * Whether this build has anything to ask about.
 *
 * `__asteraConsentDefaults` is set by `public/consent-bootstrap.js`, which only
 * ships in a production build, and by `startAnalytics()` wherever a measurement
 * id was configured. On a plain dev server neither runs, nothing but the session
 * cookie is stored, and a cookie banner there would be theatre.
 */
export const consentMatters = (): boolean => window.__asteraConsentDefaults === true;

/**
 * Reopen the first-party notice from anywhere.
 *
 * A window event rather than a context or a store: the menu sheet and the notice
 * live in different trees — the notice is mounted beside `<App />` so it survives
 * every phase change, including the landing screen where the ad tag already runs
 * — and one event is a smaller thing to own than a provider spanning both.
 */
export function openConsentNotice(): void {
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT));
}
