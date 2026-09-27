/** Paddle.js is loaded by the public payment-link page from its CDN script. */
declare const Paddle: { Initialize: (options: { token: string }) => void } | undefined;
