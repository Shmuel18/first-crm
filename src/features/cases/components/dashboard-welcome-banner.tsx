import { getGreeting, getInsight } from '../domain/greeting';

type Props = {
  firstName: string;
  casesCount: number;
  stuckCount: number;
};

export function DashboardWelcomeBanner({ firstName, casesCount, stuckCount }: Props) {
  const greeting = getGreeting();
  const insight = getInsight(casesCount, stuckCount);

  return (
    <div className="bg-gradient-to-l from-[#FAFAFA] via-white to-[#FAFAFA] px-6 py-5 border-b border-neutral-200">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl text-neutral-900 leading-tight">
            {greeting}
            {firstName && (
              <>
                , <span className="text-[#C9A961]">{firstName}</span>
              </>
            )}
          </h1>
          {insight && <p className="text-sm text-neutral-500 mt-1">{insight}</p>}
        </div>
        <div className="text-xs text-neutral-400">
          {new Date().toLocaleDateString('he-IL', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </div>
      </div>
    </div>
  );
}
