/**
 * What a commander's name and password may be, on the client's side of the wire.
 *
 * MIRRORED FROM `apps/server/src/auth/credentials.ts`, DELIBERATELY, so a player
 * is told about a three-character name without a round trip. The server checks
 * again regardless and its refusal is what gets shown — including the one this
 * cannot know, that the name is already taken.
 *
 * ONE COPY ON THIS SIDE, THOUGH. Two forms ask for a commander now — the front
 * door and the onboarding claim (D56) — and a second literal would be a second
 * place the two can disagree about what a valid name is, which shows up as a form
 * that accepts a name the other one refuses.
 */

/** Letters, digits and underscore, 3-16. Reserved names are the server's to refuse. */
export const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,16}$/;

export const MIN_PASSWORD = 8;
