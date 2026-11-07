import { z } from 'zod';

/** First-party observations. This allowlist deliberately cannot carry form text or server facts. */
export const ANALYTICS_VERSION = 1;
export const ANALYTICS_BATCH_BYTES = 32 * 1024;
export const ANALYTICS_NAMES = [
  'visit_started', 'foreground_started', 'foreground_ended', 'interaction',
  'landing_visible', 'play_clicked', 'login_clicked', 'training_load_failed',
  'training_started', 'training_resumed', 'training_scene_visible', 'training_text_revealed',
  'training_action_ready', 'training_action_accepted', 'training_result_visible',
  'training_scene_completed', 'training_exit_requested', 'training_completed',
  'auth_attempted', 'auth_result', 'claim_step_visible', 'placement_failed', 'game_ready',
  'command_attempted', 'command_blocked', 'command_result', 'surface_visible', 'blocker_visible', 'outcome_visible',
  'load_phase', 'client_error', 'network_recovered', 'performance_summary',
  'alert_scheduled', 'alert_opened', 'alert_permission', 'install_offer', 'install_result', 'recovery_result',
  'vessel_enlisted', 'vessel_step_completed', 'vessel_feature_opened', 'vessel_first_probe_sent', 'vessel_first_probe_received',
  'vessel_first_mine', 'vessel_first_battle', 'vessel_first_pvp', 'vessel_part_found', 'vessel_migration_started', 'vessel_migration_landed',
] as const;
const code = z.string().max(128).regex(/^[a-zA-Z0-9_.:-]+$/);
const duration = z.number().finite().min(0).max(86_400_000);
export const analyticsPropertiesSchema = z.object({
  scene: code.optional(), trainingVersion: code.optional(), attemptId: z.string().uuid().optional(),
  step: z.number().int().min(1).max(11).optional(),
  surface: code.optional(), subject: code.optional(), code: code.optional(), phase: code.optional(),
  variant: code.optional(), refId: z.string().uuid().optional(),
  durationMs: duration.optional(), foregroundMs: duration.optional(), interactionMs: duration.optional(),
  interactionSlices: z.array(z.object({ startMs: z.number().min(0).max(120_000), endMs: z.number().min(0).max(120_000) }).strict()
    .refine(slice => slice.endMs >= slice.startMs)).max(2).optional(),
  count: z.number().int().min(0).max(1_000_000).optional(),
  value: z.number().finite().min(0).max(1_000_000_000).optional(),
  offsetMinutes: z.number().int().min(-840).max(840).optional(),
}).strict();
export const analyticsEventSchema = z.object({
  id: z.string().uuid(), version: z.literal(1), name: z.enum(ANALYTICS_NAMES),
  source: z.literal('client_observation'), mode: z.enum(['training', 'live', 'replay', 'arena']),
  contextId: z.string().uuid(), sessionId: z.string().uuid(), sequence: z.number().int().nonnegative().max(2147483647),
  occurredAt: z.number().finite().nonnegative(), elapsedMs: duration,
  properties: analyticsPropertiesSchema,
}).strict();
export const analyticsBatchSchema = z.object({ events: z.array(analyticsEventSchema).min(1).max(32) }).strict()
  .refine(batch => new TextEncoder().encode(JSON.stringify(batch)).byteLength <= ANALYTICS_BATCH_BYTES, 'Batch too large');
const campaignValue = z.string().max(128).refine(value => Array.from(value).every(char => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127), 'Control characters');
export const analyticsCampaignSchema = z.object({
  utm_source: campaignValue.optional(), utm_medium: campaignValue.optional(), utm_campaign: campaignValue.optional(),
  utm_content: campaignValue.optional(), utm_term: campaignValue.optional(),
}).strict();
export const analyticsVisitorSchema = z.object({
  policyVersion: z.literal(1), scope: z.enum(['anonymous', 'player', 'server_player']), contextId: z.string().uuid(),
  platform: z.enum(['web', 'android', 'ios', 'unknown']), locale: code, build: code,
  campaign: analyticsCampaignSchema,
}).strict();
export const analyticsGrantSchema = z.object({ visitorId: z.string().uuid(), credential: z.string(), expiresAt: z.string().datetime() });
export type AnalyticsEvent = z.infer<typeof analyticsEventSchema>;
export type AnalyticsName = AnalyticsEvent['name'];
export type AnalyticsProperties = z.infer<typeof analyticsPropertiesSchema>;
export type AnalyticsVisitor = z.infer<typeof analyticsVisitorSchema>;
