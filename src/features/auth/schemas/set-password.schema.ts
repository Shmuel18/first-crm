import { z } from 'zod';

/**
 * App-level password policy. NOTE: the Supabase Auth floor on this project is
 * 6 chars with NO complexity requirement (supabase/config.toml:
 * minimum_password_length = 6, password_requirements = "") — so THIS schema is
 * the real gate. We require 8+ chars plus at least one letter and one digit.
 * The min length is also surfaced as the HTML `minLength` attribute on the
 * form inputs. Keep the production Supabase dashboard policy at or below
 * these values so the two layers never disagree in the stricter direction.
 */
export const PASSWORD_MIN_LENGTH = 8;

/** At least one letter (any script) and one digit. Message key: 'weak'. */
const hasLetterAndDigit = (v: string): boolean => /\p{L}/u.test(v) && /\d/.test(v);

export const SetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(PASSWORD_MIN_LENGTH)
      .refine(hasLetterAndDigit, { message: 'weak' }),
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    path: ['confirm'],
    message: 'mismatch',
  });

export type SetPasswordInput = z.infer<typeof SetPasswordSchema>;
