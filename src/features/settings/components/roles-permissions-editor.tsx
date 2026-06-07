'use client';

import { useMemo, useState, useTransition } from 'react';

import { Check, Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { roleManagementLabel } from '@/lib/auth/role-label';
import type { Locale } from '@/lib/i18n/direction';

import { toggleRolePermissionAction } from '../actions/toggle-role-permission';
import type {
  PermissionCategory,
  PermissionRow,
  RoleRow,
} from '../services/permissions.service';

type Props = {
  roles: RoleRow[];
  permissions: PermissionRow[];
  granted: Record<string, string[]>;
  locale: Locale;
};

const CATEGORY_ORDER: PermissionCategory[] = [
  'view',
  'cases',
  'leads',
  'documents',
  'financial',
  'system',
];

/**
 * Permission keys hidden from the editor because NO code path enforces them —
 * showing a toggle that silently does nothing is misleading, and on the
 * financial ones it's an active "false sense of restriction" (e.g. turning off
 * `export_financial_data` for the secretary looks like it blocks her, but the
 * export is actually gated by `view_all_cases`, which she has). Audited
 * 2026-06-07: each key below is checked in ZERO RLS policies and ZERO app gates.
 * Re-expose a key here only once a real has_permission() check for it exists.
 *
 *   view_dashboard          — the app is reachable without it; never checked
 *   view_expected_income    — already covered by view_case_fee (same case_financials row)
 *   view_financial_dashboard— /statistics is admin-only (is_admin), not this key
 *   view_financial_reports  — no financial-reports feature exists
 *   export_financial_data   — the case export carries no financial columns
 *   convert_lead_to_case    — lead conversion is gated by create_case
 *   manage_roles            — this very editor is admin-only (isCurrentUserAdmin)
 *   manage_settings         — settings pages are admin-only by design
 *   manage_lookups          — no lookups-management UI; admin-only
 */
const HIDDEN_PERMISSION_KEYS = new Set<string>([
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

export function RolesPermissionsEditor({ roles, permissions, granted, locale }: Props) {
  const t = useTranslations('settings.roles');
  const tLevel = useTranslations('settings.roles.levels');

  const [selectedRoleId, setSelectedRoleId] = useState(
    () => roles.find((r) => r.key !== 'admin')?.id ?? roles[0]?.id ?? '',
  );
  const [grantedMap, setGrantedMap] = useState(() => buildMap(granted));
  const [pending, startTransition] = useTransition();

  // Reconcile to fresh server props after a revalidation.
  const [syncedRef, setSyncedRef] = useState(granted);
  if (syncedRef !== granted) {
    setSyncedRef(granted);
    setGrantedMap(buildMap(granted));
  }

  const grouped = useMemo(
    () => groupByCategory(permissions.filter((p) => !HIDDEN_PERMISSION_KEYS.has(p.key))),
    [permissions],
  );
  const selectedRole = roles.find((r) => r.id === selectedRoleId) ?? null;
  const isAdminRole = selectedRole?.key === 'admin';
  const roleName = (r: RoleRow) => roleManagementLabel(r, locale, tLevel);

  const isOn = (permId: string) =>
    isAdminRole || (grantedMap[selectedRoleId]?.has(permId) ?? false);

  const toggle = (permId: string) => {
    if (isAdminRole) {
      toast.error(t('toast.adminLocked'));
      return;
    }
    const next = !(grantedMap[selectedRoleId]?.has(permId) ?? false);
    setGrantedMap((prev) => withToggle(prev, selectedRoleId, permId, next));
    startTransition(async () => {
      const res = await toggleRolePermissionAction(selectedRoleId, permId, next);
      if (!res.ok) {
        setGrantedMap((prev) => withToggle(prev, selectedRoleId, permId, !next));
        toast.error(t('toast.failed'));
      }
    });
  };

  return (
    <div className="space-y-5">
      <div
        role="tablist"
        aria-label={t('title')}
        className="flex flex-wrap gap-2"
      >
        {roles.map((r) => {
          const active = r.id === selectedRoleId;
          return (
            <button
              key={r.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSelectedRoleId(r.id)}
              className={[
                'inline-flex items-center gap-1.5 px-3 h-9 rounded-lg text-sm font-medium border transition',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/50',
                active
                  ? 'bg-brand-black text-white border-brand-black'
                  : 'bg-white border-neutral-200 text-neutral-700 hover:border-brand-gold-text',
              ].join(' ')}
            >
              {roleName(r)}
              {r.key === 'admin' && <Lock className="size-3" aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      {isAdminRole && (
        <div
          role="note"
          className="rounded-lg border border-brand-gold/40 bg-brand-gold-soft px-3 py-2 text-sm text-neutral-800"
        >
          {t('adminLocked')}
        </div>
      )}

      <div className="rounded-xl border border-neutral-200 bg-white divide-y divide-neutral-100 overflow-hidden">
        {CATEGORY_ORDER.filter((c) => grouped[c]?.length).map((category) => (
          <div key={category} role="group" aria-labelledby={`perm-cat-${category}`}>
            <div
              id={`perm-cat-${category}`}
              className="px-4 py-2 bg-neutral-50/70 text-xs font-semibold text-neutral-700 uppercase tracking-wide"
            >
              {t(`categories.${category}`)}
            </div>
            {grouped[category]!.map((perm) => {
              const on = isOn(perm.id);
              const permLabel = locale === 'he' ? perm.name_he : perm.name_en;
              return (
                <div
                  key={perm.id}
                  className="flex items-center justify-between px-4 py-2.5 hover:bg-neutral-50/60"
                >
                  <span className="text-sm text-neutral-800">{permLabel}</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    aria-label={permLabel}
                    disabled={isAdminRole || pending}
                    onClick={() => toggle(perm.id)}
                    className={[
                      'relative w-10 h-6 rounded-full transition-colors shrink-0',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40',
                      on ? 'bg-brand-gold-text' : 'bg-neutral-400',
                      isAdminRole ? 'opacity-60 cursor-not-allowed' : '',
                    ].join(' ')}
                  >
                    <span
                      aria-hidden="true"
                      className={[
                        'absolute top-0.5 size-5 rounded-full bg-white shadow flex items-center justify-center transition-all',
                        on ? 'start-[1.125rem]' : 'start-0.5',
                      ].join(' ')}
                    >
                      {on && <Check className="size-3 text-brand-gold-text" />}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function buildMap(granted: Record<string, string[]>): Record<string, Set<string>> {
  const map: Record<string, Set<string>> = {};
  for (const [roleId, ids] of Object.entries(granted)) map[roleId] = new Set(ids);
  return map;
}

function withToggle(
  prev: Record<string, Set<string>>,
  roleId: string,
  permId: string,
  on: boolean,
): Record<string, Set<string>> {
  const set = new Set(prev[roleId] ?? []);
  if (on) set.add(permId);
  else set.delete(permId);
  return { ...prev, [roleId]: set };
}

function groupByCategory(
  permissions: PermissionRow[],
): Partial<Record<PermissionCategory, PermissionRow[]>> {
  const out: Partial<Record<PermissionCategory, PermissionRow[]>> = {};
  for (const p of permissions) (out[p.category] ??= []).push(p);
  return out;
}
