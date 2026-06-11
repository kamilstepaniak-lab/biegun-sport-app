'use client';

import { useState, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { PaymentDue } from '@/components/shared/payment-due';
import {
  ChevronDown,
  ChevronUp,
  Calendar,
  Edit,
  UserCheck,
  Banknote,
  Receipt,
  Copy,
  Trash2,
  CopyPlus,
  Loader2,
  Backpack,
  Info,
  ArrowRight,
  ArrowLeft,
  Search,
  SlidersHorizontal,
  Check,
  type LucideIcon,
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
import { SanitizedHtml } from '@/components/shared';
import { getGroupColor } from '@/lib/group-colors';
import { GroupIcon } from '@/lib/group-icons';
import { getCampVisual } from '@/lib/camp-visual';
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

// Wersje badge'y statusu na niebieskim tle sekcji rozwiniętej —
// ten sam styl co badge "WordPress" (rounded-full, uppercase, ring).
const statusStylesOnBlue: Record<string, string> = {
  draft: 'bg-white/15 text-blue-50 ring-white/25',
  published: 'bg-emerald-400/30 text-emerald-50 ring-emerald-200/40',
  cancelled: 'bg-red-400/30 text-red-50 ring-red-200/40',
  completed: 'bg-white/15 text-blue-50 ring-white/25',
};

function getTemplateLabel(template: { payment_type: string; installment_number?: number | null; category_name?: string | null }) {
  if (template.payment_type === 'installment') return `Rata ${template.installment_number}`;
  if (template.payment_type === 'season_pass') return `Karnet${template.category_name ? ` (${template.category_name})` : ''}`;
  if (template.payment_type === 'full') return 'Pełna opłata';
  return template.payment_type;
}

function getMethodLabel(method: string | null | undefined): { label: string; className: string } {
  if (method === 'transfer') return { label: 'Przelew', className: 'bg-blue-100 text-blue-700' };
  if (method === 'cash') return { label: 'Gotówka', className: 'bg-amber-100 text-amber-700' };
  if (method === 'both') return { label: 'Przelew/Gotówka', className: 'bg-violet-100 text-violet-700' };
  return { label: '-', className: 'bg-gray-100 text-gray-600' };
}

function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text);
  toast.success(`${label} skopiowany do schowka`);
}

function TripCard({
  icon: Icon,
  title,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5', className)}>
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white">
          <Icon className="h-3.5 w-3.5" />
        </div>
        <h4 className="text-sm font-bold text-slate-900">{title}</h4>
      </div>
      {children}
    </section>
  );
}

function CheckIcon() {
  return (
    <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-600">
      <Check className="h-3 w-3" />
    </span>
  );
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

interface TripBlockProps {
  trip: TripWithPaymentTemplates;
  isOpen: boolean;
  isSelected: boolean;
  onToggle: () => void;
  onToggleSelect: (e: React.MouseEvent) => void;
  contractTemplate: { is_active: boolean; template_text: string } | null;
}

// Komponent na poziomie modułu — NIE definiujemy go wewnątrz TripsList,
// inaczej każdy render rodzica tworzy nowy typ komponentu i remountuje
// wszystkie bloki wyjazdów (utrata animacji collapsible, zbędna praca).
function TripBlock({ trip, isOpen, isSelected, onToggle, onToggleSelect, contractTemplate }: TripBlockProps) {
  const [renderedAt] = useState(() => Date.now());
  const campVisual = getCampVisual(trip.category);
  const departureDate = new Date(trip.departure_datetime);
  const returnDate = new Date(trip.return_datetime);
  const daysUntilDeparture = Math.max(0, Math.ceil((departureDate.getTime() - renderedAt) / 86400000));
  // Sumujemy osobno per waluta — wyjazd może mieć raty w PLN i karnet w EUR.
  const totalsByCurrency = (trip.payment_templates ?? []).reduce<Record<string, number>>(
    (acc, template) => {
      const currency = template.currency || 'PLN';
      acc[currency] = (acc[currency] ?? 0) + Number(template.amount ?? 0);
      return acc;
    },
    {},
  );
  const totalLabel =
    Object.entries(totalsByCurrency)
      .map(([currency, amount]) => `${amount.toFixed(0)} ${currency}`)
      .join(' / ') || '0 PLN';

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={onToggle}
    >
      <div className={cn(
        'overflow-hidden rounded-2xl border-2 bg-white transition-all duration-200',
        isOpen
          ? 'border-blue-600 shadow-xl shadow-blue-600/15'
          : 'border-slate-200 shadow-sm hover:border-blue-300 hover:shadow-md',
        isSelected && !isOpen && 'border-blue-500'
      )}>
        <CollapsibleTrigger asChild>
          <div className="flex cursor-pointer items-start gap-3 p-4 lg:grid lg:grid-cols-[auto_auto_18rem_auto_1fr_auto_auto] lg:items-center lg:gap-x-4 lg:gap-y-1">
            <div className="flex h-11 flex-shrink-0 items-center" onClick={onToggleSelect}>
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => { }}
                />
              </div>

            <div className={cn('flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl', campVisual.iconBox)}>
              <campVisual.Icon className="h-5 w-5" />
            </div>

            {/* Mobile: tytuł/data/status w kolumnie; na lg wrapper znika (contents) i wraca grid */}
            <div className="min-w-0 flex-1 space-y-1.5 lg:contents lg:space-y-0">
              <h3 className="min-w-0 truncate text-base font-bold text-slate-900">
                {trip.title}
              </h3>

              <p className="inline-flex items-center gap-1.5 text-sm font-bold text-blue-700 whitespace-nowrap">
                <Calendar className="h-3.5 w-3.5 text-blue-500" />
                {format(departureDate, 'dd.MM.yyyy', { locale: pl })} – {format(returnDate, 'dd.MM.yyyy', { locale: pl })}
              </p>

              <div className="hidden lg:block" />

              {/* Kuleczki grup obok przycisku rozwijania — jak u rodzica */}
              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                {trip.groups.length > 0 && trip.groups.map((g) => {
                  const colors = getGroupColor(g.name);
                  return (
                    <span key={g.id} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 sm:text-sm sm:text-slate-700">
                      {/* Mobile: dyskretna kropka koloru grupy; od sm pełne kółko z ikoną */}
                      <span className={cn('h-2 w-2 rounded-full sm:hidden', colors.dot)} />
                      <span className={cn('hidden h-6 w-6 items-center justify-center rounded-full text-white sm:flex', colors.dot)}>
                        <GroupIcon name={g.name} className="h-3.5 w-3.5" />
                      </span>
                      {g.name}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className={cn(
              'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border transition-all',
              isOpen ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-500'
            )}>
              <ChevronDown className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')} />
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="grid gap-4 bg-slate-50 p-4 sm:p-6 lg:grid-cols-3">
            <div className="relative -m-4 mb-2 overflow-hidden bg-blue-600 p-4 text-white shadow-sm sm:-m-6 sm:mb-2 sm:p-6 lg:col-span-3">
              <div className="relative flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn(
                    'rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ring-1',
                    statusStylesOnBlue[trip.status]
                  )}>
                    {statusLabels[trip.status]}
                  </span>
                  {trip.registration_form_enabled && (
                    <span
                      className="rounded-full bg-amber-400/30 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-50 ring-1 ring-amber-200/40"
                      title="Wyjazd przyjmuje zgloszenia z formularza WordPress"
                    >
                      WordPress
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 xl:justify-end">
                  <TripMessageGenerator trip={trip} compact />
                  <ContractTemplateEditor
                    tripId={trip.id}
                    initialTemplate={contractTemplate as TripContractTemplate | null}
                    defaultTemplateText={CONTRACT_TEMPLATE}
                    compact
                  />
                  <Link
                    href={`/admin/trips/${trip.id}/registrations`}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/60 bg-white/10 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-white/20"
                  >
                    <UserCheck className="h-3.5 w-3.5" />
                    Zapisani
                  </Link>
                  <Link
                    href={`/admin/trips/${trip.id}/edit`}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/60 bg-white/10 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-white/20"
                  >
                    <Edit className="h-3.5 w-3.5" />
                    Edytuj
                  </Link>
                </div>
              </div>
            </div>

            {/* Podstawowe informacje */}
            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5 lg:order-1 lg:col-span-2">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600">
                  <Info className="h-3.5 w-3.5 text-white" />
                </div>
                <h4 className="text-sm font-bold text-slate-900">Podstawowe informacje</h4>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                  <p className="text-[11px] font-medium text-slate-500">Miejsce</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{trip.location || trip.departure_location || '—'}</p>
                </div>
                {trip.declaration_deadline && (
                  <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                    <p className="text-[11px] font-medium text-slate-500">Deklaracja do</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {format(new Date(trip.declaration_deadline), 'd MMMM yyyy', { locale: pl })}
                    </p>
                  </div>
                )}
              </div>
              {trip.description && (
                <div className="mt-4 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
                  <p className="mb-2 text-[11px] font-medium text-slate-500">Opis</p>
                  <SanitizedHtml
                    html={trip.description}
                    className="rich-content text-sm leading-relaxed text-slate-700"
                  />
                </div>
              )}
            </div>

            <TripCard icon={Calendar} title="Terminy" className="lg:order-2">
              <div className="space-y-3">
                <div className="flex items-start gap-3 border-b border-slate-200 pb-3">
                  <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                    <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-slate-500">Wyjazd</p>
                    <p className="text-sm font-bold text-slate-900">
                      {format(departureDate, (trip.departure_time_known ?? true) ? 'd MMMM yyyy, HH:mm' : 'd MMMM yyyy', { locale: pl })}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{trip.departure_location}</p>
                    {trip.departure_stop2_location && (
                      <p className="mt-1 text-xs text-slate-500">
                        {trip.departure_stop2_location}
                        {trip.departure_stop2_datetime ? ` · ${format(new Date(trip.departure_stop2_datetime), 'HH:mm', { locale: pl })}` : ''}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-3 border-b border-slate-200 pb-3">
                  <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-red-50 text-red-500">
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-slate-500">Powrót</p>
                    <p className="text-sm font-bold text-slate-900">
                      {format(returnDate, (trip.return_time_known ?? true) ? 'd MMMM yyyy, HH:mm' : 'd MMMM yyyy', { locale: pl })}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{trip.return_location}</p>
                    {trip.return_stop2_location && (
                      <p className="mt-1 text-xs text-slate-500">
                        {trip.return_stop2_location}
                        {trip.return_stop2_datetime ? ` · ${format(new Date(trip.return_stop2_datetime), 'HH:mm', { locale: pl })}` : ''}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                    <Calendar className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-slate-500">Za ile dni</p>
                    <p className="text-sm font-bold text-slate-900">
                      {daysUntilDeparture} dni
                    </p>
                  </div>
                </div>
              </div>
            </TripCard>

            {/* Co zabrać */}
            {trip.packing_list && (
              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5 lg:order-5 lg:col-span-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600">
                    <Backpack className="h-3.5 w-3.5 text-white" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">Co zabrać</h4>
                </div>
                <ul className="mt-4 divide-y divide-slate-200">
                  {trip.packing_list
                    .split('\n')
                    .map((line) => line.replace(/^[-•*]\s*/, '').trim())
                    .filter(Boolean)
                    .map((item, i) => (
                      <li key={i} className="flex items-start gap-2 py-2 text-sm text-slate-700">
                        <CheckIcon />
                        {item}
                      </li>
                    ))}
                </ul>
              </div>
            )}

            {/* Dodatkowe informacje */}
            {trip.additional_info && (
              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5 lg:order-6">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600">
                    <Info className="h-3.5 w-3.5 text-white" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">Dodatkowe informacje</h4>
                </div>
                <ul className="mt-4 space-y-2">
                  {trip.additional_info
                    .split('\n')
                    .map((line) => line.replace(/^[-•*]\s*/, '').trim())
                    .filter(Boolean)
                    .map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-slate-700">
                        <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-500" />
                        {item}
                      </li>
                    ))}
                </ul>
              </div>
            )}

            {/* Cennik */}
            {trip.payment_templates && trip.payment_templates.length > 0 && (
              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5 lg:order-3 lg:col-span-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600">
                    <Receipt className="h-3.5 w-3.5 text-white" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">Cennik</h4>
                </div>
                {/* Mobile: karty */}
                <div className="mt-4 md:hidden space-y-2">
                  {trip.payment_templates.map((template) => {
                    const label = getTemplateLabel(template);
                    const method = getMethodLabel(template.payment_method);
                    return (
                      <div key={template.id} className="rounded-xl ring-1 ring-slate-200 p-3 bg-white">
                        <div className="flex items-start justify-between gap-3">
                          <p className="font-semibold text-gray-900 text-sm">{label}</p>
                          <p className="text-sm font-bold text-gray-900 tabular-nums whitespace-nowrap">
                            {template.amount.toFixed(0)} {template.currency}
                          </p>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium ${method.className}`}>
                            {method.label}
                          </span>
                          <span className="text-gray-600">
                            <PaymentDue
                              templateDueDate={template.due_date}
                              dueDaysFromConfirmation={template.due_days_from_confirmation}
                              departureDate={trip.departure_datetime}
                            />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 ring-1 ring-slate-200">
                    <span className="text-sm font-bold text-slate-900">Razem</span>
                    <span className="text-base font-black text-slate-950">{totalLabel}</span>
                  </div>
                </div>
                {/* Desktop: tabela */}
                <div className="mt-4 hidden md:block overflow-x-auto rounded-xl ring-1 ring-slate-200">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400 whitespace-nowrap">Typ</th>
                        <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400 whitespace-nowrap">Termin</th>
                        <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400 whitespace-nowrap">Forma</th>
                        <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400 whitespace-nowrap">Kwota</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {trip.payment_templates.map((template) => {
                        const label = getTemplateLabel(template);
                        const method = getMethodLabel(template.payment_method);

                        return (
                          <tr key={template.id} className="hover:bg-gray-50/50">
                            <td className="px-4 py-2.5 font-medium text-gray-900 whitespace-nowrap">{label}</td>
                            <td className="px-4 py-2.5 whitespace-nowrap">
                              <PaymentDue
                                templateDueDate={template.due_date}
                                dueDaysFromConfirmation={template.due_days_from_confirmation}
                                departureDate={trip.departure_datetime}
                              />
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium ${method.className}`}>
                                {method.label}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-left font-semibold text-gray-900 whitespace-nowrap">
                              {template.amount.toFixed(0)} {template.currency}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-slate-200">
                        <td colSpan={3} className="px-4 py-3 text-left text-sm font-bold text-slate-900">
                          Razem
                        </td>
                        <td className="px-4 py-3 text-left text-xl font-black text-slate-950 whitespace-nowrap">
                          {totalLabel}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* Dane do przelewu */}
            {(trip.bank_account_pln || trip.bank_account_eur) && (
              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5 lg:order-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600">
                    <Banknote className="h-3.5 w-3.5 text-white" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">Dane do przelewu</h4>
                </div>
                <div className="mt-4 grid gap-3">
                  {trip.bank_account_pln && (
                    <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
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
                    <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
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

          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export function TripsList({ trips, groups, contractTemplates }: TripsListProps) {
  const router = useRouter();
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [openTripId, setOpenTripId] = useState<string | null>(null);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [selectedTrips, setSelectedTrips] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);

  const now = MODULE_LOAD_TIME;

  // Filtruj po grupie
  const filteredTrips = useMemo(() => {
    return trips.filter((trip) => {
      const matchesGroup = groupFilter === 'all' || trip.groups.some((g) => g.id === groupFilter);
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !query ||
        trip.title.toLowerCase().includes(query) ||
        (trip.location ?? '').toLowerCase().includes(query) ||
        (trip.departure_location ?? '').toLowerCase().includes(query);

      return matchesGroup && matchesSearch;
    });
  }, [trips, groupFilter, searchQuery]);

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
    setOpenTripId((current) => (current === tripId ? null : tripId));
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

    // Równolegle — przy zaznaczeniu wielu wyjazdów nie czekamy sekwencyjnie
    const results = await Promise.allSettled(
      [...selectedTrips].map((tripId) => deleteTrip(tripId))
    );

    let deletedCount = 0;
    let errorCount = 0;
    for (const r of results) {
      if (r.status === 'fulfilled' && !r.value.error) {
        deletedCount++;
      } else {
        errorCount++;
        console.error('Delete trip error:', r.status === 'rejected' ? r.reason : r.value.error);
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

    setIsDuplicating(true);

    // Równolegle — duplikowanie wielu wyjazdów naraz
    const results = await Promise.allSettled(
      [...selectedTrips].map((tripId) => duplicateTrip(tripId))
    );

    let successCount = 0;
    let errorCount = 0;
    for (const r of results) {
      if (r.status === 'fulfilled' && !r.value.error) {
        successCount++;
      } else {
        errorCount++;
        console.error('Duplicate trip error:', r.status === 'rejected' ? r.reason : r.value.error);
      }
    }

    setIsDuplicating(false);
    setSelectedTrips(new Set());

    if (successCount > 0) {
      toast.success(`Zduplikowano ${successCount} wyjazdów`);
      router.refresh();
    }
    if (errorCount > 0) {
      toast.error(`Nie udało się zduplikować ${errorCount} wyjazdów`);
    }
  }

  return (
    <div className="space-y-6">
      {/* Filtry grup - pill style */}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setGroupFilter('all')}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all duration-200',
              groupFilter === 'all'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50'
            )}
          >
            <span className="grid h-3.5 w-3.5 grid-cols-2 gap-0.5">
              <span className="rounded-[2px] bg-current" />
              <span className="rounded-[2px] bg-current" />
              <span className="rounded-[2px] bg-current" />
              <span className="rounded-[2px] bg-current" />
            </span>
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
                  'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-200',
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50'
                )}
              >
                <span className={cn('h-2 w-2 rounded-full', isActive ? 'bg-white' : colors.dot)} />
                {group.name}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Szukaj wyjazdu..."
              className="h-11 w-full rounded-xl bg-white pl-10 pr-4 text-sm text-slate-700 ring-1 ring-slate-200 transition-all placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <button className="inline-flex h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-slate-600 ring-1 ring-slate-200 transition-colors hover:bg-slate-50">
            <SlidersHorizontal className="h-4 w-4" />
            Filtry
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between">
        <div />

        {selectedTrips.size > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-500 bg-white rounded-xl px-3 py-1.5 ring-1 ring-gray-100">
              Zaznaczono: {selectedTrips.size}
            </span>
            <button
              className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-xl ring-1 ring-gray-200 transition-colors disabled:opacity-50"
              onClick={handleDuplicateSelected}
              disabled={isDuplicating}
            >
              {isDuplicating ? (
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
              <div className="relative flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm shadow-blue-600/25">
                  <Calendar className="h-4 w-4" />
                </div>
                <span className="ml-3 text-xs font-black uppercase tracking-[0.16em] text-slate-700">
                  {month}
                </span>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-500 ring-1 ring-slate-200">
                  {monthTrips.length}
                </span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>
              {/* Wyjazdy w miesiącu */}
              {monthTrips.map((trip) => (
                <TripBlock
                  key={trip.id}
                  trip={trip}
                  isOpen={openTripId === trip.id}
                  isSelected={selectedTrips.has(trip.id)}
                  onToggle={() => toggleTrip(trip.id)}
                  onToggleSelect={(e) => toggleSelectTrip(trip.id, e)}
                  contractTemplate={contractTemplates[trip.id] ?? null}
                />
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
                    <TripBlock
                      trip={trip}
                      isOpen={openTripId === trip.id}
                      isSelected={selectedTrips.has(trip.id)}
                      onToggle={() => toggleTrip(trip.id)}
                      onToggleSelect={(e) => toggleSelectTrip(trip.id, e)}
                      contractTemplate={contractTemplates[trip.id] ?? null}
                    />
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
            <AlertDialogDescription>
              Czy na pewno chcesz usunąć {selectedTrips.size} zaznaczonych wyjazdów?
              Tej operacji nie można cofnąć. Wszystkie powiązane dane (rejestracje, płatności) zostaną również usunięte.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting} className="rounded-xl">Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSelected}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 rounded-xl"
            >
              {isDeleting ? 'Usuwanie...' : 'Usuń'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
