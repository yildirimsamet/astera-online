import { z } from 'zod';
import { chatMediaSchema } from './schemas.js';

export const REPORT_REASONS = ['SPAM', 'HARASSMENT', 'HATE', 'SEXUAL', 'VIOLENCE', 'INAPPROPRIATE_NAME', 'OTHER'] as const;
export const reportReasonSchema = z.enum(REPORT_REASONS);
export const communityBlocksSchema = z.object({ blocks: z.array(z.object({ accountId: z.string().uuid(), username: z.string(), createdAt: z.coerce.date() })) });
export const communityBlockResultSchema = z.object({ blocked: z.boolean() });
export type ReportReason = z.infer<typeof reportReasonSchema>;
export type ReportTarget = { kind: 'message'; channel: 'general' | 'clan' | 'dm'; messageId: string } | { kind: 'player'; playerId: string };
export const contentReportReceiptSchema = z.object({ report: z.object({ id: z.string().uuid(), createdAt: z.coerce.date(), status: z.literal('received') }) });
export const contentReportDecisionSchema = z.object({ id: z.string().uuid(), status: z.enum(['RESOLVED', 'DISMISSED']) });
export const contentReportQueueSchema = z.object({ reports: z.array(z.object({
  id: z.string().uuid(), kind: z.enum(['message', 'player']), channel: z.enum(['general', 'clan', 'dm']).nullable(), messageId: z.string().uuid().nullable(),
  reason: reportReasonSchema, details: z.string(), evidence: z.object({ username: z.string(), playerId: z.string().uuid(), content: z.string(), media: chatMediaSchema.nullable() }),
  status: z.literal('PENDING'), createdAt: z.coerce.date(), targetUsername: z.string().nullable(),
})) });
