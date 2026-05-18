import { CheckCircle2, Clock, FolderArchive } from 'lucide-react';
import { useTranslations } from 'next-intl';

type Props = {
  total: number;
  verified: number;
  pending: number;
};

export function DocumentsSummary({ total, verified, pending }: Props) {
  const t = useTranslations('documents.summary');

  if (total === 0) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-500 text-center">
        {t('empty')}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm">
      <Stat
        icon={<FolderArchive className="size-4 text-neutral-500" />}
        text={t('total', { count: total })}
      />
      {verified > 0 && (
        <Stat
          icon={<CheckCircle2 className="size-4 text-emerald-600" />}
          text={t('verified', { count: verified })}
        />
      )}
      {pending > 0 && (
        <Stat
          icon={<Clock className="size-4 text-yellow-600" />}
          text={t('pending', { count: pending })}
        />
      )}
    </div>
  );
}

function Stat({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-neutral-700">
      {icon}
      {text}
    </span>
  );
}
