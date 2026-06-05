'use client';

import { useState, useLayoutEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import {
  UserPlus,
  Check,
  Edit,
  Trash2,
  Users,
  Plus,
  MapPin,
  CreditCard,
  MessageSquare,
  Clock,
  AlertCircle,
  Loader2,
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
import { saveChildToStorage } from './child-url-sync';

const STORAGE_KEY = 'biegun_selected_child';

import { deleteParticipant, getParticipantRegistrations } from '@/lib/actions/participants';
import { markMessageRead, type AppMessage } from '@/lib/actions/messages';
import { type DashboardData } from '@/lib/actions/dashboard';
import type { ParticipantWithGroup } from '@/types';
import { cn } from '@/lib/utils';
import { getGroupColor } from '@/lib/group-colors';
import { getCampVisual } from '@/lib/camp-visual';
import { PaymentDue } from '@/components/shared/payment-due';

interface ChildrenListProps {
  participants: ParticipantWithGroup[];
  initialMessages: AppMessage[];
  dashboardByChild: Record<string, DashboardData>;
  dashboardAll: DashboardData;
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

function pluralizeTrips(n: number): string {
  if (n === 1) return 'wyjazd';
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'wyjazdy';
  return 'wyjazdów';
}

export function ChildrenList({ participants, initialMessages, dashboardByChild, dashboardAll }: ChildrenListProps) {
  const router = useRouter();
  const [selectedChildId, setSelectedChildId] = useState<string>('all');
  const [messages, setMessages] = useState<AppMessage[]>(initialMessages);
  const [expandedMessage, setExpandedMessage] = useState<AppMessage | null>(null);
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null);

  // Dane dashboardu są policzone serwerowo i przekazane w propsach —
  // przełączenie dziecka to natychmiastowy odczyt z mapy (bez fetchu, bez skeletonów).
  const dashboardData: DashboardData = selectedChildId === 'all'
    ? dashboardAll
    : (dashboardByChild[selectedChildId] ?? dashboardAll);

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

  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>({
    isOpen: false,
    childId: null,
    childName: '',
    registrations: [],
    isLoading: false,
  });

  async function handleDeleteClick(e: React.MouseEvent, childId: string) {
    e.stopPropagation();
    const child = participants.find((c) => c.id === childId);
    if (!child || deleteLoadingId) return;
    setDeleteLoadingId(childId);
    try {
      const registrations = await getParticipantRegistrations(childId);
      setDeleteDialog({
        isOpen: true,
        childId,
        childName: `${child.first_name} ${child.last_name}`,
        registrations: registrations as DeleteDialogState['registrations'],
        isLoading: false,
      });
    } catch {
      toast.error('Nie udało się pobrać danych dziecka');
    } finally {
      setDeleteLoadingId(null);
    }
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

  if (participants.length === 0) {
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

  const selectedChild = participants.find((c) => c.id === selectedChildId);
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
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-stretch">
      <div className="flex h-full flex-col rounded-2xl bg-blue-600 p-4 text-white shadow-sm shadow-blue-600/15 lg:order-1">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold leading-tight">Moje dzieci</h2>
            <p className="mt-1.5 max-w-2xl text-xs text-blue-100">
              Wybierz dziecko i przejdź do jego informacji, wyjazdów oraz płatności.
            </p>
          </div>
          <Link
            href="/parent/children/add"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-50"
          >
            <Plus className="h-4 w-4" />
            Dodaj dziecko
          </Link>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleSelectAll}
            className={cn(
              'inline-flex min-h-9 items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ring-1',
              isAll
                ? 'bg-white text-blue-700 ring-white'
                : 'bg-white/12 text-white ring-white/20 hover:bg-white/20'
            )}
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-current/15">
              <Users className="h-3.5 w-3.5" />
            </span>
            Wszystkie dzieci
            {isAll && <Check className="h-3.5 w-3.5" />}
          </button>

          {participants.map((child) => {
            const isSelected = selectedChildId === child.id;
            const groupColor = getGroupColor(child.group?.name ?? '');

            return (
              <div
                key={child.id}
                className={cn(
                  'inline-flex min-h-9 items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ring-1',
                  isSelected
                    ? 'bg-white text-blue-700 ring-white'
                    : 'bg-white/12 text-white ring-white/20 hover:bg-white/20'
                )}
              >
                <button
                  onClick={() => handleSelectChild(child)}
                  className="inline-flex min-w-0 items-center gap-2"
                >
                  <span className={cn('flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-bold text-white', groupColor.dot)}>
                    {child.first_name.charAt(0)}
                  </span>
                  <span className="truncate">{child.first_name} {child.last_name}</span>
                  {isSelected && <Check className="h-3.5 w-3.5 flex-shrink-0" />}
                </button>
                <span className={cn('h-5 w-px', isSelected ? 'bg-blue-200' : 'bg-white/20')} />
                <Link
                  href={`/parent/children/${child.id}`}
                  className={cn('flex h-6 w-6 items-center justify-center rounded-md transition-colors', isSelected ? 'hover:bg-blue-50' : 'hover:bg-white/15')}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Edytuj ${child.first_name} ${child.last_name}`}
                >
                  <Edit className="h-3 w-3" />
                </Link>
                <button
                  onClick={(e) => handleDeleteClick(e, child.id)}
                  disabled={deleteLoadingId === child.id}
                  aria-label={`Usuń ${child.first_name} ${child.last_name}`}
                  className={cn('flex h-6 w-6 items-center justify-center rounded-md transition-colors disabled:opacity-60', isSelected ? 'hover:bg-red-50 hover:text-red-600' : 'hover:bg-white/15')}
                >
                  {deleteLoadingId === child.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

          {/* Najbliższe wyjazdy */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden lg:order-3">
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center">
                  <MapPin className="h-5 w-5 text-white" />
                </div>
                <p className="text-base font-semibold text-gray-800">Najbliższe wyjazdy</p>
              </div>
              <Link href={`/parent/trips${childSlug}`} className="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors">
                Wszystkie →
              </Link>
            </div>

            {upcomingTrips.length === 0 ? (
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
                      <div className="flex min-w-0 items-start gap-2">
                        {(() => {
                          const visual = getCampVisual(trip.category);
                          return (
                            <span className={cn('mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg', visual.iconBox)}>
                              <visual.Icon className="h-3.5 w-3.5" />
                            </span>
                          );
                        })()}
                        <div className="min-w-0">
                        <p className="font-semibold text-gray-900 text-sm leading-snug">{trip.title}</p>
                        {trip.childNames && trip.childNames.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {trip.childNames.map((name) => (
                              <span
                                key={name}
                                className="inline-flex items-center rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700"
                              >
                                {name}
                              </span>
                            ))}
                          </div>
                        )}
                        </div>
                      </div>
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
                      <span className="text-emerald-500 font-bold text-xs flex-shrink-0 mt-0.5">↗</span>
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-semibold text-gray-800 tabular-nums flex-shrink-0">
                            {format(new Date(trip.departure_datetime), 'HH:mm', { locale: pl })}
                          </span>
                          <span className="text-sm text-gray-600 truncate">{trip.departure_location || '—'}</span>
                        </div>
                        {trip.departure_stop2_location && (
                          <div className="flex items-baseline gap-2">
                            <span className="text-sm font-semibold text-gray-800 tabular-nums flex-shrink-0">
                              {trip.departure_stop2_datetime
                                ? format(new Date(trip.departure_stop2_datetime), 'HH:mm', { locale: pl })
                                : '—'}
                            </span>
                            <span className="text-sm text-gray-600 truncate">{trip.departure_stop2_location}</span>
                          </div>
                        )}
                        <p className="text-xs font-medium text-gray-500">
                          {format(new Date(trip.departure_datetime), 'd.MM.yyyy', { locale: pl })}
                        </p>
                      </div>
                    </div>

                    {/* Powrót */}
                    <div className="flex items-start gap-2">
                      <span className="text-red-500 font-bold text-xs flex-shrink-0 mt-0.5">↙</span>
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-semibold text-gray-800 tabular-nums flex-shrink-0">
                            {format(new Date(trip.return_datetime), 'HH:mm', { locale: pl })}
                          </span>
                          <span className="text-sm text-gray-600 truncate">{trip.return_location || '—'}</span>
                        </div>
                        {trip.return_stop2_location && (
                          <div className="flex items-baseline gap-2">
                            <span className="text-sm font-semibold text-gray-800 tabular-nums flex-shrink-0">
                              {trip.return_stop2_datetime
                                ? format(new Date(trip.return_stop2_datetime), 'HH:mm', { locale: pl })
                                : '—'}
                            </span>
                            <span className="text-sm text-gray-600 truncate">{trip.return_stop2_location}</span>
                          </div>
                        )}
                        <p className="text-xs font-medium text-gray-500">
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
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden lg:order-4">
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center">
                  <CreditCard className="h-5 w-5 text-white" />
                </div>
                <p className="text-base font-semibold text-gray-800">Płatności</p>
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

            {overduePayments.length === 0 && upcomingPayments.length === 0 ? (
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
                              <p className="mt-0.5">
                                <PaymentDue
                                  paymentDueDate={p.effective_due_date || p.due_date}
                                  status={p.status}
                                  className="text-[11px]"
                                />
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
                              <p className="mt-0.5">
                                <PaymentDue
                                  paymentDueDate={p.effective_due_date || p.due_date}
                                  status={p.status}
                                  className="text-[11px]"
                                />
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

          {/* Wiadomości */}
          <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm lg:order-2">
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center">
                  <MessageSquare className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-base font-semibold text-gray-800">Wiadomości</p>
                  <p className="text-[11px] text-gray-400">{messages.length} wiadomości od organizatora</p>
                </div>
              </div>
              <Link href="/parent/messages" className="text-xs text-blue-600 hover:text-blue-700 font-semibold">
                Wszystkie →
              </Link>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
              {messages.length === 0 ? (
                <div className="m-5 flex items-center gap-3 rounded-xl border border-dashed border-gray-200 bg-gray-50/60 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-gray-300 ring-1 ring-gray-200">
                    <MessageSquare className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-600">Brak nowych wiadomości</p>
                    <p className="text-xs text-gray-400">Powiadomienia o płatnościach i wyjazdach pojawią się tutaj.</p>
                  </div>
                </div>
              ) : (
                messages.slice(0, 2).map((msg) => (
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
                      <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] font-bold text-white">
                        BS
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-3">
                          <p className={cn('text-sm truncate', msg.is_read ? 'text-gray-600' : 'font-semibold text-gray-900')}>
                            {msg.title}
                          </p>
                          <span className="text-[11px] text-gray-400 flex-shrink-0">
                            {format(new Date(msg.created_at), 'd MMM', { locale: pl })}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">{msg.body}</p>
                        {!msg.is_read && (
                          <span className="inline-block mt-1.5 text-[10px] font-semibold text-blue-600">
                            • Nowa
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
      </div>

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
                        Dziecko jest zapisane na {deleteDialog.registrations.length}{' '}
                        {pluralizeTrips(deleteDialog.registrations.length)}:
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
