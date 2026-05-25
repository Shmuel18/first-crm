import { z } from 'zod';

/**
 * 8 chars is the Supabase Auth default minimum. Tighten here if office policy
 * ever moves above it — the value is also surfaced as the HTML `minLength`
 * attribute on the form input.
 */
export const PASSWORD_MIN_LENGTH = 8;

export const SetPasswordSchema = z
  .object({
    password: z.string().min(PASSWORD_MIN_LENGTH),
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    path: ['confirm'],
    message: 'mismatch',
  });

export type SetPasswordInput = z.infer<typeof SetPasswordSchema>;
