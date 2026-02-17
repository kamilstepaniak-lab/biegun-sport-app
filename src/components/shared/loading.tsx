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
