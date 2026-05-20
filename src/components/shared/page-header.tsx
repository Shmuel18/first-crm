import type { ReactNode } from 'react';

type PageHeaderProps = {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  rightSlot?: ReactNode;
};

/**
 * Full-bleed premium page banner (gold icon chip + display-font title) used by
 * top-level app pages. Cancels the layout's p-6 padding so it spans edge to
 * edge under the topbar, mirroring the dashboard welcome banner.
 */
export function PageHeader({ icon, title, subtitle, rightSlot }: PageHeaderProps) {
  return (
    <div className="-mx-6 -mt-6 bg-gradient-to-l from-[#FAFAFA] via-white to-[#FAFAFA] px-6 py-5 border-b border-neutral-200">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="size-11 rounded-xl bg-[#FFF8E7] text-[#A88840] border border-[#E8D5A2] flex items-center justify-center [&_svg]:size-5">
            {icon}
          </span>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-neutral-900 leading-tight">
              {title}
            </h1>
            {subtitle && <p className="text-sm text-neutral-500 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {rightSlot && <div className="flex items-center gap-2">{rightSlot}</div>}
      </div>
    </div>
  );
}
