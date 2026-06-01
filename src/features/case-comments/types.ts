// Raw row shape for public.case_comments (migration 107). Declared locally
// because the table lands in the generated Database types only after the
// migration is applied + types are regenerated.
export type CaseCommentRow = {
  id: string;
  case_id: string;
  author_id: string;
  body: string;
  created_at: string;
  edited_at: string | null;
};

/** Denormalized shape sent to the client thread (author name for display). */
export type CaseCommentView = {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
};
