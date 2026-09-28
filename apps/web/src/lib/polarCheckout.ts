/** The server creates the hosted checkout; the browser leaves the game only after it responds. */
export function navigateToPolarCheckout(url: string): void {
  window.location.assign(url);
}
