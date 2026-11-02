import { commanderKnownHere } from './returning.js';

/** Functional navigation preference only: no identifier or observation history. */
const KEY = 'astera.training-entry.dismissed';
export function wantsFirstVisitTraining(): boolean {
  if (location.hash === '#play') return true;
  if (commanderKnownHere()) return false;
  try { return localStorage.getItem(KEY) !== '1'; }
  catch { return true; }
}
export function dismissFirstVisitTraining(): void {
  consumeTrainingIntent();
  try { localStorage.setItem(KEY, '1'); }
  catch { /* Explicit leave still works on this page without storage. */ }
}

/** The static link carries intent only until React has read its first screen. */
export function consumeTrainingIntent(): void {
  if (location.hash === '#play') history.replaceState(history.state, '', `${location.pathname}${location.search}`);
}
