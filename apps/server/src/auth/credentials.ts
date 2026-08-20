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
 * Letters, digits and underscore, 3-16.
 *
 * Deliberately narrow. A commander's name is read by other people in battle
 * reports and on the ladder, and the rules that follow from a permissive charset —
 * homoglyph impersonation, right-to-left overrides, zero-width padding — are all
 * problems this game does not need to have solved. Display casing is preserved
 * separately, so `Vantage` still reads as `Vantage`.
 */
export const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,16}$/;

/** Names that must never belong to a player, whatever the casing. */
const RESERVED = new Set([
  'admin', 'administrator', 'root', 'system', 'server', 'astera',
  'moderator', 'mod', 'support', 'staff', 'null', 'undefined', 'anonymous',
]);

export const usernameSchema = z
  .string()
  .trim()
  .regex(USERNAME_PATTERN, 'Use 3-16 letters, numbers or underscores')
  .refine((name) => !RESERVED.has(name.toLowerCase()), 'That name is reserved');

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
export const normaliseUsername = (name: string): string => name.trim().toLowerCase();

export const registerBody = z.object({
  username: usernameSchema,
  password: passwordSchema,
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
