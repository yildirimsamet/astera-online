import { COUNTRY_CODES } from '@astera/rules';
import { z } from 'zod';

/**
 * What a username and a password are allowed to be. D21.
 *
 * One definition, shared by register and login, because the two MUST agree: if
 * login normalised differently from register, an account could be created that its
 * owner can never sign into again, and the bug would only appear for the players
 * who typed capitals.
 */

/**
 * Unicode letters, marks and numbers, plus inner single spaces and underscores.
 * Format controls and padding are excluded so a visible name remains easy to
 * select and compare. Display casing and script are preserved for other players.
 */
export const USERNAME_PATTERN = /^[\p{L}\p{N}]\p{M}*(?:[\p{L}\p{N}]\p{M}*|_+[\p{L}\p{N}]\p{M}*| [\p{L}\p{N}]\p{M}*)+$/u;

/** Names that must never belong to a player, whatever the casing. */
const RESERVED = new Set([
  'admin', 'administrator', 'root', 'system', 'server', 'astera',
  'moderator', 'mod', 'support', 'staff', 'null', 'undefined', 'anonymous',
]);

export const usernameSchema = z
  .string()
  .trim()
  .regex(USERNAME_PATTERN, 'Use 2-32 letters, numbers, underscores or single spaces')
  .refine((name) => Array.from(name).length <= 32, 'At most 32 characters')
  .refine((name) => !RESERVED.has(normaliseUsername(name)), 'That name is reserved');

/**
 * Eight characters, and an upper bound.
 *
 * The ceiling is not a strength rule — it is a cost rule. scrypt hashes whatever
 * it is handed, so an unbounded field lets one request pin a core for as long as
 * it likes, which is a denial of service wearing a login form.
 */
export const passwordSchema = z
  .string()
  .min(8, 'At least 8 characters')
  .max(200, 'At most 200 characters');

/** The stored, indexed form. Comparisons and uniqueness both run on this. */
export const normaliseUsername = (name: string): string => name.trim().normalize('NFKC').toLowerCase();

export const countryCodeSchema = z.enum(COUNTRY_CODES);

export const registerBody = z.object({
  username: usernameSchema,
  password: passwordSchema,
  countryCode: countryCodeSchema.optional(),
});

/**
 * Login parses the SHAPE loosely on purpose.
 *
 * A rejected-because-malformed login and a rejected-because-wrong login must look
 * the same from outside: telling a caller "that is not a valid username" also
 * tells them which names are worth guessing. Both paths end at one BAD_CREDENTIALS.
 */
export const loginBody = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(200),
});
