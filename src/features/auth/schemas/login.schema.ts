import { z } from 'zod';

// Note: Password length enforced by Supabase Auth (configurable in dashboard).
// We only check non-empty here - actual policy belongs to the auth provider.
// In production, enforce a stronger min length matching the Supabase policy.
export const LoginSchema = z.object({
  email: z.string().email({ message: 'auth.errors.invalidEmail' }),
  password: z.string().min(1, { message: 'auth.errors.passwordRequired' }),
});

export type LoginInput = z.infer<typeof LoginSchema>;
