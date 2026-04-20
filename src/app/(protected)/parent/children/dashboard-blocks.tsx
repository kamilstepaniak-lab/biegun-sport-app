'use client';

import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import Link from 'next/link';
import {
  MapPin,
  CreditCard,
  BarChart3,
  MessageSquare,
  ArrowUpRight,
  CalendarDays,
  FileText,
  AlertCircle,
  Clock,
  ChevronRight,
} from 'lucide-react';

import { getDashboardData, type DashboardData } from '@/lib/actions/dashboard';
import { getMessagesForParent, markMessageRead, type AppMessage } from '@/lib/actions/messages';

interface DashboardBlocksProps {
  participantId: string;
  participantName: string;
}

export function DashboardBlocks({ participantId, participantName }: DashboardBlocksProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [messages, setMessages] = useState<AppMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isFirstLoad = useRef(true);

  useEffect(() => {
    if (isFirstLoad.current) {
      setIsLoading(true);
    } else {
      // Przy zmianie dziecka — tylko subtelny indicator, stare dane zostają
      setIsRefreshing(true);
    }

    Promise.all([getDashboardData(participantId), getMessagesForParent()])
      .then(([dashboardData, messagesData]) => {
        setData(dashboardData);
        setMessages(messagesData);
      })
      .catch(console.error)
      .finally(() => {
        setIsLoading(false);
        setIsRefreshing(false);
        isFirstLoad.current = false;
      });
  }, [participantId]);

  async function handleMarkRead(messageId: string) {
    await markMessageRead(messageId);
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, is_read: true } : m))
    );
  }

  const childSlug = `?child=${participantId}&childName=${encodeURIComponent(participantName)}`;

  // ── Pierwsze ładowanie — skeleton ──
  if (isLoading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="h-px bg-gray-100 mt-2" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-2xl" />
          ))}
        </div>
        <div className="h-48 bg-gray-100 rounded-2xl" />
      </div>
    );
  }

  if (!data) return null;

  const { upcomingTrips, overduePayments, upcomingPayments, overdueCount, attendance } = data;
  const nearestTrip = upcomingTrips[0] ?? null;
  const pendingPayments = [...overduePayments, ...upcomingPayments];
  const unreadCount = messages.filter((m) => !m.is_read).length;
  const attendancePercent = attendance.total > 0
    ? Math.round((attendance.completed / attendance.total) * 100)
    : null;

  return (
    <div className={`space-y-4 transition-opacity duration-200 ${isRefreshing ? 'opacity-60' : 'opacity-100'}`}>
      {/* ── Separator ── */}
      <div className="flex items-center gap-3 pt-1">
        <div className="h-px flex-1 bg-gray-100" />
        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
          {participantName}
        </span>
        {isRefreshing && (
          <span className="w-3 h-3 rounded-full border-2 border-gray-300 border-t-gray-600 animate-spin" />
        )}
        <div className="h-px flex-1 bg-gray-100" />
      </div>

      {/* ── 4 stat karty ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Wyjazd */}
        <Link href={`/parent/trips${childSlug}`} className="group bg-white rounded-2xl ring-1 ring-gray-100 p-4 hover:ring-gray-300 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
              <MapPin className="h-4 w-4 text-gray-500" />
            </div>
            <ArrowUpRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-gray-500 transition-colors" />
          </div>
          {nearestTrip ? (
            <>
              <p className="text-xl font-bold text-gray-900 tabular-nums">
                {nearestTrip.daysUntil === 0 ? 'Dziś' : nearestTrip.daysUntil === 1 ? 'Jutro' : `${nearestTrip.daysUntil}d`}
              </p>
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{nearestTrip.title}</p>
            </>
          ) : (
            <>
              <p className="text-xl font-bold text-gray-300">—</p>
              <p className="text-xs text-gray-400 mt-0.5">Brak wyjazdów</p>
            </>
          )}
          <p className="text-[10px] text-gray-400 mt-2 font-medium uppercase tracking-wide">Wyjazd</p>
        </Link>

        {/* Płatności */}
        <Link href={`/parent/payments${childSlug}`} className="group bg-white rounded-2xl ring-1 ring-gray-100 p-4 hover:ring-gray-300 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
              <CreditCard className="h-4 w-4 text-gray-500" />
            </div>
            {overdueCount > 0 ? (
              <span className="text-xs font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-md">
                {overdueCount} zaległ.
              </span>
            ) : (
              <ArrowUpRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-gray-500 transition-colors" />
            )}
          </div>
          <p className="text-xl font-bold text-gray-900 tabular-nums">
            {pendingPayments.length}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {pendingPayments.length === 0 ? 'Wszystkie opłacone' : 'Oczekujących'}
          </p>
          <p className="text-[10px] text-gray-400 mt-2 font-medium uppercase tracking-wide">Płatności</p>
        </Link>

        {/* Frekwencja */}
        <Link href={`/parent/trips${childSlug}`} className="group bg-white rounded-2xl ring-1 ring-gray-100 p-4 hover:ring-gray-300 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
              <BarChart3 className="h-4 w-4 text-gray-500" />
            </div>
            <ArrowUpRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-gray-500 transition-colors" />
          </div>
          <p className="text-xl font-bold text-gray-900 tabular-nums">
            {attendancePercent !== null ? `${attendancePercent}%` : '—'}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {attendance.total > 0 ? `${attendance.completed} z ${attendance.total} wyjazdów` : 'Brak historii'}
          </p>
          <p className="text-[10px] text-gray-400 mt-2 font-medium uppercase tracking-wide">Frekwencja</p>
        </Link>

        {/* Wiadomości */}
        <div className="bg-white rounded-2xl ring-1 ring-gray-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
              <MessageSquare className="h-4 w-4 text-gray-500" />
            </div>
            {unreadCount > 0 && (
              <span className="text-xs font-bold text-white bg-blue-600 w-5 h-5 rounded-full flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </div>
          <p className="text-xl font-bold text-gray-900 tabular-nums">{messages.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {unreadCount > 0 ? `${unreadCount} nieprzeczytanych` : 'Wszystkie przeczytane'}
          </p>
          <p className="text-[10px] text-gray-400 mt-2 font-medium uppercase tracking-wide">Wiadomości</p>
        </div>
      </div>

      {/* ── Zawartość ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Nearest trip + Szybka nawigacja */}
        <div className="bg-white rounded-2xl ring-1 ring-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <p className="text-xs font-semibold text-gray-900 uppercase tracking-wide">Najbliższy wyjazd</p>
          </div>
          <div className="p-4">
            {nearestTrip ? (
              <div className="space-y-3">
                <div>
                  <p className="font-semibold text-gray-900">{nearestTrip.title}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Clock className="h-3.5 w-3.5 text-gray-400" />
                    <p className="text-sm text-gray-500">
                      {format(new Date(nearestTrip.departure_datetime), 'EEEE, d MMMM yyyy', { locale: pl })}
                    </p>
                  </div>
                </div>
                <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold ${
                  nearestTrip.daysUntil <= 7 ? 'bg-red-50 text-red-700' :
                  nearestTrip.daysUntil <= 30 ? 'bg-amber-50 text-amber-700' :
                  'bg-gray-50 text-gray-700'
                }`}>
                  <span>
                    {nearestTrip.daysUntil === 0 ? 'Dziś!' :
                     nearestTrip.daysUntil === 1 ? 'Jutro!' :
                     `Za ${nearestTrip.daysUntil} dni`}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400 py-2">Brak zaplanowanych wyjazdów</p>
            )}
          </div>

          {/* Nawigacja */}
          <div className="border-t border-gray-50 grid grid-cols-4 divide-x divide-gray-50">
            {[
              { href: `/parent/trips${childSlug}`, icon: MapPin, label: 'Wyjazdy' },
              { href: `/parent/payments${childSlug}`, icon: CreditCard, label: 'Płatności' },
              { href: `/parent/calendar${childSlug}`, icon: CalendarDays, label: 'Kalendarz' },
              { href: `/parent/contracts${childSlug}`, icon: FileText, label: 'Umowy' },
            ].map(({ href, icon: Icon, label }) => (
              <Link
                key={href}
                href={href}
                className="flex flex-col items-center gap-1 py-3 hover:bg-gray-50 transition-colors"
              >
                <Icon className="h-4 w-4 text-gray-500" />
                <span className="text-[10px] text-gray-500 font-medium">{label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Płatności do uregulowania */}
        <div className="bg-white rounded-2xl ring-1 ring-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-900 uppercase tracking-wide">Do zapłaty</p>
            <Link href={`/parent/payments${childSlug}`} className="text-xs text-gray-400 hover:text-gray-700 flex items-center gap-0.5">
              Wszystkie <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {pendingPayments.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <p className="text-sm text-gray-400">Brak zaległych płatności</p>
              </div>
            ) : (
              pendingPayments.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50/50 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{p.trip_title ?? 'Płatność'}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {p.isOverdue ? (
                        <AlertCircle className="h-3 w-3 text-red-500 flex-shrink-0" />
                      ) : (
                        <Clock className="h-3 w-3 text-gray-400 flex-shrink-0" />
                      )}
                      <p className={`text-xs ${p.isOverdue ? 'text-red-500' : 'text-gray-400'}`}>
                        {p.effective_due_date
                          ? `${p.isOverdue ? 'Termin minął' : 'Do'} ${format(new Date(p.effective_due_date), 'd MMM yyyy', { locale: pl })}`
                          : 'Brak terminu'}
                      </p>
                    </div>
                  </div>
                  <p className={`text-sm font-bold flex-shrink-0 ml-3 ${p.isOverdue ? 'text-red-600' : 'text-gray-900'}`}>
                    {(p.amount - p.amount_paid).toFixed(0)} {p.currency}
                  </p>
                </div>
              ))
            )}
          </div>

          {/* Wiadomości */}
          {messages.length > 0 && (
            <>
              <div className="px-4 py-3 border-t border-gray-100 border-b border-gray-50">
                <p className="text-xs font-semibold text-gray-900 uppercase tracking-wide">Wiadomości</p>
              </div>
              <div className="divide-y divide-gray-50">
                {messages.slice(0, 3).map((msg) => (
                  <button
                    key={msg.id}
                    onClick={() => !msg.is_read && handleMarkRead(msg.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50 transition-colors text-left"
                  >
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${msg.is_read ? 'bg-gray-200' : 'bg-blue-500'}`} />
                    <p className={`text-sm truncate ${msg.is_read ? 'text-gray-500' : 'font-medium text-gray-900'}`}>
                      {msg.title}
                    </p>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
