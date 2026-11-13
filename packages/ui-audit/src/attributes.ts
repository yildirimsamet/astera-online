/**
 * Attributes the collector writes into the page and the Node side reads back. Kept
 * apart from the collector, which touches `window` at load and must never run in Node.
 */

/** Each target carries its index, so the press test can find it over CDP. */
export const TARGET = 'data-ui-audit-target';

/** A one-colour icon, hidden with the text for the background screenshot. */
export const ICON = 'data-ui-audit-icon';
