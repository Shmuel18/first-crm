import { redirect } from 'next/navigation';

export default async function SettingsPage() {
  // Profile is available to everyone — land there by default.
  redirect('/settings/profile');
}
