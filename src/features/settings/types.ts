export type SettingsActionState =
  | { ok: true }
  | {
      ok: false;
      error: 'validation' | 'unauthorized' | 'unknown';
      fieldErrors?: Record<string, string>;
      values?: Partial<Record<string, string>>;
    }
  | { ok: false; error: 'idle' };

export const SETTINGS_ACTION_INITIAL: SettingsActionState = { ok: false, error: 'idle' };

export type MyProfile = {
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  language: 'he' | 'en';
  roleNameHe: string | null;
  roleNameEn: string | null;
};

export type OfficeSettings = {
  office_name: string;
  office_tagline: string | null;
  address_street: string | null;
  address_city: string | null;
  address_postal_code: string | null;
  phone_main: string | null;
  phone_fax: string | null;
  email_main: string | null;
  website_url: string | null;
  tax_id: string | null;
};
