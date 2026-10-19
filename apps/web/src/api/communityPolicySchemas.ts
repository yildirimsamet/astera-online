import { COMMUNITY_POLICY_VERSION, CHAT_LANGUAGES } from '@astera/rules';
import { z } from 'zod';

export const communityPolicyConsentSchema = z.object({ version: z.literal(COMMUNITY_POLICY_VERSION), locale: z.enum(CHAT_LANGUAGES) }).strict();
export type CommunityPolicyConsent = z.infer<typeof communityPolicyConsentSchema>;
export const communityPolicyStatusSchema = z.object({ version: z.string().min(1), acceptedAt: z.coerce.date().nullable() });
