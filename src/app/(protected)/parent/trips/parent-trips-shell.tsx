'use client';

import { Backpack, Search, X } from 'lucide-react';
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
      <section className="parent-trips-hero relative overflow-hidden rounded-[16px] border border-blue-100/70 bg-[#eef6ff] px-4 pb-5 pt-6 text-slate-900 shadow-[0_10px_28px_rgba(15,23,42,0.08)] sm:px-7 sm:pb-7 sm:pt-8 lg:min-h-[285px] lg:px-10 lg:pb-10 lg:pt-10">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(90deg,rgba(248,251,255,0.98)_0%,rgba(248,251,255,0.92)_30%,rgba(248,251,255,0.35)_58%,rgba(248,251,255,0.12)_100%),url('/parent-hero-mountains.svg')] bg-[length:100%_100%,auto_100%] bg-[position:left_top,right_bottom] bg-no-repeat"
        />
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 z-[1] h-24 bg-gradient-to-b from-transparent via-[#f8fbff]/80 to-[#f8fafc]"
        />
        <div className="relative z-10 flex min-w-0 flex-col">
          <div className="min-w-0">
            <h1 className="text-4xl font-black leading-none tracking-normal text-slate-950 sm:text-5xl lg:text-[52px]">
              Wyjazdy
            </h1>
            <p className="mt-3 max-w-2xl text-sm font-medium leading-relaxed text-slate-600 sm:text-[15px]">
              Zarządzaj wyjazdami Twoich dzieci w jednym miejscu.
              <br className="hidden sm:block" />
              Przeglądaj listę, sprawdzaj szczegóły i dodawaj nowe zgłoszenia.
            </p>
          </div>
        </div>

        <div className="relative z-10 mt-7 grid gap-4 lg:mt-10 lg:grid-cols-[minmax(260px,390px)_1px_minmax(0,1fr)] lg:items-end">
          <div className="rounded-[12px] bg-white/86 p-3.5 shadow-[0_10px_24px_rgba(15,23,42,0.08)] ring-1 ring-slate-200/80 backdrop-blur">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-blue-50 text-blue-500 ring-1 ring-blue-100">
                <Search className="h-[18px] w-[18px]" strokeWidth={2} />
              </span>
              <div className="min-w-0 flex-1">
                <label htmlFor="parent-trip-search" className="mb-1 block text-sm font-semibold text-slate-500">
                  Wpisz nazwę wyjazdu
                </label>
                <div className="relative">
                  <Input
                    id="parent-trip-search"
                    type="text"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className="h-7 border-0 bg-transparent px-0 pr-8 text-base font-black text-slate-950 shadow-none focus-visible:ring-0 sm:text-lg"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => setQuery('')}
                      aria-label="Wyczyść wyszukiwanie"
                      className="absolute right-0 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="hidden h-full min-h-20 w-px bg-slate-300/80 lg:block" />

          <div className="min-w-0">
            <ParentChildSelector
              selectedChildId={selectedChildId}
              selectedChildName={childName}
              childrenList={childrenList}
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
              icon={Backpack}
              title="Dziecko czeka na przypisanie do grupy"
              description="Organizator nie przypisał jeszcze dziecka do grupy treningowej. Po przypisaniu zobaczysz tutaj dostępne wyjazdy."
            />
          ) : (
            <EmptyState
              icon={Backpack}
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
