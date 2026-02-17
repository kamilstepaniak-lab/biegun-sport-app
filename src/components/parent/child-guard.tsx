'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Users, X } from 'lucide-react';

interface ChildGuardProps {
  /** ID wybranego dziecka — przekazywane z searchParams po stronie serwera */
  selectedChildId?: string;
  /** Nazwa dziecka do wyświetlenia w bannerze (opcjonalna) */
  selectedChildName?: string;
  children: React.ReactNode;
}

export function ChildGuard({ selectedChildId, selectedChildName, children }: ChildGuardProps) {
  const pathname = usePathname();

  if (!selectedChildId) {
    return (
      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-12 flex flex-col items-center text-center gap-5">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
          <Users className="h-8 w-8 text-gray-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Wybierz dziecko</h3>
          <p className="text-sm text-gray-500 max-w-sm">
            Aby zobaczyć tę sekcję, najpierw wybierz dziecko w zakładce <strong>Moje dzieci</strong>.
          </p>
        </div>
        <Link
          href="/parent/children"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-xl transition-colors"
        >
          <Users className="h-4 w-4" />
          Przejdź do Moje dzieci
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Banner wybranego dziecka */}
      <div className="bg-gray-900 rounded-2xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white font-bold text-sm">
            {(selectedChildName || 'D').charAt(0)}
          </div>
          <div>
            <p className="text-xs text-gray-400">Przeglądasz dane dla</p>
            <p className="text-sm font-semibold text-white">{selectedChildName || 'Wybrane dziecko'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/parent/children"
            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors"
          >
            Zmień
          </Link>
          {/* Link "X" czyści child z URL */}
          <Link
            href={pathname}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <X className="h-4 w-4 text-white" />
          </Link>
        </div>
      </div>
      {children}
    </div>
  );
}
