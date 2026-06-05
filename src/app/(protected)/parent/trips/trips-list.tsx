'use client';

import { useState, useMemo, useCallback } from 'react';
import { Calendar as CalendarIcon, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

import { updateParticipationStatusByParent, type TripForParent, type ChildTripStatus } from '@/lib/actions/trips';
import { TripCard, type ConfirmType, type ParticipationStatus } from './trip-card';

interface ParentTripsListProps {
  trips: TripForParent[];
}

const monthNames = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień',
];

function groupByMonth(trips: TripForParent[]) {
  const groups: { month: string; year: number; monthKey: string; trips: TripForParent[] }[] = [];
  trips.forEach(trip => {
    const date = new Date(trip.departure_datetime);
    const monthIndex = date.getMonth();
    const year = date.getFullYear();
    const monthKey = `${year}-${monthIndex}`;
    const existing = groups.find(g => g.monthKey === monthKey);
    if (existing) existing.trips.push(trip);
    else groups.push({ month: monthNames[monthIndex], year, monthKey, trips: [trip] });
  });
  return groups;
}

export function ParentTripsList({ trips }: ParentTripsListProps) {
  const { upcomingTrips, pastTrips } = useMemo(() => {
    const now = Date.now();
    const upcoming: TripForParent[] = [];
    const past: TripForParent[] = [];
    trips.forEach(trip => {
      if (new Date(trip.return_datetime).getTime() < now) past.push(trip);
      else upcoming.push(trip);
    });
    upcoming.sort((a, b) => new Date(a.departure_datetime).getTime() - new Date(b.departure_datetime).getTime());
    past.sort((a, b) => new Date(b.departure_datetime).getTime() - new Date(a.departure_datetime).getTime());
    return { upcomingTrips: upcoming, pastTrips: past };
  }, [trips]);

  const upcomingByMonth = useMemo(() => groupByMonth(upcomingTrips), [upcomingTrips]);
  const pastByMonth = useMemo(() => groupByMonth(pastTrips), [pastTrips]);

  const nearestTripId = upcomingTrips.length > 0 ? upcomingTrips[0].id : null;

  const [openTrips, setOpenTrips] = useState<Set<string>>(() =>
    nearestTripId ? new Set([nearestTripId]) : new Set(),
  );
  const [updatingChild, setUpdatingChild] = useState<string | null>(null);
  const [childStatuses, setChildStatuses] = useState<Record<string, ChildTripStatus['participation_status']>>({});
  const [childNotes, setChildNotes] = useState<Record<string, string | null>>({});
  const [confirmPanel, setConfirmPanel] = useState<{ key: string; type: ConfirmType } | null>(null);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [pastExpanded, setPastExpanded] = useState(false);

  const toggleTrip = useCallback((tripId: string) => {
    setOpenTrips(prev => {
      const next = new Set(prev);
      if (next.has(tripId)) next.delete(tripId);
      else next.add(tripId);
      return next;
    });
  }, []);

  const handleStatusChange = useCallback(async (
    tripId: string, childId: string,
    status: 'confirmed' | 'not_going' | 'other', note?: string,
  ) => {
    const key = `${tripId}-${childId}`;
    setUpdatingChild(key);
    setChildStatuses(prev => ({ ...prev, [key]: status }));
    setChildNotes(prev => ({ ...prev, [key]: note || null }));

    try {
      const result = await updateParticipationStatusByParent(tripId, childId, status, note);
      if (result.error) {
        setChildStatuses(prev => { const s = { ...prev }; delete s[key]; return s; });
        setChildNotes(prev => { const s = { ...prev }; delete s[key]; return s; });
        toast.error(result.error);
      } else {
        setConfirmPanel(null);
        setConfirmMessage('');
        toast.success(
          status === 'confirmed' ? 'Zapisano wybór przystanku!'
            : status === 'not_going' ? 'Zapisano - dziecko nie jedzie'
              : 'Wiadomość wysłana',
        );
      }
    } catch {
      setChildStatuses(prev => { const s = { ...prev }; delete s[key]; return s; });
      setChildNotes(prev => { const s = { ...prev }; delete s[key]; return s; });
      toast.error('Wystąpił błąd');
    } finally {
      setUpdatingChild(null);
    }
  }, []);

  const copyToClipboard = useCallback((text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} skopiowany do schowka`);
  }, []);

  const openConfirmPanelCb = useCallback((key: string, type: ConfirmType) => {
    setConfirmPanel(prev => (prev?.key === key && prev?.type === type ? null : { key, type }));
    setConfirmMessage('');
  }, []);

  const cancelConfirmPanelCb = useCallback(() => {
    setConfirmPanel(null);
    setConfirmMessage('');
  }, []);

  const renderTripCard = (trip: TripForParent, isPast: boolean) => {
    const prefix = `${trip.id}-`;
    // Slice stanu tylko dla tego wyjazdu \u2014 pozwala React.memo przerwa\u0107 re-render innych kart
    const isConfirmForThis = confirmPanel?.key.startsWith(prefix) ?? false;
    const isUpdatingForThis = updatingChild?.startsWith(prefix) ?? false;
    return (
      <TripCard
        key={trip.id}
        trip={trip}
        isPast={isPast}
        isOpen={openTrips.has(trip.id)}
        childStatusOverrides={childStatuses as Record<string, ParticipationStatus>}
        childNoteOverrides={childNotes}
        updatingChildKey={isUpdatingForThis ? updatingChild : null}
        confirmPanel={isConfirmForThis ? confirmPanel : null}
        confirmMessage={isConfirmForThis ? confirmMessage : ''}
        onToggle={toggleTrip}
        onOpenConfirmPanel={openConfirmPanelCb}
        onCancelConfirmPanel={cancelConfirmPanelCb}
        onConfirmMessageChange={setConfirmMessage}
        onStatusChange={handleStatusChange}
        onCopy={copyToClipboard}
      />
    );
  };

  return (
    <div className="space-y-6">
      {upcomingTrips.length === 0 && pastTrips.length === 0 && (
        <div className="bg-white rounded-2xl p-12 shadow-sm border border-gray-100 text-center text-gray-400">
          Brak wyjazdów
        </div>
      )}

      {upcomingByMonth.length > 0 && (
        <div className="relative space-y-6 pl-10 before:absolute before:bottom-0 before:left-[18px] before:top-5 before:w-px before:bg-slate-200">
          {upcomingByMonth.map((group) => (
            <div key={group.monthKey} className="relative space-y-3">
              <div className="flex items-center gap-3">
                <div className="absolute -left-10 flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm shadow-blue-600/25">
                  <CalendarIcon className="h-4 w-4" />
                </div>
                <span className="ml-4 text-xs font-black uppercase tracking-[0.16em] text-slate-700">
                  {group.month} {group.year}
                </span>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-500 ring-1 ring-slate-200">
                  {group.trips.length}
                </span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>
              {group.trips.map((trip) => renderTripCard(trip, false))}
            </div>
          ))}
        </div>
      )}

      {pastTrips.length > 0 && (
        <div className="space-y-4">
          <button
            onClick={() => setPastExpanded(prev => !prev)}
            className="w-full flex items-center gap-4 px-1 group"
          >
            <div className="h-px flex-1 bg-gray-300" />
            <span className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-widest group-hover:text-gray-600 transition-colors whitespace-nowrap">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Wyjazdy zrealizowane ({pastTrips.length})
              {pastExpanded
                ? <ChevronUp className="h-3.5 w-3.5" />
                : <ChevronDown className="h-3.5 w-3.5" />}
            </span>
            <div className="h-px flex-1 bg-gray-300" />
          </button>

          {pastExpanded && (
            <div className="relative space-y-6 pl-10 before:absolute before:bottom-0 before:left-[18px] before:top-5 before:w-px before:bg-slate-200">
              {pastByMonth.map((group) => (
                <div key={group.monthKey} className="relative space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="absolute -left-10 flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-slate-500">
                      <CalendarIcon className="h-4 w-4" />
                    </div>
                    <span className="ml-4 text-xs font-black uppercase tracking-[0.16em] text-slate-600">
                      {group.month} {group.year}
                    </span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-500 ring-1 ring-slate-200">
                      {group.trips.length}
                    </span>
                    <div className="h-px flex-1 bg-slate-200" />
                  </div>
                  {group.trips.map((trip) => renderTripCard(trip, true))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
