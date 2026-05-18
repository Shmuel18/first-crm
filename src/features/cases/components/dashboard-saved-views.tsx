import { Bookmark, ChevronDown, Star } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { DashboardExportButtons } from './dashboard-export-buttons';

export function DashboardSavedViews() {
  const t = useTranslations('dashboard.savedViews');

  return (
    <div className="bg-white px-6 py-2 border-b border-neutral-200 flex items-center gap-2">
      <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 text-xs text-neutral-700 hover:bg-neutral-50 transition">
        <Bookmark className="size-3.5" />
        {t('saved')}
        <ChevronDown className="size-3.5" />
      </button>
      <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#C9A961] hover:bg-[#C9A961]/10 transition">
        <Star className="size-3.5" />
        {t('saveCurrent')}
      </button>
      <div className="flex-1" />
      <DashboardExportButtons />
    </div>
  );
}
