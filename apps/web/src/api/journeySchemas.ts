import { z } from 'zod';

export const JOURNEY_STAGES = ['registered', 'enlisted', 'refinery', 'mining', 'probe', 'yard', 'built', 'battle', 'victory', 'departed'] as const;
const stage = z.enum(JOURNEY_STAGES);
const stamp = z.number().finite();
const evidence = z.object({ at: stamp, code: z.string() });
export const journeyQuerySchema = z.object({
  hours: z.coerce.number().int().min(1).max(720).default(24),
  from: z.string().datetime().optional(), to: z.string().datetime().optional(),
  absentMinutes: z.coerce.number().pipe(z.union([z.literal(30), z.literal(60), z.literal(1440)])).default(30),
}).strict().refine(q => !q.from || !q.to || Date.parse(q.from) < Date.parse(q.to), 'Invalid registration window');
export type JourneyQuery = z.input<typeof journeyQuerySchema>;

export const journeyPlayerSchema = z.object({
  accountId: z.string().uuid(), username: z.string(), joinedAt: stamp, galaxy: z.string().nullable(),
  stage, milestones: z.array(stage), guideSkipped: z.boolean(), lastTutorial: evidence.nullable(),
  lastActiveAt: stamp.nullable(), lastClientAt: stamp.nullable(), lastCommand: evidence.nullable(), lastSurface: evidence.nullable(),
  activity: z.enum(['recent', 'absent', 'unknown']),
  foregroundMs: z.number().nonnegative().nullable(), interactionMs: z.number().nonnegative().nullable(),
  sampledForegroundMs: z.number().nonnegative(), durationQuality: z.enum(['observed', 'partial', 'missing']),
  sessionCount: z.number().int().nonnegative().nullable(),
  waitingAtLastActivity: z.object({ count: z.number().int().positive(), nextAt: stamp }).nullable(),
  blockers: z.array(evidence), errors: z.array(evidence),
  history: z.array(evidence.extend({ kind: z.enum(['command', 'result', 'screen', 'guide', 'blocker', 'error', 'background']) })),
});
export type JourneyPlayer = z.infer<typeof journeyPlayerSchema>;
export const journeyReportSchema = z.object({
  measuredAt: stamp, from: stamp, to: stamp, absentMinutes: z.number(),
  totalAccounts: z.number().int().nonnegative(), truncated: z.boolean(), players: z.array(journeyPlayerSchema),
});
export type JourneyReport = z.infer<typeof journeyReportSchema>;
