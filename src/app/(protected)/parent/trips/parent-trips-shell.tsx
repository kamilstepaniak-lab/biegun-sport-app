'use client';

import { CalendarDays, Search, X } from 'lucide-react';
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

  return (
    <div className="space-y-6">
      <ParentPageHeader
        icon={CalendarDays}
        title="Wyjazdy"
        description="Zarządzaj wyjazdami Twoich dzieci w jednym miejscu. Przeglądaj listę, sprawdzaj szczegóły i dodawaj nowe zgłoszenia."
        note="Po potwierdzeniu pojawi się umowa i płatność do opłacenia."
      >
        <div className="grid gap-4 lg:grid-cols-[0.32fr_1fr] lg:items-end">
          <div className="space-y-2 lg:border-r lg:border-slate-200 lg:pr-4">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-normal text-blue-700">
              <CalendarDays className="h-3.5 w-3.5" />
              Nazwa wyjazdu
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Wpisz nazwę wyjazdu..."
                className="h-12 rounded-[10px] border-blue-500 bg-white pl-9 pr-9 text-sm shadow-none focus-visible:ring-blue-500"
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
          <ParentChildSelector
            selectedChildId={selectedChildId}
            selectedChildName={childName}
            childrenList={childrenList}
          />
        </div>
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
