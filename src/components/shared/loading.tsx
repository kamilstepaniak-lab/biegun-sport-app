import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingProps {
  className?: string;
  text?: string;
}

export function Loading({ className, text = 'Ładowanie...' }: LoadingProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center p-8', className)}>
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 mb-3">
        <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
      </div>
      <p className="text-sm text-gray-500">{text}</p>
    </div>
  );
}

export function PageLoading() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Loading />
    </div>
  );
}

export function FullPageLoading() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-[#f8f9fb]">
      <Loading />
    </div>
  );
}

/**
 * Skeleton całej podstrony: placeholder nagłówka hero (góry) + bloki treści.
 * Odwzorowuje stały układ stron (hero ma te same wysokości co prawdziwy),
 * więc przejścia między podstronami nie "skaczą" — jak w natywnej aplikacji.
 * Używany w route-level loading.tsx obu paneli.
 */
export function PageSkeleton({ variant = 'admin' }: { variant?: 'admin' | 'parent' }) {
  return (
    <div>
      {variant === 'admin' ? (
        // Hero admina — klasa .page-header daje pełny bleed, tło z górami
        // i sztywną wysokość z globals.css (jak na prawdziwych podstronach).
        <div className="page-header flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="page-header-copy">
            <div className="h-10 w-56 max-w-full animate-pulse rounded-xl bg-slate-900/10" />
            <div className="mt-5 h-4 w-80 max-w-full animate-pulse rounded bg-slate-900/10" />
          </div>
        </div>
      ) : (
        // Hero rodzica — te same klasy wymiarów co ParentPageHeader (seamless).
        <section className="parent-page-hero relative flex h-[348px] flex-col overflow-hidden px-4 pb-12 pt-6 sm:h-[300px] sm:px-7 sm:pb-12 sm:pt-8 lg:h-[320px] lg:px-10 lg:pb-14 lg:pt-10">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[#eef6ff] bg-[linear-gradient(90deg,rgba(248,251,255,0.98)_0%,rgba(248,251,255,0.92)_30%,rgba(248,251,255,0.35)_58%,rgba(248,251,255,0.12)_100%),url('/parent-hero-mountains.svg')] bg-[length:100%_100%,auto_100%] bg-[position:left_top,right_bottom] bg-no-repeat [-webkit-mask-image:linear-gradient(to_bottom,#000_50%,transparent_100%)] [mask-image:linear-gradient(to_bottom,#000_50%,transparent_100%)]"
          />
          <div className="relative z-10">
            <div className="h-10 w-56 max-w-full animate-pulse rounded-xl bg-slate-900/10" />
            <div className="mt-5 h-4 w-72 max-w-full animate-pulse rounded bg-slate-900/10" />
          </div>
          <div className="relative z-10 mt-auto h-14 w-full max-w-md animate-pulse rounded-2xl bg-white/60" />
        </section>
      )}

      <div className="space-y-4 pt-2">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-200/60" />
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-200/60" />
          ))}
        </div>
      </div>
    </div>
  );
}
