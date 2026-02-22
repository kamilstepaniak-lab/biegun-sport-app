'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import {
  ChevronDown,
  ChevronUp,
  Calendar,
  Users,
  Edit,
  UserCheck,
  MapPin,
  Banknote,
  Receipt,
  Copy,
  Trash2,
  CopyPlus,
  Loader2,
  Mail,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';

import { Checkbox } from '@/components/ui/checkbox';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
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

import { deleteTrip, duplicateTrip } from '@/lib/actions/trips';
import { TripMessageGenerator } from '@/components/admin/trip-message-generator';
import { ContractTemplateEditor } from '@/components/admin/contract-template-editor';
import { getGroupColor } from '@/lib/group-colors';
import { cn } from '@/lib/utils';
import { CONTRACT_TEMPLATE } from '@/lib/contract-template';
import type { TripWithPaymentTemplates, Group, TripContractTemplate } from '@/types';

interface TripsListProps {
  trips: TripWithPaymentTemplates[];
  groups: Group[];
  contractTemplates: Record<string, { is_active: boolean; template_text: string } | null>;
}

const statusLabels: Record<string, string> = {
  draft: 'Szkic',
  published: 'Opublikowany',
  cancelled: 'Anulowany',
  completed: 'Zakończony',
};

const statusStyles: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  published: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-600',
  completed: 'bg-blue-100 text-blue-600',
};

function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text);
  toast.success(`${label} skopiowany do schowka`);
}

// Grupowanie wyjazdów po miesiącach
function groupTripsByMonth(trips: TripWithPaymentTemplates[]) {
  const grouped: { month: string; monthKey: string; trips: TripWithPaymentTemplates[] }[] = [];

  const sortedTrips = [...trips].sort(
    (a, b) => new Date(a.departure_datetime).getTime() - new Date(b.departure_datetime).getTime()
  );

  sortedTrips.forEach((trip) => {
    const date = new Date(trip.departure_datetime);
    const monthKey = format(date, 'yyyy-MM');
    const monthLabel = format(date, 'LLLL yyyy', { locale: pl });

    const existing = grouped.find((g) => g.monthKey === monthKey);
    if (existing) {
      existing.trips.push(trip);
    } else {
      grouped.push({ month: monthLabel, monthKey, trips: [trip] });
    }
  });

  return grouped;
}

// Czas inicjalizacji modułu — używamy jako stałej referencji żeby useMemo nie re-kalkulował przy każdym render
const MODULE_LOAD_TIME = new Date();

export function TripsList({ trips, groups, contractTemplates }: TripsListProps) {
  const router = useRouter();
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [openTrips, setOpenTrips] = useState<Set<string>>(new Set());
  const [completedOpen, setCompletedOpen] = useState(false);
  const [selectedTrips, setSelectedTrips] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [duplicatingTripId, setDuplicatingTripId] = useState<string | null>(null);

  const now = MODULE_LOAD_TIME;

  // Filtruj po grupie
  const filteredTrips = useMemo(() => {
    return trips.filter((trip) => {
      if (groupFilter === 'all') return true;
      return trip.groups.some((g) => g.id === groupFilter);
    });
  }, [trips, groupFilter]);

  // Podziel na aktywne i zakończone
  const activeTrips = useMemo(() => {
    return filteredTrips.filter((trip) => {
      const returnDate = new Date(trip.return_datetime);
      return returnDate >= now && trip.status !== 'completed';
    });
  }, [filteredTrips, now]);

  const completedTrips = useMemo(() => {
    return filteredTrips.filter((trip) => {
      const returnDate = new Date(trip.return_datetime);
      return returnDate < now || trip.status === 'completed';
    });
  }, [filteredTrips, now]);

  // Grupuj aktywne po miesiącach
  const activeByMonth = useMemo(() => groupTripsByMonth(activeTrips), [activeTrips]);

  function toggleTrip(tripId: string) {
    const newOpen = new Set(openTrips);
    if (newOpen.has(tripId)) {
      newOpen.delete(tripId);
    } else {
      newOpen.add(tripId);
    }
    setOpenTrips(newOpen);
  }

  function toggleSelectTrip(tripId: string, e: React.MouseEvent) {
    e.stopPropagation();
    const newSelected = new Set(selectedTrips);
    if (newSelected.has(tripId)) {
      newSelected.delete(tripId);
    } else {
      newSelected.add(tripId);
    }
    setSelectedTrips(newSelected);
  }

  async function handleDeleteSelected() {
    if (selectedTrips.size === 0) return;

    setIsDeleting(true);
    let deletedCount = 0;
    let errorCount = 0;

    for (const tripId of selectedTrips) {
      const result = await deleteTrip(tripId);
      if (result.error) {
        errorCount++;
        console.error('Delete trip error:', result.error);
      } else {
        deletedCount++;
      }
    }

    setIsDeleting(false);
    setShowDeleteDialog(false);

    if (deletedCount > 0) {
      toast.success(`Usunięto ${deletedCount} wyjazdów`);
      setSelectedTrips(new Set());
      router.refresh();
    }
    if (errorCount > 0) {
      toast.error(`Nie udało się usunąć ${errorCount} wyjazdów`);
    }
  }

  async function handleDuplicateSelected() {
    if (selectedTrips.size === 0) return;

    let successCount = 0;
    let errorCount = 0;

    for (const tripId of selectedTrips) {
      setDuplicatingTripId(tripId);
      try {
        const result = await duplicateTrip(tripId);
        if (result.error) {
          errorCount++;
        } else {
          successCount++;
        }
      } catch {
        errorCount++;
      }
    }

    setDuplicatingTripId(null);
    setSelectedTrips(new Set());

    if (successCount > 0) {
      toast.success(`Zduplikowano ${successCount} wyjazdów`);
      router.refresh();
    }
    if (errorCount > 0) {
      toast.error(`Nie udało się zduplikować ${errorCount} wyjazdów`);
    }
  }

  function TripBlock({ trip }: { trip: TripWithPaymentTemplates }) {
    const isOpen = openTrips.has(trip.id);
    const isSelected = selectedTrips.has(trip.id);
    const departureDate = new Date(trip.departure_datetime);
    const returnDate = new Date(trip.return_datetime);

    return (
      <Collapsible
        open={isOpen}
        onOpenChange={() => toggleTrip(trip.id)}
      >
        <div className={cn(
          'bg-white rounded-2xl transition-all duration-200',
          isOpen
            ? 'shadow-lg ring-1 ring-gray-200'
            : 'shadow-sm ring-1 ring-gray-100 hover:shadow-md',
          isSelected && 'ring-2 ring-blue-400'
        )}>
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between p-4 cursor-pointer">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div onClick={(e) => toggleSelectTrip(trip.id, e)}>
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => {}}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-semibold text-gray-900 text-base truncate">{trip.title}</h3>
                    <span className={cn(
                      'inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium',
                      statusStyles[trip.status]
                    )}>
                      {statusLabels[trip.status]}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      {format(departureDate, 'd MMM', { locale: pl })} - {format(returnDate, 'd MMM yyyy', { locale: pl })}
                    </span>
                    <span className="flex items-center gap-1.5">
                      {trip.groups.map((g) => {
                        const colors = getGroupColor(g.name);
                        return (
                          <span key={g.id} className="flex items-center gap-1">
                            <span className={cn('w-2 h-2 rounded-full', colors.dot)} />
                            <span className="text-xs">{g.name}</span>
                          </span>
                        );
                      })}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <div className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
                  isOpen ? 'bg-gray-100' : 'bg-gray-50'
                )}>
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4 text-gray-500" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-500" />
                  )}
                </div>
              </div>
            </div>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="px-4 pb-4 space-y-4">
              <div className="h-px bg-gray-100" />

              {/* Wyjazd i powrót */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100">
                      <Calendar className="h-3.5 w-3.5 text-blue-600" />
                    </div>
                    <h4 className="text-sm font-semibold text-gray-900">Wyjazd</h4>
                  </div>
                  <div className="bg-white rounded-xl p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{trip.departure_location}</p>
                        <p className="text-xs text-gray-500">
                          {format(departureDate, 'd MMMM yyyy, HH:mm', { locale: pl })}
                        </p>
                      </div>
                    </div>
                    {trip.departure_stop2_location && (
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{trip.departure_stop2_location}</p>
                          {trip.departure_stop2_datetime && (
                            <p className="text-xs text-gray-500">
                              {format(new Date(trip.departure_stop2_datetime), 'd MMMM yyyy, HH:mm', { locale: pl })}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100">
                      <Calendar className="h-3.5 w-3.5 text-violet-600" />
                    </div>
                    <h4 className="text-sm font-semibold text-gray-900">Powrót</h4>
                  </div>
                  <div className="bg-white rounded-xl p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{trip.return_location}</p>
                        <p className="text-xs text-gray-500">
                          {format(returnDate, 'd MMMM yyyy, HH:mm', { locale: pl })}
                        </p>
                      </div>
                    </div>
                    {trip.return_stop2_location && (
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{trip.return_stop2_location}</p>
                          {trip.return_stop2_datetime && (
                            <p className="text-xs text-gray-500">
                              {format(new Date(trip.return_stop2_datetime), 'd MMMM yyyy, HH:mm', { locale: pl })}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Opis */}
              {trip.description && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-sm text-gray-600">{trip.description}</p>
                </div>
              )}

              {/* Grupy */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100">
                  <Users className="h-3.5 w-3.5 text-gray-500" />
                </div>
                <span className="text-sm text-gray-500 mr-1">Grupy:</span>
                {trip.groups.map((group) => {
                  const colors = getGroupColor(group.name);
                  return (
                    <span
                      key={group.id}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-medium border',
                        colors.bg,
                        colors.text,
                        colors.border
                      )}
                    >
                      <span className={cn('w-1.5 h-1.5 rounded-full', colors.dot)} />
                      {group.name}
                    </span>
                  );
                })}
              </div>

              {/* Cennik */}
              {trip.payment_templates && trip.payment_templates.length > 0 && (
                <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100">
                      <Receipt className="h-3.5 w-3.5 text-emerald-600" />
                    </div>
                    <h4 className="text-sm font-semibold text-gray-900">Cennik</h4>
                  </div>
                  <div className="bg-white rounded-xl overflow-hidden ring-1 ring-gray-100">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Typ</th>
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Termin</th>
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Forma</th>
                          <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500">Kwota</th>
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

                          const methodLabel = template.payment_method === 'transfer'
                            ? 'Przelew'
                            : template.payment_method === 'cash'
                            ? 'Gotówka'
                            : template.payment_method === 'both'
                            ? 'Przelew/Gotówka'
                            : '-';

                          return (
                            <tr key={template.id} className="hover:bg-gray-50/50">
                              <td className="px-4 py-2.5 font-medium text-gray-900">{label}</td>
                              <td className="px-4 py-2.5 text-gray-500">
                                {template.due_date
                                  ? format(new Date(template.due_date), 'd.MM.yyyy', { locale: pl })
                                  : '-'}
                              </td>
                              <td className="px-4 py-2.5">
                                <span className={cn(
                                  'inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium',
                                  template.payment_method === 'cash'
                                    ? 'bg-amber-100 text-amber-700'
                                    : template.payment_method === 'transfer'
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-violet-100 text-violet-700'
                                )}>
                                  {methodLabel}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-right font-semibold text-gray-900">
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

              {/* Dane do przelewu */}
              {(trip.bank_account_pln || trip.bank_account_eur) && (
                <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-100">
                      <Banknote className="h-3.5 w-3.5 text-orange-600" />
                    </div>
                    <h4 className="text-sm font-semibold text-gray-900">Dane do przelewu</h4>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    {trip.bank_account_pln && (
                      <div className="flex items-center justify-between bg-white rounded-xl p-3 ring-1 ring-gray-100">
                        <div>
                          <p className="text-xs text-gray-400 mb-0.5">Konto PLN</p>
                          <p className="text-sm text-gray-900">{trip.bank_account_pln}</p>
                        </div>
                        <button
                          className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(trip.bank_account_pln, 'Numer konta PLN');
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                    {trip.bank_account_eur && (
                      <div className="flex items-center justify-between bg-white rounded-xl p-3 ring-1 ring-gray-100">
                        <div>
                          <p className="text-xs text-gray-400 mb-0.5">Konto EUR</p>
                          <p className="text-sm text-gray-900">{trip.bank_account_eur}</p>
                        </div>
                        <button
                          className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(trip.bank_account_eur, 'Numer konta EUR');
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Przyciski akcji */}
              <div className="flex flex-wrap gap-2 pt-1">
                <Link
                  href={`/admin/trips/${trip.id}/edit`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-xl transition-colors"
                >
                  <Edit className="h-4 w-4" />
                  Edytuj
                </Link>
                <TripMessageGenerator trip={trip} compact />
                <ContractTemplateEditor
                  tripId={trip.id}
                  initialTemplate={contractTemplates[trip.id] as TripContractTemplate | null}
                  defaultTemplateText={CONTRACT_TEMPLATE}
                  compact
                />
                <Link
                  href={`/admin/trips/${trip.id}/registrations`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-xl ring-1 ring-gray-200 transition-colors"
                >
                  <UserCheck className="h-4 w-4" />
                  Zapisani
                </Link>
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filtry grup - pill style */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setGroupFilter('all')}
          className={cn(
            'px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200',
            groupFilter === 'all'
              ? 'bg-gray-900 text-white shadow-sm'
              : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50'
          )}
        >
          Wszystkie
        </button>
        {groups.map((group) => {
          const colors = getGroupColor(group.name);
          const isActive = groupFilter === group.id;
          return (
            <button
              key={group.id}
              onClick={() => setGroupFilter(group.id)}
              className={cn(
                'px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 inline-flex items-center gap-2',
                isActive
                  ? cn(colors.bg, colors.text, 'ring-1', colors.border, 'shadow-sm')
                  : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50'
              )}
            >
              <span className={cn('w-2 h-2 rounded-full', colors.dot)} />
              {group.name}
            </button>
          );
        })}
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-white rounded-xl px-4 py-2 ring-1 ring-gray-100 shadow-sm">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100">
              <MapPin className="h-3.5 w-3.5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Aktywne</p>
              <p className="text-lg font-bold text-gray-900">{activeTrips.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-white rounded-xl px-4 py-2 ring-1 ring-gray-100 shadow-sm">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100">
              <Calendar className="h-3.5 w-3.5 text-gray-500" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Zakończone</p>
              <p className="text-lg font-bold text-gray-900">{completedTrips.length}</p>
            </div>
          </div>
        </div>

        {selectedTrips.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 bg-white rounded-xl px-3 py-1.5 ring-1 ring-gray-100">
              Zaznaczono: {selectedTrips.size}
            </span>
            <button
              className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-xl ring-1 ring-gray-200 transition-colors disabled:opacity-50"
              onClick={handleDuplicateSelected}
              disabled={duplicatingTripId !== null}
            >
              {duplicatingTripId !== null ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Duplikowanie...
                </>
              ) : (
                <>
                  <CopyPlus className="h-4 w-4" />
                  Duplikuj
                </>
              )}
            </button>
            <button
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-xl transition-colors"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="h-4 w-4" />
              Usuń
            </button>
            <button
              className="px-4 py-2 bg-white hover:bg-gray-50 text-gray-600 text-sm font-medium rounded-xl ring-1 ring-gray-200 transition-colors"
              onClick={() => setSelectedTrips(new Set())}
            >
              Odznacz
            </button>
          </div>
        )}
      </div>

      {/* Aktywne wyjazdy pogrupowane po miesiącach */}
      {activeByMonth.length > 0 && (
        <div className="space-y-6">
          {activeByMonth.map(({ month, monthKey, trips: monthTrips }) => (
            <div key={monthKey} className="space-y-3">
              {/* Separator miesiąca */}
              <div className="flex items-center gap-4">
                <div className="h-px flex-1 bg-gray-200" />
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {month}
                </span>
                <div className="h-px flex-1 bg-gray-200" />
              </div>
              {/* Wyjazdy w miesiącu */}
              {monthTrips.map((trip) => (
                <TripBlock key={trip.id} trip={trip} />
              ))}
            </div>
          ))}
        </div>
      )}

      {activeTrips.length === 0 && completedTrips.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-8 text-center">
          <p className="text-gray-500">Brak nadchodzących wyjazdów</p>
        </div>
      )}

      {/* Zakończone wyjazdy */}
      {completedTrips.length > 0 && (
        <Collapsible open={completedOpen} onOpenChange={setCompletedOpen}>
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100">
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50/50 transition-colors rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
                    <Calendar className="h-4 w-4 text-gray-500" />
                  </div>
                  <h2 className="text-base font-semibold text-gray-900">Zakończone</h2>
                  <span className="text-xs font-medium text-gray-500 bg-gray-100 rounded-lg px-2 py-0.5">
                    {completedTrips.length}
                  </span>
                </div>
                <div className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
                  completedOpen ? 'bg-gray-100' : 'bg-gray-50'
                )}>
                  {completedOpen ? (
                    <ChevronUp className="h-4 w-4 text-gray-500" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-500" />
                  )}
                </div>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-4 pb-4 space-y-3">
                {completedTrips.map((trip) => (
                  <div key={trip.id} className="opacity-60">
                    <TripBlock trip={trip} />
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      )}

      {/* Dialog potwierdzenia usunięcia */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Usuń zaznaczone wyjazdy</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <div className="rounded-xl bg-red-50 border border-red-200 p-4">
                  <p className="font-semibold text-red-700 text-sm mb-2">UWAGA — tej operacji nie można cofnąć</p>
                  <p className="text-sm text-red-600 mb-3">
                    Usunięcie wyjazdów trwale usunie wszystkie powiązane dane:
                  </p>
                  <ul className="text-sm text-red-600 list-disc list-inside space-y-1">
                    <li>Zapisy uczestników</li>
                    <li>Historia płatności</li>
                    <li>Podpisane umowy</li>
                    <li>Szablony płatności</li>
                  </ul>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Wyjazdy do usunięcia ({selectedTrips.size}):
                  </p>
                  <ul className="text-sm text-gray-600 space-y-1">
                    {trips
                      .filter((t) => selectedTrips.has(t.id))
                      .map((t) => (
                        <li key={t.id} className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                          {t.title}
                        </li>
                      ))}
                  </ul>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting} className="rounded-xl">Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSelected}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 rounded-xl"
            >
              {isDeleting ? 'Usuwanie...' : `Usuń ${selectedTrips.size} ${selectedTrips.size === 1 ? 'wyjazd' : 'wyjazdy'}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
