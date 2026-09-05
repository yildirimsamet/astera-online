/**
 * COPY, ON THE BROWSERS THIS GAME IS ACTUALLY OPENED IN.
 *
 * `navigator.clipboard` reads like a settled API and is not one in practice. It
 * requires a SECURE CONTEXT, so it is simply absent over plain HTTP — which is how
 * a phone reaches a dev build on the LAN — and on HTTPS an in-app webview (the
 * browser inside Instagram, Telegram, Discord) or a denied permission can still
 * take it away. `lib.dom` types it as always present, which is the part that makes
 * this fail silently: nothing warns, the promise just rejects into nowhere.
 *
 * So this is a chain, not a call:
 *
 *   1. the async Clipboard API, when the browser has one and allows it;
 *   2. `execCommand('copy')` off a scratch field — deprecated, still implemented
 *      everywhere, and the only thing that works in a non-secure context;
 *   3. `false`, honestly, so a caller can show the text instead of claiming it
 *      copied. A "Copied" toast over an empty clipboard is worse than no button.
 *
 * `'clipboard' in navigator` rather than a truthiness check, matching `haptics.ts`:
 * an `in` test narrows an OPTIONAL capability without arguing with the DOM typings.
 */

export async function copyText(text: string): Promise<boolean> {
  return (await writeAsync(text)) || writeLegacy(text);
}

async function writeAsync(text: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('clipboard' in navigator)) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Permission denied, or a webview that exposes the object and refuses the
    // call. Not an error worth surfacing — there is another way to do this.
    return false;
  }
}

/**
 * THE OLD WAY, AND THE FIVE DETAILS THAT MAKE IT WORK.
 *
 * A field that is `display:none` or `visibility:hidden` cannot hold a selection,
 * so the scratch textarea has to be really in the layout — fixed, transparent and
 * inert, which is invisible without being unselectable. iOS ignores `select()` on
 * its own, hence the explicit range; and the field is removed in a `finally` so a
 * refusal cannot leave a stray textarea in the page.
 */
function writeLegacy(text: string): boolean {
  if (typeof document === 'undefined' || !('execCommand' in document)) return false;

  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.style.position = 'fixed';
  field.style.top = '0';
  field.style.left = '0';
  field.style.opacity = '0';
  field.style.pointerEvents = 'none';
  document.body.append(field);

  try {
    field.focus({ preventScroll: true });
    field.select();
    field.setSelectionRange(0, text.length);
    /*
      DEPRECATED ON PURPOSE, and there is no replacement for what it is doing
      here. The Clipboard API is the replacement — and it is the thing that is
      missing whenever this line runs, because it does not exist outside a secure
      context. Every browser still implements this one; the day one of them drops
      it, `copyText` returns false and the address on screen carries the player.
    */
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    field.remove();
  }
}
