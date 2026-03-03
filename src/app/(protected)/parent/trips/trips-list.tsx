'use client';

import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import {
  ChevronDown,
  ChevronUp,
  Calendar,
  MapPin,
  X,
  HelpCircle,
  Clock,
  Banknote,
  Copy,
  Receipt,
  ArrowRight,
  Bus,
  CheckCircle2,
  Backpack,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Textarea } from '@/components/ui/textarea';

import { updateParticipationStatusByParent, type TripForParent, type ChildTripStatus } from '@/lib/actions/trips';
import { getGroupColor } from '@/lib/group-colors';
import { cn } from '@/lib/utils';

interface ParentTripsListProps {
  trips: TripForParent[];
}

function getStopFromNote(note: string | null): 'stop1' | 'stop2' | 'own' | null {
  if (!note) return null;
  if (note.startsWith('[STOP2]')) return 'stop2';
  if (note.startsWith('[STOP1]')) return 'stop1';
  if (note.startsWith('[OWN]')) return 'own';
  return null;
}

function buildNote(stop: 'stop1' | 'stop2' | 'own', message?: string): string {
  const prefix = stop === 'stop1' ? '[STOP1]' : stop === 'stop2' ? '[STOP2]' : '[OWN]';
  return message ? `${prefix} ${message}` : prefix;
}

const statusConfig = {
  unconfirmed: { label: 'Niepotwierdzony', color: 'bg-gray-100 text-gray-600', icon: Clock },
  confirmed: { label: 'Jedzie', color: 'bg-emerald-50 text-emerald-700', icon: Bus },
  not_going: { label: 'Nie jedzie', color: 'bg-red-50 text-red-600', icon: X },
  other: { label: 'Inne', color: 'bg-amber-50 text-amber-700', icon: HelpCircle },
};

const monthNames = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
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
  const now = new Date();

  // Podziel na nadchodzące i zrealizowane
  const { upcomingTrips, pastTrips } = useMemo(() => {
    const upcoming: TripForParent[] = [];
    const past: TripForParent[] = [];
    trips.forEach(trip => {
      if (new Date(trip.return_datetime) < now) past.push(trip);
      else upcoming.push(trip);
    });
    // Nadchodzące: od najwcześniejszego
    upcoming.sort((a, b) => new Date(a.departure_datetime).getTime() - new Date(b.departure_datetime).getTime());
    // Zrealizowane: od najnowszego
    past.sort((a, b) => new Date(b.departure_datetime).getTime() - new Date(a.departure_datetime).getTime());
    return { upcomingTrips: upcoming, pastTrips: past };
  }, [trips]);

  const upcomingByMonth = useMemo(() => groupByMonth(upcomingTrips), [upcomingTrips]);
  const pastByMonth = useMemo(() => groupByMonth(pastTrips), [pastTrips]);

  const nearestTripId = upcomingTrips.length > 0 ? upcomingTrips[0].id : null;

  const stats = useMemo(() => ({
    total: trips.length,
    upcoming: upcomingTrips.length,
    nextDate: upcomingTrips[0]
      ? format(new Date(upcomingTrips[0].departure_datetime), 'd MMM yyyy', { locale: pl })
      : null,
  }), [trips, upcomingTrips]);

  const [openTrips, setOpenTrips] = useState<Set<string>>(() =>
    nearestTripId ? new Set([nearestTripId]) : new Set()
  );
  const [updatingChild, setUpdatingChild] = useState<string | null>(null);
  const [childStatuses, setChildStatuses] = useState<Record<string, ChildTripStatus['participation_status']>>({});
  const [childNotes, setChildNotes] = useState<Record<string, string | null>>({});
  const [confirmPanel, setConfirmPanel] = useState<{ key: string; type: 'stop1' | 'stop2' | 'own' | 'not_going' | 'other' } | null>(null);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [pastExpanded, setPastExpanded] = useState(false);

  function toggleTrip(tripId: string) {
    const newOpen = new Set(openTrips);
    if (newOpen.has(tripId)) newOpen.delete(tripId);
    else newOpen.add(tripId);
    setOpenTrips(newOpen);
  }

  async function handleStatusChange(
    tripId: string, childId: string,
    status: 'confirmed' | 'not_going' | 'other', note?: string
  ) {
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
            : 'Wiadomość wysłana'
        );
      }
    } catch {
      setChildStatuses(prev => { const s = { ...prev }; delete s[key]; return s; });
      setChildNotes(prev => { const s = { ...prev }; delete s[key]; return s; });
      toast.error('Wystąpił błąd');
    } finally {
      setUpdatingChild(null);
    }
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast.success(`${label} skopiowany do schowka`);
  }

  function openConfirmPanel(key: string, type: 'stop1' | 'stop2' | 'own' | 'not_going' | 'other') {
    if (confirmPanel?.key === key && confirmPanel?.type === type) {
      setConfirmPanel(null);
      setConfirmMessage('');
    } else {
      setConfirmPanel({ key, type });
      setConfirmMessage('');
    }
  }

  function renderBulletList(text: string) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return null;
    if (lines.length === 1) return <p className="text-sm text-gray-600">{text}</p>;
    return (
      <ul className="space-y-1.5">
        {lines.map((line, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm text-gray-600">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0 mt-[7px]" />
            <span>{line}</span>
          </li>
        ))}
      </ul>
    );
  }

  function renderTripCard(trip: TripForParent, isPast = false) {
    const isOpen = openTrips.has(trip.id);
    const departureDate = new Date(trip.departure_datetime);
    const returnDate = new Date(trip.return_datetime);
    const hasStop2 = !!trip.departure_stop2_location;

    return (
      <Collapsible key={trip.id} open={isOpen} onOpenChange={() => toggleTrip(trip.id)}>
        <div className={cn(
          'rounded-2xl transition-all duration-200 overflow-hidden',
          isOpen
            ? 'bg-white shadow-lg ring-1 ring-gray-200'
            : 'bg-white shadow-sm border border-gray-100 hover:shadow-md hover:border-gray-200',
          isPast && !isOpen && 'opacity-60'
        )}>
          <CollapsibleTrigger asChild>
            <div className="p-3 sm:p-5 cursor-pointer">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-lg text-gray-900">{trip.title}</h3>
                    {trip.groups.map((g) => {
                      const colors = getGroupColor(g.name);
                      return (
                        <span key={g.id} className={cn(
                          'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-medium',
                          colors.bg, colors.text
                        )}>
                          <span className={cn('w-1.5 h-1.5 rounded-full', colors.dot)} />
                          {g.name}
                        </span>
                      );
                    })}
                    {isPast && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-500">
                        <CheckCircle2 className="h-3 w-3" />
                        Zrealizowany
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-gray-500">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      {format(departureDate, 'EEE d MMM', { locale: pl })}
                      <ArrowRight className="h-3 w-3 text-gray-300" />
                      {format(returnDate, 'EEE d MMM yyyy', { locale: pl })}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      {trip.departure_location}
                    </span>
                  </div>
                </div>
                <div className={cn(
                  'w-8 h-8 rounded-xl flex items-center justify-center transition-colors ml-3',
                  isOpen ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'
                )}>
                  {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </div>

              {/* Dzieci i statusy */}
              {!isPast && (
                <div className="mt-4 space-y-2">
                  {trip.children.map((child) => {
                    const key = `${trip.id}-${child.child_id}`;
                    const currentStatus = childStatuses[key] || child.participation_status;
                    const currentNote = key in childNotes ? childNotes[key] : child.participation_note;
                    const status = statusConfig[currentStatus];
                    const StatusIcon = status.icon;
                    const isUpdating = updatingChild === key;
                    const currentStop = getStopFromNote(currentNote);

                    const statusLabel = currentStatus === 'confirmed'
                      ? currentStop === 'stop2'
                        ? `Jedzie – ${trip.departure_stop2_location || 'Przystanek 2'}`
                        : currentStop === 'own'
                        ? 'Jedzie – Dojazd własny'
                        : `Jedzie – ${trip.departure_location || 'Przystanek 1'}`
                      : status.label;

                    return (
                      <div key={child.child_id} className="space-y-2" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 rounded-xl bg-gray-50/80 gap-2">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0">
                              {child.child_name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <span className="font-medium text-gray-800">{child.child_name}</span>
                              {currentStatus !== 'unconfirmed' && (
                                <span className={cn('ml-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-medium', status.color)}>
                                  <StatusIcon className="h-3 w-3" />
                                  {statusLabel}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1 flex-wrap">
                            {/* Przystanek 1 */}
                            <button
                              disabled={isUpdating}
                              onClick={(e) => { e.stopPropagation(); openConfirmPanel(key, 'stop1'); }}
                              className={cn(
                                'px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-all duration-200 border-2',
                                currentStatus === 'confirmed' && currentStop === 'stop1'
                                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                                  : confirmPanel?.key === key && confirmPanel?.type === 'stop1'
                                  ? 'bg-emerald-100 text-emerald-700 border-emerald-500'
                                  : 'bg-white border-emerald-400 text-emerald-700 hover:bg-emerald-500 hover:text-white hover:border-emerald-500 hover:shadow-md'
                              )}
                            >
                              {trip.departure_location?.length > 18
                                ? trip.departure_location.substring(0, 16) + '…'
                                : trip.departure_location || 'Przystanek 1'}
                            </button>
                            {/* Przystanek 2 */}
                            {hasStop2 && (
                              <button
                                disabled={isUpdating}
                                onClick={(e) => { e.stopPropagation(); openConfirmPanel(key, 'stop2'); }}
                                className={cn(
                                  'px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-all duration-200 border-2',
                                  currentStatus === 'confirmed' && currentStop === 'stop2'
                                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                                    : confirmPanel?.key === key && confirmPanel?.type === 'stop2'
                                    ? 'bg-emerald-100 text-emerald-700 border-emerald-500'
                                    : 'bg-white border-emerald-400 text-emerald-700 hover:bg-emerald-500 hover:text-white hover:border-emerald-500 hover:shadow-md'
                                )}
                              >
                                {(trip.departure_stop2_location?.length ?? 0) > 18
                                  ? trip.departure_stop2_location!.substring(0, 16) + '…'
                                  : trip.departure_stop2_location || 'Przystanek 2'}
                              </button>
                            )}
                            {/* Dojazd własny */}
                            {trip.allow_own_transport && (
                              <button
                                disabled={isUpdating}
                                onClick={(e) => { e.stopPropagation(); openConfirmPanel(key, 'own'); }}
                                className={cn(
                                  'px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-all duration-200 border-2',
                                  currentStatus === 'confirmed' && currentStop === 'own'
                                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                                    : confirmPanel?.key === key && confirmPanel?.type === 'own'
                                    ? 'bg-emerald-100 text-emerald-700 border-emerald-500'
                                    : 'bg-white border-emerald-400 text-emerald-700 hover:bg-emerald-500 hover:text-white hover:border-emerald-500 hover:shadow-md'
                                )}
                              >
                                Dojazd własny
                              </button>
                            )}
                            {/* Nie jedzie */}
                            <button
                              disabled={isUpdating}
                              onClick={(e) => { e.stopPropagation(); openConfirmPanel(key, 'not_going'); }}
                              className={cn(
                                'px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-all duration-200 border-2 flex items-center gap-1',
                                currentStatus === 'not_going'
                                  ? 'bg-red-500 text-white border-red-500 shadow-md'
                                  : confirmPanel?.key === key && confirmPanel?.type === 'not_going'
                                  ? 'bg-red-100 text-red-600 border-red-500'
                                  : 'bg-white border-red-400 text-red-600 hover:bg-red-500 hover:text-white hover:border-red-500 hover:shadow-md'
                              )}
                            >
                              <X className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                              Nie jedzie
                            </button>
                            {/* Wiadomość */}
                            <button
                              disabled={isUpdating}
                              onClick={(e) => { e.stopPropagation(); openConfirmPanel(key, 'other'); }}
                              className={cn(
                                'px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-all duration-200 border-2 flex items-center gap-1',
                                currentStatus === 'other' || (confirmPanel?.key === key && confirmPanel?.type === 'other')
                                  ? 'bg-amber-500 text-white border-amber-500 shadow-md'
                                  : 'bg-white border-amber-400 text-amber-600 hover:bg-amber-500 hover:text-white hover:border-amber-500 hover:shadow-md'
                              )}
                            >
                              <HelpCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                              Wiadomość
                            </button>
                          </div>
                        </div>
                        {/* ── Panel potwierdzenia ── */}
                        {confirmPanel?.key === key && (() => {
                          const pType = confirmPanel.type;
                          const isStop = ['stop1', 'stop2', 'own'].includes(pType);
                          const isNotGoing = pType === 'not_going';
                          const stopName = pType === 'stop2'
                            ? (trip.departure_stop2_location || 'Przystanek 2')
                            : pType === 'own' ? 'Dojazd własny'
                            : (trip.departure_location || 'Przystanek 1');
                          const headerLabel = isStop
                            ? `Jedzie – ${stopName}`
                            : isNotGoing ? 'Nie jedzie'
                            : 'Wiadomość do admina';
                          const panelCls = isStop
                            ? 'bg-emerald-50/70 border-emerald-100'
                            : isNotGoing ? 'bg-red-50/70 border-red-100'
                            : 'bg-amber-50/70 border-amber-100';
                          const headerCls = isStop ? 'text-emerald-700' : isNotGoing ? 'text-red-700' : 'text-amber-700';
                          const confirmBtnCls = isStop
                            ? 'bg-emerald-600 hover:bg-emerald-700'
                            : isNotGoing ? 'bg-red-600 hover:bg-red-700'
                            : 'bg-blue-600 hover:bg-blue-700';
                          const confirmLabel = pType === 'other' ? 'Wyślij' : 'Potwierdź';
                          return (
                            <div className={cn('ml-11 p-3 rounded-xl border space-y-2', panelCls)}>
                              <div className={cn('flex items-center gap-1.5', headerCls)}>
                                {isStop && <CheckCircle2 className="h-3.5 w-3.5" />}
                                {isNotGoing && <X className="h-3.5 w-3.5" />}
                                {pType === 'other' && <HelpCircle className="h-3.5 w-3.5" />}
                                <span className="text-xs font-semibold">{headerLabel}</span>
                              </div>
                              <Textarea
                                placeholder={pType === 'other' ? 'Wpisz wiadomość do admina…' : 'Wiadomość dla admina (opcjonalna, np. dołączy później)'}
                                value={confirmMessage}
                                onChange={(e) => setConfirmMessage(e.target.value)}
                                rows={2}
                                className="text-sm rounded-lg bg-white"
                                onClick={(e) => e.stopPropagation()}
                                autoFocus
                              />
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setConfirmPanel(null); setConfirmMessage(''); }}
                                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                                >
                                  Anuluj
                                </button>
                                <button
                                  disabled={isUpdating || (pType === 'other' && !confirmMessage.trim())}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (isStop) {
                                      handleStatusChange(trip.id, child.child_id, 'confirmed', buildNote(pType as 'stop1' | 'stop2' | 'own', confirmMessage || undefined));
                                    } else if (isNotGoing) {
                                      handleStatusChange(trip.id, child.child_id, 'not_going', confirmMessage || undefined);
                                    } else {
                                      handleStatusChange(trip.id, child.child_id, 'other', confirmMessage);
                                    }
                                  }}
                                  className={cn('px-3 py-1.5 rounded-lg text-xs font-medium text-white shadow-sm disabled:opacity-50', confirmBtnCls)}
                                >
                                  {isUpdating ? 'Zapisuję…' : confirmLabel}
                                </button>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="px-3 sm:px-5 pb-4 sm:pb-5 space-y-4">
              <div className="h-px bg-gray-100" />
              {trip.description && (
                <p className="text-sm text-gray-500 leading-relaxed whitespace-pre-line">{trip.description}</p>
              )}
              <div className="grid gap-4 lg:grid-cols-2">
                {/* Wyjazd + Powrót */}
                <div className="bg-gray-50 rounded-2xl p-3 sm:p-5 space-y-4">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
                        <ArrowRight className="h-3.5 w-3.5 text-white" />
                      </div>
                      <h4 className="text-sm font-semibold text-gray-700">Wyjazd</h4>
                    </div>
                    <div className="bg-white rounded-xl p-3 space-y-2">
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-gray-800 text-sm">{trip.departure_location}</p>
                          <p className="text-xs text-gray-500">{format(departureDate, 'EEEE, d MMMM yyyy, HH:mm', { locale: pl })}</p>
                        </div>
                      </div>
                      {trip.departure_stop2_location && (
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-medium text-gray-800 text-sm">{trip.departure_stop2_location}</p>
                            {trip.departure_stop2_datetime && (
                              <p className="text-xs text-gray-500">{format(new Date(trip.departure_stop2_datetime), 'EEEE, d MMMM yyyy, HH:mm', { locale: pl })}</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="h-px bg-gray-200" />
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
                        <ArrowRight className="h-3.5 w-3.5 text-white rotate-180" />
                      </div>
                      <h4 className="text-sm font-semibold text-gray-700">Powrót</h4>
                    </div>
                    <div className="bg-white rounded-xl p-3 space-y-2">
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-gray-800 text-sm">{trip.return_location}</p>
                          <p className="text-xs text-gray-500">{format(returnDate, 'EEEE, d MMMM yyyy, HH:mm', { locale: pl })}</p>
                        </div>
                      </div>
                      {trip.return_stop2_location && (
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-medium text-gray-800 text-sm">{trip.return_stop2_location}</p>
                            {trip.return_stop2_datetime && (
                              <p className="text-xs text-gray-500">{format(new Date(trip.return_stop2_datetime), 'EEEE, d MMMM yyyy, HH:mm', { locale: pl })}</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Cennik + Przelew */}
                <div className="space-y-4">
                  {trip.payment_templates && trip.payment_templates.length > 0 && (
                    <div className="bg-gray-50 rounded-2xl p-3 sm:p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
                          <Receipt className="h-3.5 w-3.5 text-white" />
                        </div>
                        <h4 className="text-sm font-semibold text-gray-700">Cennik</h4>
                      </div>
                      <div className="bg-white rounded-xl ring-1 ring-gray-100 overflow-hidden">
                        {/* Mobile: lista kart */}
                        <div className="sm:hidden divide-y divide-gray-50">
                          {trip.payment_templates.map((template) => {
                            const label = template.payment_type === 'installment'
                              ? `Rata ${template.installment_number}`
                              : template.payment_type === 'season_pass'
                              ? `Karnet${template.category_name ? ` (${template.category_name})` : ''}`
                              : template.payment_type === 'full'
                              ? 'Pełna opłata'
                              : template.payment_type;
                            const methodLabel = template.payment_method === 'transfer' ? 'Przelew'
                              : template.payment_method === 'cash' ? 'Gotówka'
                              : template.payment_method === 'both' ? 'Przel./Got.' : '–';
                            return (
                              <div key={template.id} className="flex items-center justify-between px-3 py-2.5 gap-2">
                                <div className="min-w-0">
                                  <p className="text-xs font-medium text-gray-800">{label}</p>
                                  <p className="text-[11px] text-gray-400 mt-0.5">
                                    {template.due_date
                                      ? (trip.departure_datetime && template.due_date === new Date(trip.departure_datetime).toISOString().split('T')[0]
                                        ? 'w dniu wyjazdu'
                                        : `do ${format(new Date(template.due_date), 'd.MM.yy', { locale: pl })}`)
                                      : '–'}
                                    {' · '}
                                    <span className={cn(
                                      template.payment_method === 'cash' ? 'text-amber-600'
                                        : template.payment_method === 'transfer' ? 'text-blue-600'
                                        : 'text-white'
                                    )}>{methodLabel}</span>
                                  </p>
                                </div>
                                <p className="text-sm font-bold text-gray-900 whitespace-nowrap flex-shrink-0">
                                  {template.amount.toFixed(0)} {template.currency}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                        {/* Desktop: tabela */}
                        <table className="hidden sm:table w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-100">
                              <th className="px-3 py-2 text-left font-medium text-gray-500">Za co</th>
                              <th className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">Termin</th>
                              <th className="px-3 py-2 text-left font-medium text-gray-500">Forma</th>
                              <th className="px-3 py-2 text-right font-medium text-gray-500">Kwota</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {trip.payment_templates.map((template) => {
                              const label = template.payment_type === 'installment'
                                ? `Rata ${template.installment_number}`
                                : template.payment_type === 'season_pass'
                                ? `Karnet${template.category_name ? ` (${template.category_name})` : ''}`
                                : template.payment_type === 'full'
                                ? 'Pełna opłata'
                                : template.payment_type;
                              const methodLabel = template.payment_method === 'transfer' ? 'Przelew'
                                : template.payment_method === 'cash' ? 'Gotówka'
                                : template.payment_method === 'both' ? 'Przelew/Got.' : '–';
                              return (
                                <tr key={template.id} className="hover:bg-gray-50/50">
                                  <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">{label}</td>
                                  <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                                    {template.due_date
                                      ? (trip.departure_datetime && template.due_date === new Date(trip.departure_datetime).toISOString().split('T')[0]
                                        ? 'w dniu wyjazdu'
                                        : `do ${format(new Date(template.due_date), 'd.MM.yyyy', { locale: pl })}`)
                                      : '–'}
                                  </td>
                                  <td className="px-3 py-2">
                                    <span className={cn(
                                      'inline-flex items-center px-1.5 py-0.5 rounded-lg text-xs font-medium whitespace-nowrap',
                                      template.payment_method === 'cash' ? 'bg-amber-100 text-amber-700'
                                        : template.payment_method === 'transfer' ? 'bg-blue-100 text-blue-700'
                                        : 'bg-blue-100 text-blue-700'
                                    )}>
                                      {methodLabel}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 text-right font-semibold text-gray-900 whitespace-nowrap">
                                    {template.amount.toFixed(0)} {template.currency}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {(trip.bank_account_pln || trip.bank_account_eur) && (
                    <div className="bg-gray-50 rounded-2xl p-3 sm:p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
                          <Banknote className="h-3.5 w-3.5 text-white" />
                        </div>
                        <h4 className="text-sm font-semibold text-gray-700">Dane do przelewu</h4>
                      </div>
                      <div className="space-y-2">
                        {trip.children.map((child) => {
                          const [firstName, ...lastNameParts] = child.child_name.split(' ');
                          const lastName = lastNameParts.join(' ');
                          const tripDate = format(departureDate, 'dd.MM.yyyy', { locale: pl });
                          const transferTitle = `${lastName} ${firstName} ${trip.title} ${tripDate}`;
                          return (
                            <div key={child.child_id} className="flex items-center justify-between bg-white rounded-xl p-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-gray-400">Tytuł przelewu – {child.child_name}</p>
                                <p className="text-sm font-medium text-gray-800 truncate">{transferTitle}</p>
                              </div>
                              <button onClick={(e) => { e.stopPropagation(); copyToClipboard(transferTitle, 'Tytuł przelewu'); }} className="ml-2 w-8 h-8 rounded-lg bg-gray-50 hover:bg-gray-100 flex items-center justify-center transition-colors">
                                <Copy className="h-3.5 w-3.5 text-gray-400" />
                              </button>
                            </div>
                          );
                        })}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {trip.bank_account_pln && (
                            <div className="flex items-center justify-between bg-white rounded-xl p-3">
                              <div className="min-w-0">
                                <p className="text-xs text-gray-400">Konto PLN</p>
                                <p className="text-sm text-gray-800 truncate">{trip.bank_account_pln}</p>
                              </div>
                              <button onClick={(e) => { e.stopPropagation(); copyToClipboard(trip.bank_account_pln!, 'Numer konta PLN'); }} className="ml-1 w-8 h-8 rounded-lg bg-gray-50 hover:bg-gray-100 flex items-center justify-center transition-colors flex-shrink-0">
                                <Copy className="h-3.5 w-3.5 text-gray-400" />
                              </button>
                            </div>
                          )}
                          {trip.bank_account_eur && (
                            <div className="flex items-center justify-between bg-white rounded-xl p-3">
                              <div className="min-w-0">
                                <p className="text-xs text-gray-400">Konto EUR</p>
                                <p className="text-sm text-gray-800 truncate">{trip.bank_account_eur}</p>
                              </div>
                              <button onClick={(e) => { e.stopPropagation(); copyToClipboard(trip.bank_account_eur!, 'Numer konta EUR'); }} className="ml-1 w-8 h-8 rounded-lg bg-gray-50 hover:bg-gray-100 flex items-center justify-center transition-colors flex-shrink-0">
                                <Copy className="h-3.5 w-3.5 text-gray-400" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Co zabrać */}
              {trip.packing_list && (
                <div className="bg-gray-50 rounded-2xl p-3 sm:p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
                      <Backpack className="h-3.5 w-3.5 text-white" />
                    </div>
                    <h4 className="text-sm font-semibold text-gray-700">Co zabrać</h4>
                  </div>
                  {renderBulletList(trip.packing_list)}
                </div>
              )}

              {/* Dodatkowe informacje */}
              {trip.additional_info && (
                <div className="bg-gray-50 rounded-2xl p-3 sm:p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
                      <Info className="h-3.5 w-3.5 text-white" />
                    </div>
                    <h4 className="text-sm font-semibold text-gray-700">Dodatkowe informacje</h4>
                  </div>
                  {renderBulletList(trip.additional_info)}
                </div>
              )}

            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    );
  }

  return (
    <div className="space-y-6">
      {/* Nadchodzące wyjazdy */}
      {upcomingTrips.length === 0 && pastTrips.length === 0 && (
        <div className="bg-white rounded-2xl p-12 shadow-sm border border-gray-100 text-center text-gray-400">
          Brak wyjazdów
        </div>
      )}

      {upcomingByMonth.map((group) => (
        <div key={group.monthKey} className="space-y-4">
          <div className="flex items-center gap-4 px-1">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
              {group.month} {group.year}
            </span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>
          {group.trips.map((trip) => renderTripCard(trip, false))}
        </div>
      ))}

      {/* Separator + Wyjazdy zrealizowane */}
      {pastTrips.length > 0 && (
        <div className="space-y-4">
          {/* Separator "Wyjazdy zrealizowane" */}
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
            <div className="space-y-4">
              {pastByMonth.map((group) => (
                <div key={group.monthKey} className="space-y-4">
                  <div className="flex items-center gap-4 px-1">
                    <div className="h-px flex-1 bg-gray-200" />
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
                      {group.month} {group.year}
                    </span>
                    <div className="h-px flex-1 bg-gray-200" />
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
