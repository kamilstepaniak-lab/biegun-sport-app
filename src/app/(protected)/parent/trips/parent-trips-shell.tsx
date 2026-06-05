'use client';

import { Backpack, Search, X } from 'lucide-react';
import { useState } from 'react';

import { ChildGuard } from '@/components/parent/child-guard';
import { ParentChildSelector, type ParentChildOption } from '@/components/parent/parent-child-selector';
import { ParentPageHeader } from '@/components/parent/parent-page-header';
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

  const searchTool = (
    <div className="space-y-2">
      <label
        htmlFor="parent-trip-search"
        className="flex items-center gap-2 text-xs font-black uppercase tracking-normal text-blue-700"
      >
        <Search className="h-3.5 w-3.5" />
        Wpisz nazwę wyjazdu
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          id="parent-trip-search"
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="h-12 rounded-[10px] border-slate-200 bg-white/92 pl-10 pr-10 text-sm font-bold text-slate-950 shadow-sm ring-1 ring-white/50 backdrop-blur focus-visible:bg-white focus-visible:ring-blue-500"
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
  );

  return (
    <div className="space-y-6">
      <ParentPageHeader
        icon={Backpack}
        title="Wyjazdy"
        description={
          <>
            Zarządzaj wyjazdami Twoich dzieci w jednym miejscu.
            <br className="hidden sm:block" />
            Przeglądaj listę, sprawdzaj szczegóły i dodawaj nowe zgłoszenia.
          </>
        }
        tools={searchTool}
        hideIcon
        className="parent-trips-hero rounded-none border-0 pb-14 shadow-none sm:pb-16 lg:min-h-[285px] lg:pb-20"
      >
        <ParentChildSelector
          selectedChildId={selectedChildId}
          selectedChildName={childName}
          childrenList={childrenList}
        />
      </ParentPageHeader>

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
