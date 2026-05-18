import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc('is_admin');

  if (isAdmin === true) {
    redirect('/settings/integrations');
  }
  // Non-admin: no settings sections wired yet - redirect back to cases.
  redirect('/cases');
}
