import { z } from 'zod';

import { NAME_MAX, optionalIsraeliPhone, requiredEmail } from '@/lib/validators/form-primitives';

export const InviteMemberSchema = z.object({
  first_name: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim() : v),
    z
      .string({ error: 'common.errors.required' })
      .min(1, { error: 'common.errors.required' })
      .max(NAME_MAX, { error: 'common.errors.tooLarge' }),
  ),
  last_name: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim() : v),
    z
      .string({ error: 'common.errors.required' })
      .min(1, { error: 'common.errors.required' })
      .max(NAME_MAX, { error: 'common.errors.tooLarge' }),
  ),
  email: requiredEmail,
  phone: optionalIsraeliPhone,
  role_id: z.uuid({ error: 'common.errors.required' }),
});

export type InviteMemberInput = z.infer<typeof InviteMemberSchema>;

export const UpdateRoleSchema = z.object({
  userId: z.uuid(),
  roleId: z.uuid(),
});

export const SetActiveSchema = z.object({
  userId: z.uuid(),
  isActive: z.boolean(),
});
