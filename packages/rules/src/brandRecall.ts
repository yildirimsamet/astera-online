/** Owner-approved first-session recall reward. Account-scoped, once for life. */
export const BRAND_RECALL = {
  rewardId: 'BRAND_RECALL:1',
  delayMs: 180_000,
  returnDelayMs: 60_000,
  answer: 'asteraonline.space',
  choices: ['asteraonline.space', 'asteraonline.com', 'astera.space'],
  reward: { alloy: 100, crystal: 50, deuterium: 20 },
} as const;
