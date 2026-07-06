'use client';

import { useMemo, useState, useTransition } from 'react';

import { Check, Lock, RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import type { Locale } from '@/lib/i18n/direction';

import { setUserPermissionAction } from '../actions/set-user-permission';
import { HIDDEN_PERMISSION_KEYS } from '../permissions.constants';
import type { PermissionCategory, PermissionRow } from '../services/permissions.service';

export type PermMember = {
  id: string;
  name: string;
  roleId: string | null;
  roleName: string;
  isAdmin: boolean;
};

type Props = {
  members: PermMember[];
  permissions: PermissionRow[];
  /** roleId → granted permissionIds (the role default). */
  granted: Record<string, string[]>;
  /** userId → (permissionId → is_granted) — per-user exceptions. */
  overrides: Record<string, Record<string, boolean>>;
  locale: Locale;
};

const CATEGORY_ORDER: PermissionCategory[] = ['view', 'cases', 'leads', 'documents', 'financial', 'system'];

function flatten(o: Record<string, Record<string, boolean>>): Map<string, boolean> {
  const m = new Map<string, boolean>();
  for (const [userId, perms] of Object.entries(o))
    for (const [permId, on] of Object.entries(perms)) m.set(`${userId}:${permId}`, on);
  return m;
}

export function UserPermissionsEditor({ members, permissions, granted, overrides, locale }: Props) {
  const t = useTranslations('settings.userPermissions');

  const [selectedUserId, setSelectedUserId] = useState(
    () => members.find((m) => !m.isAdmin)?.id ?? members[0]?.id ?? '',
  );
  // Seeded once on mount; a save revalidates /settings/people, so a tab switch
  // (which unmounts this editor) re-seeds from fresh server data on re-entry.
  const [ov, setOv] = useState<Map<string, boolean>>(() => flatten(overrides));
  const [pending, startTransition] = useTransition();

  const grouped = useMemo(
    () => groupByCategory(permissions.filter((p) => !HIDDEN_PERMISSION_KEYS.has(p.key))),
    [permissions],
  );

  const selected = members.find((m) => m.id === selectedUserId) ?? null;
  const roleGranted = useMemo(
    () => new Set(selected?.roleId ? (granted[selected.roleId] ?? []) : []),
    [granted, selected],
  );

  const key = (permId: string) => `${selectedUserId}:${permId}`;
  const hasOverride = (permId: string) => ov.has(key(permId));
  const roleDefaultOn = (permId: string) => roleGranted.has(permId);
  const isOn = (permId: string) => (hasOverride(permId) ? ov.get(key(permId))! : roleDefaultOn(permId));

  const save = (permId: string, mode: 'grant' | 'revoke' | 'reset', optimistic: Map<string, boolean>) => {
    const prev = ov;
    setOv(optimistic);
    startTransition(async () => {
      const res = await setUserPermissionAction(selectedUserId, permId, mode);
      if (!res.ok) {
        setOv(prev);
        toast.error(t(res.error === 'admin_locked' ? 'toast.adminLocked' : 'toast.failed'));
      }
    });
  };

  const toggle = (permId: string) => {
    if (!selected || selected.isAdmin) return;
    const next = !isOn(permId);
    save(permId, next ? 'grant' : 'revoke', new Map(ov).set(key(permId), next));
  };

  const reset = (permId: string) => {
    if (!selected || selected.isAdmin || !hasOverride(permId)) return;
    const map = new Map(ov);
    map.delete(key(permId));
    save(permId, 'reset', map);
  };

  return (
    <div className="space-y-5">
      {/* Member picker */}
      <div role="tablist" aria-label={t('title')} className="flex flex-wrap gap-2">
        {members.map((m) => {
          const active = m.id === selectedUserId;
          return (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSelectedUserId(m.id)}
              className={[
                'inline-flex items-center gap-1.5 px-3 h-9 rounded-lg text-sm font-medium border transition',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/50',
                active
                  ? 'bg-brand-black text-white border-brand-black'
                  : 'bg-white border-neutral-200 text-neutral-700 hover:border-brand-gold-text',
              ].join(' ')}
            >
              {m.name}
              {m.isAdmin && <Lock className="size-3" aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      {selected && (
        <p className="text-xs text-neutral-500">
          {t('roleDefault', { role: selected.roleName || '—' })}
        </p>
      )}

      {selected?.isAdmin && (
        <div
          role="note"
          className="rounded-lg border border-brand-gold/40 bg-brand-gold-soft px-3 py-2 text-sm text-neutral-800"
        >
          {t('adminLocked')}
        </div>
      )}

      <div className="rounded-xl border border-neutral-200 bg-white divide-y divide-neutral-100 overflow-hidden">
        {CATEGORY_ORDER.filter((c) => grouped[c]?.length).map((category) => (
          <div key={category} role="group" aria-labelledby={`uperm-cat-${category}`}>
            <div
              id={`uperm-cat-${category}`}
              className="px-4 py-2 bg-neutral-50/70 text-xs font-semibold text-neutral-700 uppercase tracking-wide"
            >
              {t(`categories.${category}`)}
            </div>
            {grouped[category]!.map((perm) => {
              const on = isOn(perm.id);
              const custom = hasOverride(perm.id);
              const label = locale === 'he' ? perm.name_he : perm.name_en;
              const locked = !selected || selected.isAdmin;
              return (
                <div key={perm.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-50/60">
                  <span className="flex-1 text-sm text-neutral-800">{label}</span>
                  {custom && !locked && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-brand-gold-text">
                      {t('custom')}
                      <button
                        type="button"
                        aria-label={t('resetToDefault')}
                        title={t('resetToDefault')}
                        disabled={pending}
                        onClick={() => reset(perm.id)}
                        className="tap-target text-neutral-400 hover:text-brand-gold-text transition"
                      >
                        <RotateCcw className="size-3.5" aria-hidden="true" />
                      </button>
                    </span>
                  )}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    aria-label={label}
                    disabled={locked || pending}
                    onClick={() => toggle(perm.id)}
                    className={[
                      'relative w-10 h-6 rounded-full transition-colors shrink-0',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40',
                      on ? 'bg-brand-gold-text' : 'bg-neutral-400',
                      locked ? 'opacity-60 cursor-not-allowed' : '',
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

function groupByCategory(
  permissions: PermissionRow[],
): Partial<Record<PermissionCategory, PermissionRow[]>> {
  const out: Partial<Record<PermissionCategory, PermissionRow[]>> = {};
  for (const p of permissions) (out[p.category] ??= []).push(p);
  return out;
}
