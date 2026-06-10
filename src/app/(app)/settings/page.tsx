import { SettingsIndexRedirect } from './settings-index-redirect';

export default function SettingsPage() {
  // Mobile: this route is the drill-in menu — the layout's nav is the whole
  // screen. Desktop: redirect to profile (client-side, viewport-gated).
  return <SettingsIndexRedirect />;
}
