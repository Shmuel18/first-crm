import { z } from 'zod';

export const RequestPasswordResetSchema = z.object({
  email: z.string().email({ message: 'auth.errors.invalidEmail' }),
});

export type RequestPasswordResetInput = z.infer<typeof RequestPasswordResetSchema>;
