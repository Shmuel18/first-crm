import { z } from 'zod';

// Spec: a comment body is 1..5000 chars. Trim first so whitespace-only posts
// fail the min check.
export const CASE_COMMENT_BODY_MAX = 5000;

const bodySchema = z.preprocess(
  (v) => (typeof v === 'string' ? v.trim() : v),
  z
    .string({ error: 'common.errors.required' })
    .min(1, { error: 'common.errors.required' })
    .max(CASE_COMMENT_BODY_MAX, { error: 'common.errors.tooLarge' }),
);

export const PostCaseCommentSchema = z.object({
  caseId: z.uuid({ error: 'common.errors.invalidUuid' }),
  body: bodySchema,
});

export const EditCaseCommentSchema = z.object({
  commentId: z.uuid({ error: 'common.errors.invalidUuid' }),
  body: bodySchema,
});

export type PostCaseCommentInput = z.infer<typeof PostCaseCommentSchema>;
export type EditCaseCommentInput = z.infer<typeof EditCaseCommentSchema>;
