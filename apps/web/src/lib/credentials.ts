/**
 * What a commander's name and password may be, on the client's side of the wire.
 *
 * MIRRORED FROM `apps/server/src/auth/credentials.ts`, DELIBERATELY, so a player
 * is told about a too-short name without a round trip. The server checks
 * again regardless and its refusal is what gets shown — including the one this
 * cannot know, that the name is already taken.
 *
 * ONE COPY ON THIS SIDE, THOUGH. Two forms ask for a commander now — the front
 * door and the onboarding claim (D56) — and a second literal would be a second
 * place the two can disagree about what a valid name is, which shows up as a form
 * that accepts a name the other one refuses.
 */

/** Unicode visible names, 2–32 code points. Reserved names are the server's to refuse. */
export const USERNAME_PATTERN = /^[\p{L}\p{N}]\p{M}*(?:[\p{L}\p{N}]\p{M}*|_+[\p{L}\p{N}]\p{M}*| [\p{L}\p{N}]\p{M}*)+$/u;
export const validUsername = (name: string): boolean => USERNAME_PATTERN.test(name.trim()) && Array.from(name.trim()).length <= 32;

export const MIN_PASSWORD = 8;
