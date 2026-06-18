'use client';

import { useMemo, useState, useTransition } from 'react';

import { Check, Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { roleManagementLabel } from '@/lib/auth/role-label';
import type { Locale } from '@/lib/i18n/direction';

import { toggleRolePermissionAction } from '../actions/toggle-role-permission';
import { HIDDEN_PERMISSION_KEYS } from '../permissions.constants';
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

// Hidden (unenforced) permission keys + rationale live in
// ../permissions.constants.ts — shared with the server action so the hide is
// enforced on WRITE too (R3-roles-4), not only in this render filter.

export function RolesPermissionsEditor({ roles, permissions, granted, locale }: Props) {
  const t = useTranslations('settings.roles');
  const tLevel = useTranslations('settings.roles.levels');

  const [selectedRoleId, setSelectedRoleId] = useState(
    () => roles.find((r) => r.key !== 'admin')?.id ?? roles[0]?.id ?? '',
  );
  const [pending, startTransition] = useTransition();

  // Optimistic grant toggles, keyed `${roleId}:${permId}` -> desired value.
  // They take precedence over the server `granted` prop and SURVIVE a
  // revalidation until a fresh prop confirms them. Without this, the post-save
  // route refetch (which may not yet reflect the just-saved change — a
  // revalidation/cache race) would overwrite the toggle the server already
  // accepted, and the switch would visually "jump back".
  const [overrides, setOverrides] = useState<Map<string, boolean>>(() => new Map());

  // When new server props arrive, drop only the overrides the server now agrees
  // with; overrides the (possibly stale) prop hasn't caught up to are preserved.
  const [syncedRef, setSyncedRef] = useState(granted);
  if (syncedRef !== granted) {
    setSyncedRef(granted);
    setOverrides((prev) => reconcileOverrides(prev, granted));
  }

  const grouped = useMemo(
    () => groupByCategory(permissions.filter((p) => !HIDDEN_PERMISSION_KEYS.has(p.key))),
    [permissions],
  );
  const selectedRole = roles.find((r) => r.id === selectedRoleId) ?? null;
  const isAdminRole = selectedRole?.key === 'admin';
  const roleName = (r: RoleRow) => roleManagementLabel(r, locale, tLevel);

  const permKey = (permId: string) => `${selectedRoleId}:${permId}`;

  const isOn = (permId: string) => {
    if (isAdminRole) return true;
    const override = overrides.get(permKey(permId));
    return override ?? (granted[selectedRoleId]?.includes(permId) ?? false);
  };

  const toggle = (permId: string) => {
    if (isAdminRole) {
      toast.error(t('toast.adminLocked'));
      return;
    }
    const key = permKey(permId);
    const next = !isOn(permId);
    setOverrides((prev) => new Map(prev).set(key, next));
    startTransition(async () => {
      const res = await toggleRolePermissionAction(selectedRoleId, permId, next);
      if (!res.ok) {
        // Revert to server truth on failure (drop the optimistic override).
        setOverrides((prev) => {
          const map = new Map(prev);
          map.delete(key);
          return map;
        });
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

      {/* Per-user overrides take FIRST precedence over these role switches
          (has_permission resolves user_permission_overrides before role
          grants). No UI writes them yet (Phase 2), but a restored backup can
          carry them — surface the precedence so this screen never silently
          misrepresents a member's effective permissions (R3-roles-6). */}
      {!isAdminRole && (
        <p className="text-xs text-neutral-500">{t('overridesNote')}</p>
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

/**
 * Drop the optimistic overrides the server `granted` prop now reflects (server
 * has caught up); keep the rest. Returns the SAME reference when nothing
 * changes, so the render-phase reconcile can't loop. Role/permission ids are
 * UUIDs (no ':'), so splitting the key on the first ':' is unambiguous.
 */
function reconcileOverrides(
  prev: Map<string, boolean>,
  granted: Record<string, string[]>,
): Map<string, boolean> {
  if (prev.size === 0) return prev;
  const next = new Map(prev);
  for (const [key, desired] of prev) {
    const sep = key.indexOf(':');
    const roleId = key.slice(0, sep);
    const permId = key.slice(sep + 1);
    const serverHas = granted[roleId]?.includes(permId) ?? false;
    if (serverHas === desired) next.delete(key);
  }
  return next.size === prev.size ? prev : next;
}

function groupByCategory(
  permissions: PermissionRow[],
): Partial<Record<PermissionCategory, PermissionRow[]>> {
  const out: Partial<Record<PermissionCategory, PermissionRow[]>> = {};
  for (const p of permissions) (out[p.category] ??= []).push(p);
  return out;
}
