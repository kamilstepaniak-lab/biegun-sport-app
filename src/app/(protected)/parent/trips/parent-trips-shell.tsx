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
      <section className="parent-trips-hero relative overflow-hidden rounded-[18px] border border-blue-100/80 bg-[#eef6ff] px-4 pb-5 pt-8 text-slate-900 shadow-[0_18px_45px_rgba(15,23,42,0.12)] sm:px-8 sm:pb-8 sm:pt-10 lg:min-h-[360px] lg:px-14 lg:pb-14 lg:pt-16">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(90deg,rgba(248,251,255,0.98)_0%,rgba(248,251,255,0.92)_30%,rgba(248,251,255,0.35)_58%,rgba(248,251,255,0.12)_100%),url('/parent-hero-mountains.svg')] bg-[length:100%_100%,auto_100%] bg-[position:left_top,right_bottom] bg-no-repeat"
        />
        <div className="relative z-10 flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[18px] bg-blue-100/70 text-blue-500 shadow-sm ring-1 ring-blue-200/50 sm:h-20 sm:w-20">
            <Backpack className="h-8 w-8 sm:h-10 sm:w-10" strokeWidth={1.8} />
          </div>
          <div className="min-w-0">
            <h1 className="text-5xl font-black leading-none tracking-normal text-slate-950 sm:text-6xl lg:text-[72px]">
              Wyjazdy
            </h1>
            <p className="mt-5 max-w-2xl text-base font-medium leading-relaxed text-slate-600 sm:text-lg">
              Zarządzaj wyjazdami Twoich dzieci w jednym miejscu.
              <br className="hidden sm:block" />
              Przeglądaj listę, sprawdzaj szczegóły i dodawaj nowe zgłoszenia.
            </p>
          </div>
        </div>

        <div className="relative z-10 mt-10 grid gap-5 lg:mt-16 lg:grid-cols-[minmax(280px,420px)_1px_minmax(0,1fr)] lg:items-end">
          <div className="rounded-[14px] bg-white/86 p-4 shadow-[0_12px_34px_rgba(15,23,42,0.10)] ring-1 ring-slate-200/80 backdrop-blur">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-blue-50 text-blue-500 ring-1 ring-blue-100">
                <Search className="h-5 w-5" strokeWidth={2} />
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
                    placeholder="np. Zimowisko w Tatrach"
                    className="h-8 border-0 bg-transparent px-0 pr-8 text-lg font-black text-slate-950 shadow-none placeholder:text-slate-400 focus-visible:ring-0 sm:text-xl"
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
              showAllOption={false}
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
