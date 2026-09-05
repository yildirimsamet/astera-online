import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyText } from '../src/lib/clipboard.js';

/**
 * THE COPY BUTTON HAS TO WORK WHERE THE GAME IS ACTUALLY PLAYED.
 *
 * `navigator.clipboard` is not a feature you can assume: it needs a secure
 * context, so it is simply absent over plain HTTP — which is exactly how a phone
 * reaches a dev build on the LAN — and an in-app webview or a denied permission
 * can take it away on HTTPS too. jsdom models that faithfully: neither the async
 * clipboard nor `execCommand` exists here until a test puts one there.
 *
 * The wallet addresses on the donate sheet are the thing being copied, so a silent
 * failure is a donation that never arrives. Each path is proved separately, and so
 * is the case where BOTH are gone — because the honest answer there is `false`,
 * and a caller that shows "Copied" anyway is lying to the player.
 */

function withAsyncClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
}

function withLegacyCopy(execCommand: () => boolean) {
  Object.defineProperty(document, 'execCommand', { value: execCommand, configurable: true });
}

afterEach(() => {
  Reflect.deleteProperty(navigator, 'clipboard');
  Reflect.deleteProperty(document, 'execCommand');
});

describe('copying text', () => {
  it('uses the async clipboard when the browser has one', async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
    withAsyncClipboard(writeText);

    expect(await copyText('TPDV6p6QctXvL7nwiW7AMkPzqNqkrG2kGS')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('TPDV6p6QctXvL7nwiW7AMkPzqNqkrG2kGS');
  });

  it('falls back to the legacy path over plain HTTP, and leaves nothing behind', async () => {
    let copiedFrom: string | null = null;
    withLegacyCopy(() => {
      copiedFrom = document.querySelector('textarea')?.value ?? null;
      return true;
    });

    expect(await copyText('3z84BrV8nzzbZkGuDmWczjn6vd6Z1tKis9PHimZSae9J')).toBe(true);
    expect(copiedFrom).toBe('3z84BrV8nzzbZkGuDmWczjn6vd6Z1tKis9PHimZSae9J');
    // The scratch field is a mechanism, not a thing the page keeps.
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('falls back when the async clipboard exists but refuses', async () => {
    withAsyncClipboard(vi.fn<(text: string) => Promise<void>>().mockRejectedValue(new Error('denied')));
    withLegacyCopy(() => true);

    expect(await copyText('anything')).toBe(true);
  });

  it('reports failure rather than success when neither path exists', async () => {
    expect(await copyText('anything')).toBe(false);
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('reports failure when the legacy path is there but refuses', async () => {
    withLegacyCopy(() => false);

    expect(await copyText('anything')).toBe(false);
  });
});
