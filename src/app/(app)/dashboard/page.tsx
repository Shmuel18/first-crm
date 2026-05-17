import { redirect } from 'next/navigation';

export default function DashboardPage() {
  // The cases list IS the dashboard - the place to see all cases at a glance.
  redirect('/cases');
}
