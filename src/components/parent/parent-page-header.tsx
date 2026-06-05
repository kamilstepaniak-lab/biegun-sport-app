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
    <section className={cn('parent-page-hero rounded-[14px] bg-blue-600 p-4 text-white shadow-sm sm:p-7 lg:p-9', className)}>
      <div className="grid gap-6 lg:grid-cols-[1fr_0.7fr] lg:items-center">
        <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[14px] bg-white/12 ring-1 ring-white/10 sm:h-[88px] sm:w-[88px]">
            <Icon className="h-10 w-10 text-white" strokeWidth={1.9} />
          </div>
          <div className="min-w-0">
            <h1 className="text-4xl font-black leading-none tracking-normal text-white sm:text-5xl">
              {title}
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-blue-50 sm:text-lg">
              {description}
            </p>
          </div>
        </div>

        {note && (
          <div className="hidden border-l border-white/16 pl-8 lg:flex lg:items-center lg:gap-5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/70 text-blue-600">
              <Info className="h-6 w-6" />
            </span>
            <p className="max-w-sm text-base leading-relaxed text-blue-50">{note}</p>
          </div>
        )}
      </div>

      {children && (
        <div className="mt-7 rounded-[12px] bg-white p-4 text-slate-900 shadow-sm ring-1 ring-blue-950/5 sm:p-5">
          {children}
        </div>
      )}
    </section>
  );
}
