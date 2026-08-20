import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

/**
 * Password storage, with no new dependency.
 *
 * scrypt from `node:crypto` rather than bcrypt or argon2: both of those are native
 * addons that have to compile per platform, and this project is one developer on
 * one machine shipping to one small box. scrypt is memory-hard, is in the standard
 * library, and is what Node itself recommends for this.
 *
 * THE STORED FORM CARRIES ITS OWN PARAMETERS: `scrypt$N$r$p$salt$hash`. Raising
 * the cost later must not lock out every existing account, so verification reads
 * the cost out of the row it is checking rather than out of this file. That is the
 * difference between a parameter change and a password reset for everybody.
 */

/**
 * Cost. N=16384, r=8, p=1 is the classic interactive-login setting: about 16 MB
 * and a few tens of milliseconds per hash. Anything cheaper is a lookup table;
 * anything dearer makes a login feel broken on a small box.
 */
const N = 16_384;
const R = 8;
const P = 1;
const KEY_BYTES = 32;
const SALT_BYTES = 16;

/**
 * scrypt needs working memory of roughly `128 · N · r` bytes and Node's default
 * ceiling is 32 MB — exactly at the limit for these parameters. Stated explicitly
 * so a future cost increase fails in review here rather than at runtime, under
 * load, as an unexplained login error.
 */
const MAX_MEMORY = 64 * 1024 * 1024;

const b64 = (buf: Buffer): string => buf.toString('base64url');

/**
 * Promisified by hand rather than through `util.promisify`.
 *
 * `scrypt` is overloaded, and promisify resolves the overload to a signature whose
 * result is not a Buffer — which would need a cast at every call site to type, and
 * casts to silence the compiler are banned here for exactly this reason: the cast
 * would be load-bearing and unchecked. Written out, the callback's own type does
 * the work.
 */
function derive(password: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  // Normalised so a password typed on a phone keyboard that emits decomposed
  // accents still matches the one registered on a desktop that emits composed
  // ones. Two byte sequences the user cannot tell apart must not be two passwords.
  const normalised = password.normalize('NFKC');
  return new Promise((resolve, reject) => {
    scrypt(normalised, salt, KEY_BYTES, { N: n, r, p, maxmem: MAX_MEMORY }, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await derive(password, salt, N, R, P);
  return ['scrypt', N, R, P, b64(salt), b64(key)].join('$');
}

/**
 * Check a password against a stored hash.
 *
 * Returns false for a malformed or unknown-algorithm row rather than throwing: a
 * corrupt password column is a failed login, not a 500 that tells an attacker they
 * found something interesting.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) return false;
  // A hostile row must not be able to ask this process for gigabytes of scratch.
  if (n <= 0 || r <= 0 || p <= 0 || 128 * n * r > MAX_MEMORY) return false;

  const salt = Buffer.from(parts[4] ?? '', 'base64url');
  const expected = Buffer.from(parts[5] ?? '', 'base64url');
  if (salt.length === 0 || expected.length === 0) return false;

  let actual: Buffer;
  try {
    actual = await derive(password, salt, n, r, p);
  } catch {
    return false;
  }

  // Length check first: timingSafeEqual throws on a mismatch, and the length of a
  // stored digest is not a secret.
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
