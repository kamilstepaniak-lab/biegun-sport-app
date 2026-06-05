import type { LucideIcon } from 'lucide-react';
import { Info } from 'lucide-react';

import { cn } from '@/lib/utils';

interface ParentPageHeaderProps {
  icon: LucideIcon;
  title: string;
  description: string;
  note?: string;
  children?: React.ReactNode;
  className?: string;
}

export function ParentPageHeader({
  icon: Icon,
  title,
  description,
  note,
  children,
  className,
}: ParentPageHeaderProps) {
  return (
    <section className={cn('parent-page-hero rounded-[14px] bg-blue-600 p-4 text-white shadow-sm sm:p-5 lg:p-6', className)}>
      <div className="grid gap-4 lg:grid-cols-[1fr_0.62fr] lg:items-center">
        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[12px] bg-white/12 ring-1 ring-white/10 sm:h-16 sm:w-16">
            <Icon className="h-7 w-7 text-white sm:h-8 sm:w-8" strokeWidth={1.9} />
          </div>
          <div className="min-w-0">
            <h1 className="text-3xl font-black leading-tight tracking-normal text-white sm:text-[34px]">
              {title}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-blue-50 sm:text-[15px]">
              {description}
            </p>
          </div>
        </div>

        {note && (
          <div className="hidden border-l border-white/16 pl-6 lg:flex lg:items-center lg:gap-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/70 text-blue-600">
              <Info className="h-5 w-5" />
            </span>
            <p className="max-w-sm text-sm leading-relaxed text-blue-50">{note}</p>
          </div>
        )}
      </div>

      {children && (
        <div className="mt-5 rounded-[12px] bg-white p-3 text-slate-900 shadow-sm ring-1 ring-blue-950/5 sm:p-4">
          {children}
        </div>
      )}
    </section>
  );
}
