'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { Bookmark, ChevronDown, Star, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';

import { DashboardExportButtons } from './dashboard-export-buttons';

type SavedView = { id: string; name: string; query: string };

const STORAGE_KEY = 'kfg.savedViews';

function loadViews(): SavedView[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(raw) ? (raw as SavedView[]) : [];
  } catch {
    return [];
  }
}

function persistViews(views: SavedView[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
  } catch {
    // localStorage unavailable (private mode) — saved views just won't persist.
  }
}

export function DashboardSavedViews() {
  const t = useTranslations('dashboard.savedViews');
  const tc = useTranslations('common');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [views, setViews] = useState<SavedView[]>(loadViews);
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState('');

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const next = [
      ...views.filter((v) => v.name !== trimmed),
      { id: crypto.randomUUID(), name: trimmed, query: searchParams.toString() },
    ];
    setViews(next);
    persistViews(next);
    setSaveOpen(false);
    toast.success(t('savedToast', { name: trimmed }));
  };

  const applyView = (v: SavedView) => {
    router.push(v.query ? `${pathname}?${v.query}` : pathname);
  };

  const removeView = (id: string) => {
    const next = views.filter((v) => v.id !== id);
    setViews(next);
    persistViews(next);
  };

  return (
    <div className="bg-white px-6 py-2 border-b border-neutral-200 flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 text-xs text-neutral-700 hover:bg-neutral-50 transition">
              <Bookmark className="size-3.5" />
              {t('saved')}
              <ChevronDown className="size-3.5" />
            </button>
          }
        />
        <DropdownMenuContent align="start" className="min-w-52">
          {views.length === 0 ? (
            <div className="px-2 py-1.5 text-xs text-neutral-400">{t('none')}</div>
          ) : (
            views.map((v) => (
              <DropdownMenuItem
                key={v.id}
                onClick={() => applyView(v)}
                className="justify-between gap-2"
              >
                <span className="truncate">{v.name}</span>
                <span
                  role="button"
                  tabIndex={-1}
                  aria-label={t('delete')}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeView(v.id);
                  }}
                  className="text-neutral-400 hover:text-rose-600"
                >
                  <X className="size-3.5" />
                </span>
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <button
        type="button"
        onClick={() => {
          setName('');
          setSaveOpen(true);
        }}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#C9A961] hover:bg-[#C9A961]/10 transition"
      >
        <Star className="size-3.5" />
        {t('saveCurrent')}
      </button>

      <div className="flex-1" />
      <DashboardExportButtons />

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('saveCurrent')}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
            className="space-y-4"
          >
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('namePlaceholder')}
              maxLength={60}
            />
            <DialogFooter>
              <Button
                type="submit"
                disabled={!name.trim()}
                className="bg-[#C9A961] hover:bg-[#E8D5A2] text-[#0A0A0A] font-semibold"
              >
                {tc('save')}
              </Button>
              <Button type="button" variant="outline" onClick={() => setSaveOpen(false)}>
                {tc('cancel')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
