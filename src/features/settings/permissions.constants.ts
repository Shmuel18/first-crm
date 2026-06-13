/**
 * Permission keys HIDDEN from the roles editor — audited 2026-06-07: each key
 * below is checked in ZERO RLS policies and ZERO app gates, so toggling it has
 * no effect; showing dead switches would mislead the admin. Re-expose a key
 * only once a real has_permission() check for it exists.
 *
 *   view_dashboard          — the app is reachable without it; never checked
 *   view_expected_income    — already covered by view_case_fee (same case_financials row)
 *   view_financial_dashboard— /statistics is admin-only (is_admin), not this key
 *   view_financial_reports  — no financial-reports feature exists
 *   export_financial_data   — the case export carries no financial columns
 *   convert_lead_to_case    — lead conversion is gated by create_case
 *   manage_roles            — the roles editor is admin-only (isCurrentUserAdmin)
 *   manage_settings         — settings pages are admin-only by design
 *   manage_lookups          — no lookups-management UI; admin-only
 *
 * Shared by the client editor (render filter) AND the server action (write
 * guard, R3-roles-4) — keep this module free of any server-touching imports so
 * the client bundle stays clean (see the manage-banks client/server gotcha).
 */
export const HIDDEN_PERMISSION_KEYS = new Set<string>([
  'view_dashboard',
  'view_expected_income',
  'view_financial_dashboard',
  'view_financial_reports',
  'export_financial_data',
  'convert_lead_to_case',
  'manage_roles',
  'manage_settings',
  'manage_lookups',
]);
