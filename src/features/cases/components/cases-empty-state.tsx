import Link from 'next/link';

import { FolderOpen, Plus } from 'lucide-react';

export function CasesEmptyState() {
  return (
    <div className="bg-white border-t border-neutral-200 p-20 text-center">
      <div className="size-16 mx-auto rounded-full bg-neutral-100 flex items-center justify-center mb-4">
        <FolderOpen className="size-8 text-neutral-400" />
      </div>
      <p className="text-neutral-600 mb-1 text-base font-medium">אין עדיין תיקים פעילים</p>
      <p className="text-sm text-neutral-500 mb-5">
        צור תיק ראשון או ייבא נתונים מ-Excel קיים
      </p>
      <Link
        href="/cases/new"
        className="btn-gold inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm"
      >
        <Plus className="size-4" />
        פתיחת תיק חדש
      </Link>
    </div>
  );
}
