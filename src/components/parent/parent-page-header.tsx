import type { LucideIcon } from 'lucide-react';
import { Info } from 'lucide-react';

import { cn } from '@/lib/utils';

interface ParentPageHeaderProps {
  icon: LucideIcon;
  title: string;
  description: React.ReactNode;
  note?: string;
  hideIcon?: boolean;
  /**
   * Tło nagłówka rozpływa się ku dołowi w przezroczystość (zamiast twardego
   * fade do koloru) — dolna krawędź wtapia się bezszwowo w tło strony pod
   * spodem. Dla pełnoszerokościowych nagłówków bez ramki (np. Wyjazdy).
   */
  seamlessBottom?: boolean;
  /** Slot na narzędzia specyficzne dla podstrony (np. wyszukiwarka) — po lewej od wyboru dziecka. */
  tools?: React.ReactNode;
  /** Zwykle <ParentChildSelector>. Renderowane w dolnym pasku nagłówka. */
  children?: React.ReactNode;
  className?: string;
}

export function ParentPageHeader({
  icon: Icon,
  title,
  description,
  note,
  hideIcon = true,
  seamlessBottom = true,
  tools,
  children,
  className,
}: ParentPageHeaderProps) {
  const hasBottomRow = Boolean(tools || children);

  return (
    <section
      className={cn(
        // STAŁA wysokość (nie min-h) + flex-col: tytuł zawsze na górze,
        // dolny pasek (wyszukiwarka + wybór dziecka) zawsze przyklejony do dołu
        // (mt-auto). Dzięki temu przy przełączaniu podstron tytuł, opis i
        // przyciski stoją w tym samym miejscu, a grafika gór ma zawsze tę samą
        // wysokość i rozmiar. Mobile wyższy (dolny pasek stackuje się <640px)
        // i z min-h zamiast h: przy jednej linii chipów selektora wysokość to
        // nadal dokładnie 348px, a gdy chipy zawiną się do drugiej linii
        // (3+ dzieci), hero rośnie zamiast ucinać treść (overflow-hidden).
        'parent-page-hero relative flex min-h-[348px] flex-col overflow-hidden px-4 pb-12 pt-6 text-slate-900 sm:h-[300px] sm:min-h-0 sm:px-7 sm:pb-12 sm:pt-8 lg:h-[320px] lg:px-10 lg:pb-14 lg:pt-10',
        seamlessBottom ? 'bg-transparent' : 'rounded-[16px] border border-blue-100/70 bg-[#eef6ff] shadow-[0_10px_28px_rgba(15,23,42,0.08)]',
        className,
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          "absolute inset-0 bg-[linear-gradient(90deg,rgba(248,251,255,0.98)_0%,rgba(248,251,255,0.92)_30%,rgba(248,251,255,0.35)_58%,rgba(248,251,255,0.12)_100%),url('/parent-hero-mountains.svg')] bg-[length:100%_100%,auto_100%] bg-[position:left_top,right_bottom] bg-no-repeat",
          // Tło (kolor + góry) rozpływa się ku dołowi w przezroczystość, więc
          // pod spodem widać prawdziwy gradient strony — brak twardej krawędzi.
          // Maska dotyczy tylko tej warstwy dekoracyjnej; treść (z-10) zostaje ostra.
          seamlessBottom &&
            'bg-[#eef6ff] [-webkit-mask-image:linear-gradient(to_bottom,#000_50%,transparent_100%)] [mask-image:linear-gradient(to_bottom,#000_50%,transparent_100%)]',
        )}
      />
      {!seamlessBottom && (
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 z-[1] h-24 bg-gradient-to-b from-transparent via-[#f8fbff]/80 to-[#f8fafc]"
        />
      )}

      <div className="relative z-10 flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
        {!hideIcon && (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[16px] bg-blue-100/70 text-blue-500 shadow-sm ring-1 ring-blue-200/50 sm:h-16 sm:w-16">
            <Icon className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={1.8} />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-4xl font-black leading-none tracking-normal text-slate-950 sm:text-5xl lg:text-[52px]">
            {title}
          </h1>
          <p className="mt-5 max-w-2xl text-sm font-medium leading-relaxed text-slate-600 sm:text-[15px]">
            {description}
          </p>
          {note && (
            <p className="mt-3 inline-flex items-start gap-2 text-sm leading-snug text-slate-500">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
              {note}
            </p>
          )}
        </div>
      </div>

      {hasBottomRow && (
        <div
          className={cn(
            'relative z-10 mt-auto grid gap-4 sm:items-start',
            tools
              ? 'sm:grid-cols-[minmax(200px,360px)_1px_minmax(0,1fr)]'
              : 'grid-cols-1',
          )}
        >
          {tools && <div className="min-w-0">{tools}</div>}
          {tools && children && <div className="hidden h-full min-h-20 w-px bg-slate-300/80 sm:block" />}
          {children && <div className="min-w-0">{children}</div>}
        </div>
      )}
    </section>
  );
}
