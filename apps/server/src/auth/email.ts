import { z } from 'zod';

/** Case-insensitive product policy. Never remove plus tags or provider-specific dots. */
export const normaliseEmail = (email: string): string => email.trim().toLowerCase();
export const emailSchema = z.string().trim().max(254).email()
  .regex(/^[\x21-\x7e]+$/, 'Use an ASCII email address').transform(normaliseEmail);
