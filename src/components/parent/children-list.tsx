'use client';

import { useState, useEffect, useLayoutEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { differenceInYears, format } from 'date-fns';
import { pl } from 'date-fns/locale';
import {
  UserPlus,
  Check,
  Edit,
  Trash2,
  Calendar,
  Ruler,
  Users,
  Plus,
  MapPin,
  CreditCard,
  MessageSquare,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { EmptyState } from '@/components/shared';
import { saveChildToStorage } from './child-url-sync';

const STORAGE_KEY = 'biegun_selected_child';

import { deleteParticipant, getParticipantRegistrations } from '@/lib/actions/participants';
import { getMessagesForParent, markMessageRead, type AppMessage } from '@/lib/actions/messages';
import { getDashboardData, type DashboardData } from '@/lib/actions/dashboard';
import type { ParticipantWithGroup } from '@/types';
import { cn } from '@/lib/utils';

interface ChildrenListProps {
  children: ParticipantWithGroup[];
}

interface DeleteDialogState {
  isOpen: boolean;
  childId: string | null;
  childName: string;
  registrations: Array<{
    id: string;
    trip: { title: string } | { title: string }[] | null;
    payments: Array<{ status: string; amount: number; currency: string }>;
  }>;
  isLoading: boolean;
}

const avatarColors = [
  { bg: 'bg-blue-100', text: 'text-blue-700' },
];

export function ChildrenList({ children }: ChildrenListProps) {
  const router = useRouter();
  const [selectedChildId, setSelectedChildId] = useState<string>('all');
  const [messages, setMessages] = useState<AppMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [expandedMessage, setExpandedMessage] = useState<AppMessage | null>(null);

  // useLayoutEffect — runs before browser paints, eliminates CLS from 'all' → child switch
  useLayoutEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.id) setSelectedChildId(parsed.id);
      } else {
        saveChildToStorage('all', 'Wszystkie dzieci');
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    setMessagesLoading(true);
    getMessagesForParent()
      .then(setMessages)
      .catch(console.error)
      .finally(() => setMessagesLoading(false));
  }, []);

  useEffect(() => {
    if (selectedChildId === 'all') {
      setDashboardData(null);
      return;
    }
    setDashboardLoading(true);
    getDashboardData(selectedChildId)
      .then(setDashboardData)
      .catch(console.error)
      .finally(() => setDashboardLoading(false));
  }, [selectedChildId]);

  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>({
    isOpen: false,
    childId: null,
    childName: '',
    registrations: [],
    isLoading: false,
  });

  async function handleDeleteClick(e: React.MouseEvent, childId: string) {
    e.stopPropagation();
    const child = children.find((c) => c.id === childId);
    if (!child) return;
    const registrations = await getParticipantRegistrations(childId);
    setDeleteDialog({
      isOpen: true,
      childId,
      childName: `${child.first_name} ${child.last_name}`,
      registrations: registrations as DeleteDialogState['registrations'],
      isLoading: false,
    });
  }

  async function handleDeleteConfirm() {
    if (!deleteDialog.childId) return;
    setDeleteDialog((prev) => ({ ...prev, isLoading: true }));
    try {
      const result = await deleteParticipant(deleteDialog.childId);
      if (result.error) {
        toast.error(result.error);
      } else {
        if (selectedChildId === deleteDialog.childId) {
          setSelectedChildId('all');
          saveChildToStorage('all', 'Wszystkie dzieci');
        }
        toast.success('Dziecko zostało usunięte');
        router.refresh();
      }
    } catch {
      toast.error('Wystąpił nieoczekiwany błąd');
    } finally {
      setDeleteDialog({ isOpen: false, childId: null, childName: '', registrations: [], isLoading: false });
    }
  }

  function handleSelectAll() {
    setSelectedChildId('all');
    saveChildToStorage('all', 'Wszystkie dzieci');
  }

  function handleSelectChild(child: ParticipantWithGroup) {
    const childName = `${child.first_name} ${child.last_name}`;
    if (selectedChildId === child.id) {
      setSelectedChildId('all');
      saveChildToStorage('all', 'Wszystkie dzieci');
    } else {
      setSelectedChildId(child.id);
      saveChildToStorage(child.id, childName);
    }
  }

  async function handleMarkRead(messageId: string) {
    await markMessageRead(messageId);
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, is_read: true } : m))
    );
  }

  if (children.length === 0) {
    return (
      <div className="max-w-lg mx-auto mt-12 text-center space-y-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-white mx-auto">
          <UserPlus className="h-8 w-8" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Witaj w BiegunSport!</h2>
          <p className="text-sm text-gray-500 mb-6">
            Aby rozpocząć, dodaj swoje dziecko do systemu.
          </p>
        </div>
        <div className="bg-white rounded-2xl ring-1 ring-gray-100 p-6 text-left space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Jak zacząć?</h3>
          <ol className="text-sm text-gray-600 space-y-3">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex-shrink-0">1</span>
              <span>Kliknij przycisk <strong>&quot;Dodaj dziecko&quot;</strong> poniżej i uzupełnij dane: imię, nazwisko, data urodzenia.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex-shrink-0">2</span>
              <span>Wybierz <strong>grupę treningową</strong> do której należy dziecko (jeśli nie wiesz, zapytaj instruktora).</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex-shrink-0">3</span>
              <span>Po dodaniu dziecka zobaczysz dostępne <strong>wyjazdy</strong> i będziesz mógł potwierdzić udział.</span>
            </li>
          </ol>
        </div>
      </div>
    );
  }

  const hasUnpaidPayments = deleteDialog.registrations.some((r) =>
    r.payments.some((p) => p.status !== 'paid' && p.status !== 'cancelled')
  );

  const selectedChild = children.find((c) => c.id === selectedChildId);
  const unreadCount = messages.filter((m) => !m.is_read).length;
  const isAll = selectedChildId === 'all';

  const childSlug = isAll
    ? '?child=all'
    : selectedChild
      ? `?child=${selectedChild.id}&childName=${encodeURIComponent(`${selectedChild.first_name} ${selectedChild.last_name}`)}`
      : '?child=all';

  const {
    upcomingTrips = [],
    overduePayments = [],
    upcomingPayments = [],
    overdueCount = 0,
  } = dashboardData ?? {};

  const sumByCurrency = (payments: typeof overduePayments) =>
    payments.reduce((acc, p) => {
      const remaining = p.amount - p.amount_paid;
      acc[p.currency] = (acc[p.currency] || 0) + remaining;
      return acc;
    }, {} as Record<string, number>);

  const formatSum = (sums: Record<string, number>) =>
    Object.entries(sums)
      .sort(([a], [b]) => (a === 'PLN' ? -1 : b === 'PLN' ? 1 : 0))
      .map(([currency, total]) => `${total.toFixed(0)} ${currency}`)
      .join(' · ');

  const overdueSum = formatSum(sumByCurrency(overduePayments));
  const upcomingSum = formatSum(sumByCurrency(upcomingPayments));

  return (
    <>
      {/* ── Górny rząd: Wybór dziecka | Wiadomości ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* LEWY: Lista dzieci */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                <Users className="h-4 w-4 text-white" />
              </div>
              <p className="text-sm font-semibold text-gray-800">Moje dzieci</p>
            </div>
            <Link
              href="/parent/children/add"
              className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Dodaj
            </Link>
          </div>

          <div className="divide-y divide-gray-50">
            {/* Opcja "Wszystkie dzieci" */}
            <div
              onClick={handleSelectAll}
              className={cn(
                'flex items-center gap-3 px-5 py-3.5 cursor-pointer transition-all duration-150 relative',
                isAll ? 'bg-blue-50/50' : 'hover:bg-gray-50'
              )}
            >
              {isAll && (
                <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-blue-500 rounded-r-sm" />
              )}
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={cn(
                    'text-sm font-semibold',
                    isAll ? 'text-blue-700' : 'text-gray-800'
                  )}>
                    Wszystkie dzieci
                  </p>
                  {isAll && (
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-500 flex-shrink-0">
                      <Check className="h-2.5 w-2.5 text-white" />
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5">Widok zbiorczy wszystkich dzieci</p>
              </div>
            </div>

            {children.map((child, index) => {
              const birthDate = new Date(child.birth_date);
              const age = differenceInYears(new Date(), birthDate);
              const isSelected = selectedChildId === child.id;
              const color = avatarColors[index % avatarColors.length];

              return (
                <div
                  key={child.id}
                  onClick={() => handleSelectChild(child)}
                  className={cn(
                    'flex items-center gap-3 px-5 py-3.5 cursor-pointer transition-all duration-150 relative',
                    isSelected ? 'bg-blue-50/50' : 'hover:bg-gray-50'
                  )}
                >
                  {isSelected && (
                    <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-blue-500 rounded-r-sm" />
                  )}

                  <div className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0',
                    color.bg, color.text
                  )}>
                    {child.first_name.charAt(0)}{child.last_name.charAt(0)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={cn(
                        'text-sm font-semibold',
                        isSelected ? 'text-blue-700' : 'text-gray-800'
                      )}>
                        {child.first_name} {child.last_name}
                      </p>
                      {isSelected && (
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-500 flex-shrink-0">
                          <Check className="h-2.5 w-2.5 text-white" />
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2.5 text-[11px] text-gray-400 mt-0.5">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-2.5 w-2.5" />
                        {age} lat
                      </span>
                      {child.height_cm && (
                        <span className="flex items-center gap-1">
                          <Ruler className="h-2.5 w-2.5" />
                          {child.height_cm} cm
                        </span>
                      )}
                      {child.group && (
                        <span className="flex items-center gap-1">
                          <Users className="h-2.5 w-2.5" />
                          {child.group.name}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Link
                      href={`/parent/children/${child.id}`}
                      className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
                    >
                      <Edit className="h-3.5 w-3.5 text-gray-400" />
                    </Link>
                    <button
                      onClick={(e) => handleDeleteClick(e, child.id)}
                      className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-gray-400 hover:text-red-500" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {!isAll && (
            <div className="px-5 py-3 border-t border-gray-50">
              <p className="text-xs text-gray-400 text-center">Kliknij ponownie aby wrócić do widoku zbiorczego</p>
            </div>
          )}
        </div>

        {/* PRAWY: Wiadomości */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col" style={{ minHeight: '300px' }}>
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                <MessageSquare className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">Wiadomości od organizatora</p>
                {!messagesLoading && (
                  <p className="text-[11px] text-gray-400">{messages.length} komunikatów</p>
                )}
              </div>
            </div>
            {unreadCount > 0 && (
              <span className="text-xs font-bold text-white bg-blue-500 px-2.5 py-1 rounded-full">
                {unreadCount} nowych
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
            {messagesLoading ? (
              <div className="p-5 space-y-4 animate-pulse">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gray-100 flex-shrink-0" />
                    <div className="flex-1 space-y-2 pt-1">
                      <div className="h-3.5 bg-gray-100 rounded w-2/3" />
                      <div className="h-3 bg-gray-100 rounded w-full" />
                      <div className="h-3 bg-gray-100 rounded w-4/5" />
                    </div>
                  </div>
                ))}
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-12 text-center px-6">
                <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center mb-3">
                  <MessageSquare className="h-6 w-6 text-white/40" />
                </div>
                <p className="text-sm font-medium text-gray-500">Brak wiadomości</p>
                <p className="text-xs text-gray-400 mt-1">Organizator nie wysłał jeszcze żadnych komunikatów</p>
              </div>
            ) : (
              messages.map((msg) => (
                <button
                  key={msg.id}
                  onClick={() => {
                    setExpandedMessage(msg);
                    if (!msg.is_read) handleMarkRead(msg.id);
                  }}
                  className={cn(
                    'w-full text-left px-5 py-4 hover:bg-gray-50 transition-colors',
                    !msg.is_read && 'bg-blue-50/20'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5',
                      msg.is_read ? 'bg-gray-100' : 'bg-blue-100'
                    )}>
                      <MessageSquare className={cn('h-3.5 w-3.5', msg.is_read ? 'text-gray-400' : 'text-blue-500')} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className={cn(
                          'text-sm truncate',
                          msg.is_read ? 'text-gray-600' : 'font-semibold text-gray-900'
                        )}>
                          {msg.title}
                        </p>
                        <span className="text-[11px] text-gray-400 flex-shrink-0">
                          {format(new Date(msg.created_at), 'd MMM', { locale: pl })}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                        {msg.body}
                      </p>
                      <span className="inline-block mt-1.5 text-[10px] font-medium text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">
                        {!msg.is_read ? 'Nowa • Kliknij aby przeczytać' : 'Kliknij aby przeczytać'}
                      </span>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Dolny rząd: Wyjazdy | Płatności ── */}
      {!isAll && selectedChild && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5">

          {/* Najbliższe wyjazdy */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                  <MapPin className="h-4 w-4 text-white" />
                </div>
                <p className="text-sm font-semibold text-gray-800">Najbliższe wyjazdy</p>
              </div>
              <Link href={`/parent/trips${childSlug}`} className="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors">
                Wszystkie →
              </Link>
            </div>

            {dashboardLoading ? (
              <div className="p-5 animate-pulse space-y-4">
                {[1, 2].map((i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-4 bg-gray-100 rounded w-3/4" />
                    <div className="h-3 bg-gray-100 rounded w-1/2" />
                    <div className="h-3 bg-gray-100 rounded w-2/3" />
                  </div>
                ))}
              </div>
            ) : upcomingTrips.length === 0 ? (
              <div className="flex flex-col items-center py-6 text-center px-5">
                <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center mb-3">
                  <MapPin className="h-5 w-5 text-gray-300" />
                </div>
                <p className="text-sm text-gray-500 font-medium">Brak zaplanowanych wyjazdów</p>
                <p className="text-xs text-gray-400 mt-1">Dziecko nie jest zapisane na żaden nadchodzący wyjazd</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {upcomingTrips.map((trip) => (
                  <div key={trip.id} className="px-5 py-4 space-y-2.5">
                    {/* Tytuł + badge */}
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-gray-900 text-sm leading-snug">{trip.title}</p>
                      <span className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-semibold flex-shrink-0',
                        trip.daysUntil === 0
                          ? 'bg-blue-600 text-white'
                          : trip.daysUntil <= 7
                            ? 'bg-red-50 text-red-700'
                            : 'bg-blue-50 text-blue-700'
                      )}>
                        {trip.daysUntil === 0 ? 'Dziś!' : trip.daysUntil === 1 ? 'Jutro!' : `Za ${trip.daysUntil} dni`}
                      </span>
                    </div>

                    {/* Wyjazd */}
                    <div className="flex items-start gap-2">
                      <span className="text-green-500 font-bold text-xs flex-shrink-0 mt-0.5">↗</span>
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-baseline gap-2">
                          <span className="text-xs font-medium text-gray-800 tabular-nums flex-shrink-0">
                            {format(new Date(trip.departure_datetime), 'HH:mm', { locale: pl })}
                          </span>
                          <span className="text-xs text-gray-500 truncate">{trip.departure_location || '—'}</span>
                        </div>
                        {trip.departure_stop2_location && (
                          <div className="flex items-baseline gap-2">
                            <span className="text-xs font-medium text-gray-800 tabular-nums flex-shrink-0">
                              {trip.departure_stop2_datetime
                                ? format(new Date(trip.departure_stop2_datetime), 'HH:mm', { locale: pl })
                                : '—'}
                            </span>
                            <span className="text-xs text-gray-500 truncate">{trip.departure_stop2_location}</span>
                          </div>
                        )}
                        <p className="text-[10px] text-gray-400">
                          {format(new Date(trip.departure_datetime), 'd.MM.yyyy', { locale: pl })}
                        </p>
                      </div>
                    </div>

                    {/* Powrót */}
                    <div className="flex items-start gap-2">
                      <span className="text-red-500 font-bold text-xs flex-shrink-0 mt-0.5">↙</span>
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-baseline gap-2">
                          <span className="text-xs font-medium text-gray-800 tabular-nums flex-shrink-0">
                            {format(new Date(trip.return_datetime), 'HH:mm', { locale: pl })}
                          </span>
                          <span className="text-xs text-gray-500 truncate">{trip.return_location || '—'}</span>
                        </div>
                        {trip.return_stop2_location && (
                          <div className="flex items-baseline gap-2">
                            <span className="text-xs font-medium text-gray-800 tabular-nums flex-shrink-0">
                              {trip.return_stop2_datetime
                                ? format(new Date(trip.return_stop2_datetime), 'HH:mm', { locale: pl })
                                : '—'}
                            </span>
                            <span className="text-xs text-gray-500 truncate">{trip.return_stop2_location}</span>
                          </div>
                        )}
                        <p className="text-[10px] text-gray-400">
                          {format(new Date(trip.return_datetime), 'd.MM.yyyy', { locale: pl })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Płatności */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                  <CreditCard className="h-4 w-4 text-white" />
                </div>
                <p className="text-sm font-semibold text-gray-800">Płatności</p>
              </div>
              <div className="flex items-center gap-2">
                {overdueCount > 0 && (
                  <span className="text-xs font-bold text-white bg-red-500 px-2 py-0.5 rounded-full">
                    {overdueCount} zaległe
                  </span>
                )}
                <Link href={`/parent/payments${childSlug}`} className="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors">
                  Wszystkie →
                </Link>
              </div>
            </div>

            {dashboardLoading ? (
              <div className="p-5 animate-pulse space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3.5 bg-gray-100 rounded w-2/3" />
                      <div className="h-3 bg-gray-100 rounded w-1/3" />
                    </div>
                    <div className="h-5 bg-gray-100 rounded w-16" />
                  </div>
                ))}
              </div>
            ) : overduePayments.length === 0 && upcomingPayments.length === 0 ? (
              <div className="flex flex-col items-center py-6 text-center px-5">
                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center mb-3">
                  <CreditCard className="h-5 w-5 text-blue-300" />
                </div>
                <p className="text-sm text-gray-500 font-medium">Wszystkie płatności opłacone</p>
                <p className="text-xs text-gray-400 mt-1">Brak zaległych lub oczekujących płatności</p>
              </div>
            ) : (
              <div>
                {/* Sekcja: Po terminie */}
                {overduePayments.length > 0 && (
                  <>
                    <div className="px-5 py-2 bg-red-50/60 border-b border-red-100 flex items-center justify-between">
                      <p className="text-[11px] font-semibold text-red-600 uppercase tracking-wide">
                        Po terminie ({overduePayments.length})
                      </p>
                      {overdueSum && (
                        <p className="text-[11px] font-bold text-red-600">{overdueSum}</p>
                      )}
                    </div>
                    <div className="divide-y divide-gray-50">
                      {overduePayments.map((p) => (
                        <div key={p.id} className="flex items-center justify-between px-5 py-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">
                                {p.trip_title || 'Płatność'}
                              </p>
                              <p className="text-[11px] text-red-500 mt-0.5">
                                {p.due_date ? format(new Date(p.due_date), 'd MMM yyyy', { locale: pl }) : ''}
                                {p.daysOverdue > 0 && ` · ${p.daysOverdue}d po term.`}
                              </p>
                            </div>
                          </div>
                          <p className="text-sm font-bold text-red-600 flex-shrink-0 ml-3">
                            {(p.amount - p.amount_paid).toFixed(0)} {p.currency}
                          </p>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Sekcja: Do zapłaty */}
                {upcomingPayments.length > 0 && (
                  <>
                    <div className={cn(
                      'px-5 py-2 border-b border-gray-100 flex items-center justify-between',
                      overduePayments.length > 0 ? 'bg-gray-50 border-t border-gray-100' : 'bg-gray-50/50'
                    )}>
                      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                        Do zapłaty ({upcomingPayments.length})
                      </p>
                      {upcomingSum && (
                        <p className="text-[11px] font-bold text-gray-700">{upcomingSum}</p>
                      )}
                    </div>
                    <div className="divide-y divide-gray-50">
                      {upcomingPayments.map((p) => (
                        <div key={p.id} className="flex items-center justify-between px-5 py-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Clock className="h-4 w-4 text-blue-400 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">
                                {p.trip_title || 'Płatność'}
                              </p>
                              <p className="text-[11px] text-gray-400 mt-0.5">
                                {p.due_date ? format(new Date(p.due_date), 'd MMM yyyy', { locale: pl }) : 'Brak terminu'}
                                {p.daysUntilDue !== null && p.daysUntilDue >= 0 && (
                                  <span className="text-blue-400">
                                    {p.daysUntilDue === 0 ? ' · dziś!' : p.daysUntilDue === 1 ? ' · jutro' : ` · za ${p.daysUntilDue}d`}
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                          <p className="text-sm font-bold text-gray-900 flex-shrink-0 ml-3">
                            {(p.amount - p.amount_paid).toFixed(0)} {p.currency}
                          </p>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal pełnej wiadomości */}
      <Dialog open={!!expandedMessage} onOpenChange={(open) => !open && setExpandedMessage(null)}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
                <MessageSquare className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-base font-semibold text-gray-900 leading-tight">
                  {expandedMessage?.title}
                </DialogTitle>
                {expandedMessage && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {format(new Date(expandedMessage.created_at), 'd MMMM yyyy, HH:mm', { locale: pl })}
                  </p>
                )}
              </div>
            </div>
          </DialogHeader>
          <div className="mt-2 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap max-h-[60vh] overflow-y-auto pr-1">
            {expandedMessage?.body}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog usunięcia */}
      <AlertDialog
        open={deleteDialog.isOpen}
        onOpenChange={(open) =>
          !deleteDialog.isLoading &&
          setDeleteDialog((prev) => ({ ...prev, isOpen: open }))
        }
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Czy na pewno chcesz usunąć {deleteDialog.childName}?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                {deleteDialog.registrations.length > 0 && (
                  <Alert variant="destructive">
                    <AlertTitle>UWAGA</AlertTitle>
                    <AlertDescription>
                      <p className="mb-2">
                        Dziecko jest zapisane na {deleteDialog.registrations.length} wyjazdy:
                      </p>
                      <ul className="list-disc list-inside space-y-1">
                        {deleteDialog.registrations.map((r) => (
                          <li key={r.id}>
                            {Array.isArray(r.trip) ? r.trip[0]?.title : r.trip?.title || 'Nieznany wyjazd'}
                            {r.payments.length > 0 && (
                              <span className="text-muted-foreground">
                                {' '}
                                ({r.payments.length} płatności
                                {hasUnpaidPayments && ', zaległe płatności'})
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
                <div className="text-sm">
                  <p className="font-medium mb-2">Usunięcie dziecka:</p>
                  <ul className="list-none space-y-1 text-muted-foreground">
                    <li>• Usunie wszystkie zapisy na wyjazdy</li>
                    <li>• Usunie historię płatności</li>
                    <li>• Tej operacji nie można cofnąć</li>
                  </ul>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteDialog.isLoading} className="rounded-xl">
              Anuluj
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleteDialog.isLoading}
              className="bg-red-600 hover:bg-red-700 rounded-xl"
            >
              {deleteDialog.isLoading ? 'Usuwanie...' : 'Usuń dziecko'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
