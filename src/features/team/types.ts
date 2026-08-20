import type { Database } from '@/types/database';

export type ProfileRow = Database['public']['Tables']['profiles']['Row'];
export type RoleRow = Database['public']['Tables']['roles']['Row'];

export type TeamRole = Pick<RoleRow, 'id' | 'key' | 'name_he' | 'name_en'>;

export type TeamMember = Pick<
  ProfileRow,
  'id' | 'first_name' | 'last_name' | 'email' | 'phone' | 'language' | 'is_active' | 'created_at'
> & {
  role: TeamRole | null;
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
  | {
      // The address belongs to a member who was REMOVED from the team. The auth
      // user still exists, so a plain invite can't succeed — the dialog offers
      // to restore them instead.
      ok: false;
      error: 'email_exists_deleted';
      deletedMember: { id: string; name: string };
      values?: Partial<Record<string, string>>;
    }
  | { ok: false; error: 'idle' };

export const INVITE_ACTION_INITIAL: InviteActionState = { ok: false, error: 'idle' };

export type RestoreMemberResult =
  | {
      ok: true;
      userId: string;
      /** True when the member never completed onboarding — they need a fresh
       *  set-password link (issued through the resend-invite path). */
      needsInvite: boolean;
    }
  | { ok: false; error: 'unauthorized' | 'validation' | 'not_found' | 'unknown' };

export type UpdateMemberEmailActionState =
  | {
      ok: true;
      email: string;
      emailSent: boolean;
      sessionsRevoked: boolean;
    }
  | {
      ok: false;
      error:
        | 'idle'
        | 'validation'
        | 'unauthorized'
        | 'not_found'
        | 'self_change'
        | 'unchanged'
        | 'email_exists'
        | 'rate_limited'
        | 'out_of_sync'
        | 'unknown';
      fieldErrors?: Record<string, string>;
      values?: Partial<Record<string, string>>;
    };

export const UPDATE_MEMBER_EMAIL_INITIAL: UpdateMemberEmailActionState = {
  ok: false,
  error: 'idle',
};

/** Result of re-issuing a set-password link for an existing member (called
 *  imperatively from a member row, not via a form). */
export type ResendInviteResult =
  | { ok: true; emailed: boolean; inviteLink: string | null }
  | {
      ok: false;
      error: 'unauthorized' | 'not_found' | 'not_allowed' | 'rate_limited' | 'unknown';
    };
