'use client';

import { CalendarDays, Search, X } from 'lucide-react';
import { useState } from 'react';

import { ChildGuard } from '@/components/parent/child-guard';
import { ParentChildSelector, type ParentChildOption } from '@/components/parent/parent-child-selector';
import { EmptyState } from '@/components/shared';
import { Input } from '@/components/ui/input';
import type { TripForParent } from '@/lib/actions/trips';
import { ParentTripsList } from './trips-list';

interface ParentTripsShellProps {
  trips: TripForParent[];
  selectedChildId?: string;
  childName?: string;
  childrenList: ParentChildOption[];
  awaitingGroup: boolean;
}

export function ParentTripsShell({
  trips,
  selectedChildId,
  childName,
  childrenList,
  awaitingGroup,
}: ParentTripsShellProps) {
  const [query, setQuery] = useState('');

  return (
    <div className="space-y-6">
      <section className="parent-trips-hero rounded-[14px] bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80">
        <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(260px,340px)_minmax(360px,1.1fr)] lg:items-start lg:p-6">
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[12px] bg-blue-50 text-blue-600 ring-1 ring-blue-100 sm:h-14 sm:w-14">
              <CalendarDays className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={1.9} />
            </div>
            <div className="min-w-0">
              <h1 className="text-3xl font-black leading-tight tracking-normal text-slate-950 sm:text-[34px]">
                Wyjazdy
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500 sm:text-[15px]">
                Zarządzaj wyjazdami Twoich dzieci w jednym miejscu. Przeglądaj listę, sprawdzaj szczegóły i dodawaj nowe zgłoszenia.
              </p>
            </div>
          </div>

          <div className="space-y-2 lg:border-l lg:border-slate-200 lg:pl-5">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-normal text-blue-700">
              <Search className="h-3.5 w-3.5" />
              Nazwa wyjazdu
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Wpisz nazwę wyjazdu..."
                className="h-10 rounded-[10px] border-slate-200 bg-slate-50 pl-9 pr-9 text-sm text-slate-900 shadow-none focus-visible:bg-white focus-visible:ring-blue-500"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Wyczyść wyszukiwanie"
                  className="absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="lg:border-l lg:border-slate-200 lg:pl-5">
            <ParentChildSelector
              selectedChildId={selectedChildId}
              selectedChildName={childName}
              childrenList={childrenList}
              variant="compact"
            />
          </div>
        </div>
      </section>

      <ChildGuard
        selectedChildId={selectedChildId}
        selectedChildName={childName}
        childrenList={childrenList}
        showSelector={false}
      >
        {trips.length === 0 ? (
          awaitingGroup ? (
            <EmptyState
              icon={CalendarDays}
              title="Dziecko czeka na przypisanie do grupy"
              description="Organizator nie przypisał jeszcze dziecka do grupy treningowej. Po przypisaniu zobaczysz tutaj dostępne wyjazdy."
            />
          ) : (
            <EmptyState
              icon={CalendarDays}
              title="Brak dostępnych wyjazdów"
              description="Aktualnie nie ma wyjazdów dla grup tego dziecka."
            />
          )
        ) : (
          <ParentTripsList trips={trips} searchQuery={query} />
        )}
      </ChildGuard>
    </div>
  );
}
