import { z } from 'zod';

export const ChangePasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, { error: 'settings.security.errors.tooShort' })
      .regex(/[A-Z]/, { error: 'settings.security.errors.needsUpper' })
      .regex(/[a-z]/, { error: 'settings.security.errors.needsLower' })
      .regex(/[0-9]/, { error: 'settings.security.errors.needsDigit' }),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    error: 'settings.security.errors.mismatch',
    path: ['confirm'],
  });

export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
