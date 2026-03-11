'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isWithinInterval, startOfDay, endOfDay, differenceInCalendarDays } from 'date-fns';
import { pl } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar, MapPin, ArrowRight, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import {
  TooltipProvider,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { getGroupColor } from '@/lib/group-colors';
import type { TripWithPaymentTemplates } from '@/types';

interface CalendarViewProps {
  trips: TripWithPaymentTemplates[];
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
}

export function CalendarView({ trips }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [groupFilter, setGroupFilter] = useState<string>('all');

  // Extract unique groups from trips
  const availableGroups = useMemo(() => {
    const groupMap = new Map<string, { id: string; name: string }>();
    trips.forEach((trip) => {
      trip.groups.forEach((g) => {
        if (!groupMap.has(g.id)) {
          groupMap.set(g.id, { id: g.id, name: g.name });
        }
      });
    });
    return Array.from(groupMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [trips]);

  // Filter trips by selected group
  const filteredTrips = useMemo(() => {
    if (groupFilter === 'all') return trips;
    return trips.filter((trip) => trip.groups.some((g) => g.id === groupFilter));
  }, [trips, groupFilter]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  // Dni tygodnia
  const weekDays = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nd'];

  // Dni miesiąca z paddingiem
  const days = useMemo(() => {
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Dodaj puste dni na początku (Monday = 1, Sunday = 7)
    const firstDayOfWeek = monthStart.getDay();
    const paddingDays = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

    const paddedDays: (Date | null)[] = Array(paddingDays).fill(null);
    return [...paddedDays, ...daysInMonth];
  }, [monthStart, monthEnd]);

  // Znajdź wyjazdy dla danego dnia
  function getTripsForDay(day: Date): TripWithPaymentTemplates[] {
    return filteredTrips.filter((trip) => {
      const tripStart = startOfDay(new Date(trip.departure_datetime));
      const tripEnd = endOfDay(new Date(trip.return_datetime));
      const dayStart = startOfDay(day);

      return isWithinInterval(dayStart, { start: tripStart, end: tripEnd });
    });
  }

  // Sprawdź czy dzień jest pierwszym/ostatnim dniem wyjazdu
  function getTripDayType(day: Date, trip: TripWithPaymentTemplates): 'start' | 'end' | 'middle' | 'single' {
    const tripStart = startOfDay(new Date(trip.departure_datetime));
    const tripEnd = startOfDay(new Date(trip.return_datetime));
    const dayStart = startOfDay(day);

    const isStart = isSameDay(dayStart, tripStart);
    const isEnd = isSameDay(dayStart, tripEnd);

    if (isStart && isEnd) return 'single';
    if (isStart) return 'start';
    if (isEnd) return 'end';
    return 'middle';
  }

  const today = new Date();

  const monthTrips = useMemo(() => {
    const todayStart = startOfDay(new Date());

    const filtered = filteredTrips.filter((trip) => {
      const tripStart = new Date(trip.departure_datetime);
      const tripEnd = new Date(trip.return_datetime);
      return (
        isWithinInterval(tripStart, { start: monthStart, end: monthEnd }) ||
        isWithinInterval(tripEnd, { start: monthStart, end: monthEnd }) ||
        (tripStart <= monthStart && tripEnd >= monthEnd)
      );
    });

    return filtered.sort((a, b) => {
      const aDone = startOfDay(new Date(a.return_datetime)) < todayStart;
      const bDone = startOfDay(new Date(b.return_datetime)) < todayStart;
      if (aDone && !bDone) return 1;
      if (!aDone && bDone) return -1;
      if (!aDone) {
        // oba aktywne → ASC po wyjeździe
        return new Date(a.departure_datetime).getTime() - new Date(b.departure_datetime).getTime();
      }
      // oba zakończone → DESC po wyjeździe (najnowszy na górze w grupie)
      return new Date(b.departure_datetime).getTime() - new Date(a.departure_datetime).getTime();
    });
  }, [filteredTrips, monthStart, monthEnd]);

  function getDaysLabel(trip: TripWithPaymentTemplates) {
    const departure = startOfDay(new Date(trip.departure_datetime));
    const returnDate = startOfDay(new Date(trip.return_datetime));
    const todayStart = startOfDay(today);

    if (returnDate < todayStart) return { label: 'Zakończony', variant: 'done' as const };
    if (departure <= todayStart && returnDate >= todayStart) return { label: 'W trakcie', variant: 'active' as const };
    const diff = differenceInCalendarDays(departure, todayStart);
    if (diff === 0) return { label: 'Dziś!', variant: 'today' as const };
    if (diff === 1) return { label: 'Jutro', variant: 'soon' as const };
    if (diff <= 7) return { label: `za ${diff} dni`, variant: 'soon' as const };
    if (diff <= 30) return { label: `za ${diff} dni`, variant: 'medium' as const };
    return { label: `za ${diff} dni`, variant: 'far' as const };
  }

  return (
    <div className="space-y-4">
      {/* Filtr grup */}
      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-gray-500 mr-1">Filtruj:</span>
          <button
            onClick={() => setGroupFilter('all')}
            className={cn(
              'px-4 py-1.5 rounded-xl text-sm font-medium transition-all duration-200',
              groupFilter === 'all'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50'
            )}
          >
            Wszystkie
          </button>
          {availableGroups.map((group) => {
            const color = getGroupColor(group.name);
            const isActive = groupFilter === group.id;
            return (
              <button
                key={group.id}
                onClick={() => setGroupFilter(isActive ? 'all' : group.id)}
                className={cn(
                  'px-4 py-1.5 rounded-xl text-sm font-medium transition-all duration-200 inline-flex items-center gap-2',
                  isActive
                    ? cn(color.bg, color.text, 'ring-1', color.border, 'shadow-sm')
                    : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50'
                )}
              >
                <span className={cn('w-2.5 h-2.5 rounded-full', color.dot)} />
                {group.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tabelka wyjazdów w tym miesiącu */}
      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentDate(subMonths(currentDate, 1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-500 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h3 className="font-semibold text-gray-900 capitalize px-1 min-w-[160px] text-center">
              {format(currentDate, 'LLLL yyyy', { locale: pl })}
            </h3>
            <button
              onClick={() => setCurrentDate(addMonths(currentDate, 1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-500 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-3 py-1 rounded-lg text-xs font-medium bg-white text-gray-500 ring-1 ring-gray-200 hover:bg-gray-50 transition-colors"
            >
              Dziś
            </button>
            <span className="text-sm text-gray-400 font-medium">
              {monthTrips.length}{' '}
              {monthTrips.length === 1 ? 'wyjazd' : monthTrips.length >= 2 && monthTrips.length <= 4 ? 'wyjazdy' : 'wyjazdów'}
            </span>
          </div>
        </div>

        {monthTrips.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center mb-3">
              <Calendar className="h-6 w-6 text-gray-300" />
            </div>
            <p className="text-gray-500 text-sm">
              {groupFilter === 'all' ? 'Brak wyjazdów w tym miesiącu' : 'Brak wyjazdów dla wybranej grupy w tym miesiącu'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr className="bg-gray-50/60 border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-5 py-3">Tytuł wyjazdu</th>
                  <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">
                    <span className="flex items-center gap-1">
                      <ArrowUpRight className="h-3.5 w-3.5 text-green-500" />
                      Wyjazd
                    </span>
                  </th>
                  <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">
                    <span className="flex items-center gap-1">
                      <ArrowDownLeft className="h-3.5 w-3.5 text-red-400" />
                      Powrót
                    </span>
                  </th>
                  <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">Dni do wyjazdu</th>
                  <th className="px-4 py-3 w-28" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {monthTrips.map((trip) => {
                  const { label, variant } = getDaysLabel(trip);
                  const badgeClass = {
                    done: 'bg-gray-100 text-gray-500',
                    active: 'bg-green-100 text-green-700',
                    today: 'bg-blue-600 text-white',
                    soon: 'bg-orange-100 text-orange-700',
                    medium: 'bg-yellow-100 text-yellow-700',
                    far: 'bg-gray-100 text-gray-600',
                  }[variant];

                  const dep = new Date(trip.departure_datetime);
                  const ret = new Date(trip.return_datetime);

                  return (
                    <tr key={trip.id} className="hover:bg-gray-50/60 transition-colors group">
                      {/* Tytuł */}
                      <td className="px-5 py-3.5 align-top">
                        <div className="flex items-start gap-2">
                          <div className="flex gap-1 flex-shrink-0 mt-0.5">
                            {trip.groups.map((g) => (
                              <span key={g.id} className={cn('w-2 h-2 rounded-full', getGroupColor(g.name).dot)} title={g.name} />
                            ))}
                          </div>
                          <span className="font-medium text-gray-900 text-sm leading-snug">{trip.title}</span>
                        </div>
                      </td>

                      {/* Wyjazd */}
                      <td className="px-4 py-3.5 align-top">
                        <div className="flex flex-col gap-0.5 text-sm">
                          <span className="font-semibold text-gray-900 whitespace-nowrap">{format(dep, 'd.MM.yyyy', { locale: pl })}</span>
                          <span className="text-gray-600 whitespace-nowrap">{format(dep, 'HH:mm', { locale: pl })}{trip.departure_location ? ` · ${trip.departure_location}` : ''}</span>
                          {trip.departure_stop2_datetime && trip.departure_stop2_location && (
                            <span className="text-gray-600 whitespace-nowrap">{format(new Date(trip.departure_stop2_datetime), 'HH:mm', { locale: pl })} · {trip.departure_stop2_location}</span>
                          )}
                        </div>
                      </td>

                      {/* Powrót */}
                      <td className="px-4 py-3.5 align-top">
                        <div className="flex flex-col gap-0.5 text-sm">
                          <span className="font-semibold text-gray-900 whitespace-nowrap">{format(ret, 'd.MM.yyyy', { locale: pl })}</span>
                          <span className="text-gray-600 whitespace-nowrap">{format(ret, 'HH:mm', { locale: pl })}{trip.return_location ? ` · ${trip.return_location}` : ''}</span>
                          {trip.return_stop2_datetime && trip.return_stop2_location && (
                            <span className="text-gray-600 whitespace-nowrap">{format(new Date(trip.return_stop2_datetime), 'HH:mm', { locale: pl })} · {trip.return_stop2_location}</span>
                          )}
                        </div>
                      </td>

                      {/* Dni do wyjazdu */}
                      <td className="px-4 py-3.5 whitespace-nowrap align-top">
                        <span className={cn('inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold', badgeClass)}>
                          {label}
                        </span>
                      </td>

                      {/* Przycisk Szczegóły */}
                      <td className="px-4 py-3.5 text-right align-top">
                        <Link
                          href={`/admin/trips/${trip.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors"
                        >
                          Szczegóły
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Kalendarz */}
      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-600 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h2 className="text-xl font-semibold text-gray-900 capitalize">
            {format(currentDate, 'LLLL yyyy', { locale: pl })}
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-3 py-1.5 rounded-xl text-sm font-medium bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50 transition-colors"
            >
              Dziś
            </button>
            <button
              onClick={() => setCurrentDate(addMonths(currentDate, 1))}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-600 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Dni tygodnia */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map((day) => (
            <div
              key={day}
              className="text-center text-xs font-medium text-gray-400 uppercase tracking-wider py-2"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Siatka dni */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, index) => {
            if (!day) {
              return <div key={`empty-${index}`} className="min-h-[100px]" />;
            }

            const dayTrips = getTripsForDay(day);
            const isToday = isSameDay(day, today);
            const isCurrentMonth = isSameMonth(day, currentDate);

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  'min-h-[100px] rounded-xl p-1.5 transition-colors',
                  isCurrentMonth ? 'bg-white ring-1 ring-gray-100' : 'bg-gray-50/50',
                  isToday && 'ring-2 ring-blue-400 bg-blue-50/30'
                )}
              >
                <div className={cn(
                  'text-sm font-medium mb-1',
                  isToday ? 'text-blue-600' : isCurrentMonth ? 'text-gray-900' : 'text-gray-300'
                )}>
                  {format(day, 'd')}
                </div>

                <div className="space-y-0.5">
                  <TooltipProvider delayDuration={200}>
                    {dayTrips.slice(0, 3).map((trip) => {
                      const dayType = getTripDayType(day, trip);
                      const primaryGroup = trip.groups[0];
                      const groupColor = primaryGroup ? getGroupColor(primaryGroup.name) : null;

                      return (
                        <HoverCard key={trip.id} openDelay={100} closeDelay={100}>
                          <HoverCardTrigger asChild>
                            <Link
                              href={`/admin/trips/${trip.id}`}
                              className={cn(
                                'block text-xs px-1 py-0.5 truncate cursor-pointer transition-opacity hover:opacity-80',
                                groupColor?.bg || 'bg-gray-100',
                                groupColor?.text || 'text-gray-700',
                                dayType === 'start' && 'rounded-l',
                                dayType === 'end' && 'rounded-r',
                                dayType === 'single' && 'rounded',
                                (dayType === 'middle' || dayType === 'start') && 'rounded-r-none mr-[-4px]',
                                (dayType === 'middle' || dayType === 'end') && 'rounded-l-none ml-[-4px]'
                              )}
                            >
                              {(dayType === 'start' || dayType === 'single') && (
                                <span className="flex items-center gap-1">
                                  {trip.groups.map((g) => (
                                    <span
                                      key={g.id}
                                      className={cn('w-2 h-2 rounded-full flex-shrink-0', getGroupColor(g.name).dot)}
                                    />
                                  ))}
                                  <span className="truncate">{trip.title}</span>
                                </span>
                              )}
                              {dayType === 'middle' && <span>&nbsp;</span>}
                              {dayType === 'end' && <span className="opacity-50">→</span>}
                            </Link>
                          </HoverCardTrigger>
                          <HoverCardContent side="right" align="start" className="w-80">
                            <TripTooltipContent trip={trip} />
                          </HoverCardContent>
                        </HoverCard>
                      );
                    })}
                  </TooltipProvider>

                  {dayTrips.length > 3 && (
                    <div className="text-xs text-gray-400 px-1">
                      +{dayTrips.length - 3} więcej
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}

function TripTooltipContent({ trip }: { trip: TripWithPaymentTemplates }) {
  const departureDate = new Date(trip.departure_datetime);
  const returnDate = new Date(trip.return_datetime);

  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center gap-2 mb-1">
          {trip.groups.map((g) => (
            <div
              key={g.id}
              className={cn('w-3 h-3 rounded-full', getGroupColor(g.name).dot)}
            />
          ))}
          <h4 className="font-semibold text-gray-900">{trip.title}</h4>
        </div>
        <div className="flex flex-wrap gap-1">
          {trip.groups.map((g) => {
            const colors = getGroupColor(g.name);
            return (
              <span
                key={g.id}
                className={cn(
                  'inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium border',
                  colors.bg, colors.text, colors.border
                )}
              >
                {g.name}
              </span>
            );
          })}
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-start gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-green-600 flex-shrink-0">
            <ArrowUpRight className="h-3 w-3 text-white" />
          </div>
          <div>
            <div className="font-medium text-gray-900">Wyjazd</div>
            <div className="text-gray-500">{format(departureDate, 'd MMMM yyyy, HH:mm', { locale: pl })}</div>
            {trip.departure_location && (
              <div className="text-gray-400 flex items-center gap-1 text-xs">
                <MapPin className="h-3 w-3" />
                {trip.departure_location}
              </div>
            )}
            {trip.departure_stop2_datetime && trip.departure_stop2_location && (
              <div className="text-gray-400 flex items-center gap-1 text-xs mt-0.5">
                <MapPin className="h-3 w-3" />
                Przystanek: {format(new Date(trip.departure_stop2_datetime), 'HH:mm', { locale: pl })} · {trip.departure_stop2_location}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-start gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-red-500 flex-shrink-0">
            <ArrowDownLeft className="h-3 w-3 text-white" />
          </div>
          <div>
            <div className="font-medium text-gray-900">Powrót</div>
            <div className="text-gray-500">{format(returnDate, 'd MMMM yyyy, HH:mm', { locale: pl })}</div>
            {trip.return_location && (
              <div className="text-gray-400 flex items-center gap-1 text-xs">
                <MapPin className="h-3 w-3" />
                {trip.return_location}
              </div>
            )}
            {trip.return_stop2_datetime && trip.return_stop2_location && (
              <div className="text-gray-400 flex items-center gap-1 text-xs mt-0.5">
                <MapPin className="h-3 w-3" />
                Przystanek: {format(new Date(trip.return_stop2_datetime), 'HH:mm', { locale: pl })} · {trip.return_stop2_location}
              </div>
            )}
          </div>
        </div>
      </div>

      {trip.description && (
        <p className="text-xs text-gray-400 line-clamp-2">
          {stripHtml(trip.description)}
        </p>
      )}

      <div className="pt-2 border-t border-gray-100">
        <Link
          href={`/admin/trips/${trip.id}`}
          className="flex items-center justify-center gap-1.5 w-full py-1.5 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
        >
          Szczegóły wyjazdu
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
