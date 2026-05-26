import type { Database } from '@/types/database';

export type ProfileRow = Database['public']['Tables']['profiles']['Row'];
export type RoleRow = Database['public']['Tables']['roles']['Row'];

export type TeamRole = Pick<RoleRow, 'id' | 'key' | 'name_he' | 'name_en'>;

export type TeamMember = Pick<
  ProfileRow,
  'id' | 'first_name' | 'last_name' | 'email' | 'phone' | 'language' | 'is_active' | 'created_at'
> & {
  role: TeamRole | null;
  activeCasesCount: number;
  openTasksCount: number;
};

export type InviteActionState =
  | {
      ok: true;
      email: string;
      emailed: boolean;
      // Single-use, time-limited Supabase invite link. Present ONLY when
      // emailed=false so the admin can share it manually. Null when the email
      // went out successfully — the link should not linger in client memory.
      inviteLink: string | null;
    }
  | {
      ok: false;
      error: 'validation' | 'unauthorized' | 'email_exists' | 'rate_limited' | 'unknown';
      fieldErrors?: Record<string, string>;
      values?: Partial<Record<string, string>>;
    }
  | { ok: false; error: 'idle' };

export const INVITE_ACTION_INITIAL: InviteActionState = { ok: false, error: 'idle' };
