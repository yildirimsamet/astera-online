/* global document, window, Paddle */
/**
 * Paddle reads `_ptxn` from this page URL when Initialize runs and opens that
 * transaction. The token is public but still comes from the server env.
 * @param {Document} root
 * @param {string} href
 * @param {typeof fetch} fetcher
 * @param {{ Initialize?: (options: { token: string }) => void } | undefined} sdk
 */
export async function startPaymentLink(root, href, fetcher, sdk) {
  const status = root.querySelector('[data-payment-link]');
  const transactionId = new URL(href).searchParams.get('_ptxn');
  if (!transactionId || !/^txn_[a-z\d]{20,40}$/i.test(transactionId)) {
    if (status) status.textContent = 'Open a purchase from the signed-in game to start checkout.';
    return;
  }
  try {
    const response = await fetcher('/api/paddle/client-config', { credentials: 'omit' });
    if (!response.ok) throw new Error('Checkout configuration unavailable');
    /** @type {unknown} */
    const config = await response.json();
    if (!config || typeof config !== 'object' || !('enabled' in config) || config.enabled !== true
      || !('clientToken' in config) || typeof config.clientToken !== 'string'
      || !config.clientToken.startsWith('live_') || !sdk
      || typeof sdk.Initialize !== 'function') throw new Error('Checkout unavailable');
    sdk.Initialize({ token: config.clientToken });
    if (status) status.textContent = 'Checkout is opening. If it does not appear, please return to the game and try again.';
  } catch {
    if (status) status.textContent = 'Checkout is unavailable. Please return to the game and try again later.';
  }
}

if (typeof document !== 'undefined' && document.querySelector('[data-payment-link]')) {
  void startPaymentLink(document, window.location.href, fetch, typeof Paddle === 'undefined' ? undefined : Paddle);
}
