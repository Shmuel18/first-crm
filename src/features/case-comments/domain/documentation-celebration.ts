export const DOCUMENTATION_MILESTONE_STEP = 5;

/** A larger celebration every fifth update authored in the current case. */
export function isDocumentationMilestone(authoredCommentCount: number): boolean {
  return authoredCommentCount > 0 && authoredCommentCount % DOCUMENTATION_MILESTONE_STEP === 0;
}
