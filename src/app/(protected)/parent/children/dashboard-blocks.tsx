'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { MapPin, CreditCard, Activity, MessageSquare } from 'lucide-react';

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

  useEffect(() => {
    setIsLoading(true);
    setData(null);
    Promise.all([getDashboardData(participantId), getMessagesForParent()])
      .then(([dashboardData, messagesData]) => {
        setData(dashboardData);
        setMessages(messagesData);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [participantId]);

  async function handleMarkRead(messageId: string) {
    await markMessageRead(messageId);
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, is_read: true } : m))
    );
  }

  if (isLoading) {
    return (
      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="grid grid-cols-2 gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { nearestTrip, pendingPayments, overdueCount, attendance } = data;

  const unreadCount = messages.filter((m) => !m.is_read).length;

  const daysColor =
    nearestTrip == null
      ? ''
      : nearestTrip.daysUntil <= 7
        ? 'text-red-600'
        : nearestTrip.daysUntil <= 30
          ? 'text-amber-600'
          : 'text-green-600';

  const attendancePercent =
    attendance.total > 0
      ? Math.round((attendance.completed / attendance.total) * 100)
      : 0;

  return (
    <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">
        Panel — {participantName}
      </p>

      <div className="grid grid-cols-2 gap-2">
        {/* ── Najbliższy wyjazd ────────────────────────────────────── */}
        <div className="bg-blue-50 rounded-xl p-3 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />
            <span className="text-xs font-semibold text-blue-700">Najbliższy wyjazd</span>
          </div>
          {nearestTrip ? (
            <>
              <p className="text-xs font-medium text-gray-900 leading-snug line-clamp-2">
                {nearestTrip.title}
              </p>
              <p className="text-xs text-gray-500">
                {format(new Date(nearestTrip.departure_datetime), 'd MMM yyyy', { locale: pl })}
              </p>
              <p className={`text-xs font-bold ${daysColor}`}>
                {nearestTrip.daysUntil === 0
                  ? 'Dziś!'
                  : nearestTrip.daysUntil === 1
                    ? 'Jutro!'
                    : `Za ${nearestTrip.daysUntil} dni`}
              </p>
            </>
          ) : (
            <p className="text-xs text-gray-400">Brak zaplanowanych</p>
          )}
        </div>

        {/* ── Płatności ─────────────────────────────────────────────── */}
        <div className="bg-emerald-50 rounded-xl p-3 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <CreditCard className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
            <span className="text-xs font-semibold text-emerald-700">Płatności</span>
            {overdueCount > 0 && (
              <span className="ml-auto inline-flex items-center px-1.5 py-0.5 rounded-md text-xs font-bold bg-red-100 text-red-700 flex-shrink-0">
                {overdueCount} zaległ.
              </span>
            )}
          </div>
          {pendingPayments.length === 0 ? (
            <p className="text-xs text-gray-400">Brak oczekujących</p>
          ) : (
            <div className="space-y-1">
              {pendingPayments.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-1">
                  <span
                    className={`text-xs truncate ${p.isOverdue ? 'text-red-600' : 'text-gray-500'}`}
                  >
                    {p.due_date
                      ? format(new Date(p.due_date), 'd.MM', { locale: pl })
                      : '—'}{' '}
                    {p.trip_title && (
                      <span className="text-gray-400">{p.trip_title.slice(0, 12)}</span>
                    )}
                  </span>
                  <span
                    className={`text-xs font-semibold flex-shrink-0 ${p.isOverdue ? 'text-red-600' : 'text-gray-700'}`}
                  >
                    {(p.amount - p.amount_paid).toFixed(0)} {p.currency}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Frekwencja ────────────────────────────────────────────── */}
        <div className="bg-violet-50 rounded-xl p-3 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5 text-violet-600 flex-shrink-0" />
            <span className="text-xs font-semibold text-violet-700">Frekwencja</span>
          </div>
          {attendance.total === 0 ? (
            <p className="text-xs text-gray-400">Brak wyjazdów</p>
          ) : (
            <>
              <div className="h-1.5 bg-violet-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-violet-500 rounded-full transition-all duration-500"
                  style={{ width: `${attendancePercent}%` }}
                />
              </div>
              <p className="text-xs text-gray-600">
                {attendance.completed}/{attendance.total} wyjazdów · {attendancePercent}%
              </p>
            </>
          )}
        </div>

        {/* ── Wiadomości ────────────────────────────────────────────── */}
        <div className="bg-amber-50 rounded-xl p-3 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
            <span className="text-xs font-semibold text-amber-700">Wiadomości</span>
            {unreadCount > 0 && (
              <span className="ml-auto inline-flex items-center px-1.5 py-0.5 rounded-md text-xs font-bold bg-amber-200 text-amber-800 flex-shrink-0">
                {unreadCount} nowe
              </span>
            )}
          </div>
          {messages.length === 0 ? (
            <p className="text-xs text-gray-400">Brak wiadomości</p>
          ) : (
            <div className="space-y-1">
              {messages.slice(0, 3).map((msg) => (
                <div
                  key={msg.id}
                  className={`text-xs leading-snug cursor-pointer hover:underline ${
                    msg.is_read ? 'text-gray-500' : 'font-semibold text-gray-900'
                  }`}
                  onClick={() => !msg.is_read && handleMarkRead(msg.id)}
                  title={msg.body}
                >
                  {!msg.is_read && (
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 mr-1 mb-0.5 align-middle" />
                  )}
                  <span className="line-clamp-1">{msg.title}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
