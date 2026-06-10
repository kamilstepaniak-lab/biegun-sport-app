'use client';

import { memo, useState, type ReactNode } from 'react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import {
  Calendar,
  ChevronDown,
  X,
  HelpCircle,
  Clock,
  Banknote,
  Copy,
  Receipt,
  ArrowRight,
  ArrowLeft,
  Bus,
  CheckCircle2,
  Backpack,
  Info,
  type LucideIcon,
} from 'lucide-react';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Textarea } from '@/components/ui/textarea';

import type { TripForParent, ChildTripStatus } from '@/lib/actions/trips';
import { GroupIcon } from '@/lib/group-icons';
import { getGroupColor } from '@/lib/group-colors';
import { getCampVisual } from '@/lib/camp-visual';
import { cn } from '@/lib/utils';
import { PaymentDue } from '@/components/shared/payment-due';

export type ParticipationStatus = ChildTripStatus['participation_status'];
export type ConfirmType = 'stop1' | 'stop2' | 'own' | 'not_going' | 'other';

const statusConfig = {
  unconfirmed: { label: 'Niepotwierdzony', color: 'bg-gray-100 text-gray-600', icon: Clock },
  confirmed: { label: 'Jedzie', color: 'bg-emerald-50 text-emerald-700', icon: Bus },
  not_going: { label: 'Nie jedzie', color: 'bg-red-50 text-red-600', icon: X },
  other: { label: 'Inne', color: 'bg-amber-50 text-amber-700', icon: HelpCircle },
};

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

function getTemplateLabel(template: { payment_type: string; installment_number?: number | null; category_name?: string | null }) {
  if (template.payment_type === 'installment') return `Rata ${template.installment_number}`;
  if (template.payment_type === 'season_pass') return `Karnet${template.category_name ? ` (${template.category_name})` : ''}`;
  if (template.payment_type === 'full') return 'Pełna opłata';
  return template.payment_type;
}

function getMethodLabel(method: string | null | undefined, short = false): { label: string; className: string } {
  if (method === 'transfer') return { label: 'Przelew', className: 'bg-blue-100 text-blue-700' };
  if (method === 'cash') return { label: 'Gotówka', className: 'bg-amber-100 text-amber-700' };
  if (method === 'both') return { label: short ? 'Przel./Got.' : 'Przelew/Gotówka', className: 'bg-violet-100 text-violet-700' };
  return { label: '–', className: 'bg-gray-100 text-gray-600' };
}

function RichDescription({ html }: { html: string }) {
  const DANGER_KEY = ['dangerously', 'Set', 'Inner', 'HTML'].join('');
  const props = { className: 'rich-content text-sm leading-relaxed text-slate-700', [DANGER_KEY]: { __html: html } } as React.HTMLAttributes<HTMLDivElement>;
  return <div {...props} />;
}

function DetailCard({
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
      <CheckCircle2 className="h-3 w-3" />
    </span>
  );
}

export interface TripCardProps {
  trip: TripForParent;
  isPast: boolean;
  isOpen: boolean;
  childStatusOverrides: Record<string, ParticipationStatus>;
  childNoteOverrides: Record<string, string | null>;
  updatingChildKey: string | null;
  confirmPanel: { key: string; type: ConfirmType } | null;
  confirmMessage: string;
  onToggle: (tripId: string) => void;
  onOpenConfirmPanel: (key: string, type: ConfirmType) => void;
  onCancelConfirmPanel: () => void;
  onConfirmMessageChange: (msg: string) => void;
  onStatusChange: (
    tripId: string,
    childId: string,
    status: 'confirmed' | 'not_going' | 'other',
    note?: string,
  ) => void;
  onCopy: (text: string, label: string) => void;
}

function TripCardInner({
  trip,
  isPast,
  isOpen,
  childStatusOverrides,
  childNoteOverrides,
  updatingChildKey,
  confirmPanel,
  confirmMessage,
  onToggle,
  onOpenConfirmPanel,
  onCancelConfirmPanel,
  onConfirmMessageChange,
  onStatusChange,
  onCopy,
}: TripCardProps) {
  const [renderedAt] = useState(() => Date.now());
  const campVisual = getCampVisual(trip.category);
  const departureDate = new Date(trip.departure_datetime);
  const returnDate = new Date(trip.return_datetime);
  const hasStop2 = !!trip.departure_stop2_location;
  const daysUntilDeparture = Math.max(0, Math.ceil((departureDate.getTime() - renderedAt) / 86400000));
  const todayStart = new Date(renderedAt);
  todayStart.setHours(0, 0, 0, 0);
  const declarationPassed = !isPast
    && !!trip.declaration_deadline
    && new Date(trip.declaration_deadline) < todayStart;
  const confirmedChild = trip.children.find((c) => c.participation_status === 'confirmed');
  const paymentDueByTemplate = new Map<string, string | null>();
  (confirmedChild?.payments ?? []).forEach((p) => {
    if (p.template_id) paymentDueByTemplate.set(p.template_id, p.due_date);
  });
  const totalsByCurrency = new Map<string, number>();
  (trip.payment_templates ?? []).forEach((template) => {
    totalsByCurrency.set(template.currency, (totalsByCurrency.get(template.currency) ?? 0) + template.amount);
  });
  const totalLabel = Array.from(totalsByCurrency.entries())
    .sort(([a], [b]) => (a === 'PLN' ? -1 : b === 'PLN' ? 1 : a.localeCompare(b)))
    .map(([currency, amount]) => `${amount.toFixed(0)} ${currency}`)
    .join(' · ');

  // Dziecko + przyciski potwierdzeń — renderowane na niebieskim tle sekcji
  // rozwiniętej (karty dzieci jako jasne kafelki na niebieskim).
  const childParticipation = !isPast ? (
    <div className="space-y-2">
      {trip.children.map((child) => {
        const key = `${trip.id}-${child.child_id}`;
        const currentStatus = childStatusOverrides[key] || child.participation_status;
        const currentNote = key in childNoteOverrides ? childNoteOverrides[key] : child.participation_note;
        const status = statusConfig[currentStatus];
        const StatusIcon = status.icon;
        const isUpdating = updatingChildKey === key;
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 rounded-xl border border-white/40 gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0',
                  getGroupColor(child.child_group_name ?? '').dot,
                )}>
                  {child.child_name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-white leading-tight">{child.child_name}</p>
                  {currentStatus !== 'unconfirmed' && (
                    <span className={cn(
                      'mt-0.5 inline-flex items-center gap-1 text-xs font-medium',
                      currentStatus === 'confirmed' ? 'text-emerald-300'
                        : currentStatus === 'not_going' ? 'text-red-300'
                          : 'text-white'
                    )}>
                      <StatusIcon className="h-3 w-3" />
                      {statusLabel}
                    </span>
                  )}
                </div>
              </div>
              {/* Mobile: duże przyciski w siatce (przystanki na pełną szerokość) —
                  to kluczowa akcja rodzica; od sm kompaktowy rząd jak dotąd */}
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-1">
                <button
                  disabled={isUpdating}
                  onClick={(e) => { e.stopPropagation(); onOpenConfirmPanel(key, 'stop1'); }}
                  className={cn(
                    'col-span-2 flex items-center justify-center gap-1 px-2 py-2.5 sm:col-span-1 sm:px-3 sm:py-1.5 rounded-xl sm:rounded-lg text-xs font-semibold transition-all duration-200 border-2',
                    currentStatus === 'confirmed' && currentStop === 'stop1'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                      : confirmPanel?.key === key && confirmPanel?.type === 'stop1'
                        ? 'bg-emerald-500/30 text-white border-emerald-400'
                        : 'bg-transparent border-emerald-400 text-white hover:bg-emerald-500/30'
                  )}
                >
                  {trip.departure_location?.length > 18
                    ? trip.departure_location.substring(0, 16) + '…'
                    : trip.departure_location || 'Przystanek 1'}
                </button>
                {hasStop2 && (
                  <button
                    disabled={isUpdating}
                    onClick={(e) => { e.stopPropagation(); onOpenConfirmPanel(key, 'stop2'); }}
                    className={cn(
                      'col-span-2 flex items-center justify-center gap-1 px-2 py-2.5 sm:col-span-1 sm:px-3 sm:py-1.5 rounded-xl sm:rounded-lg text-xs font-semibold transition-all duration-200 border-2',
                      currentStatus === 'confirmed' && currentStop === 'stop2'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                        : confirmPanel?.key === key && confirmPanel?.type === 'stop2'
                          ? 'bg-emerald-500/30 text-white border-emerald-400'
                          : 'bg-transparent border-emerald-400 text-white hover:bg-emerald-500/30'
                    )}
                  >
                    {(trip.departure_stop2_location?.length ?? 0) > 18
                      ? trip.departure_stop2_location!.substring(0, 16) + '…'
                      : trip.departure_stop2_location || 'Przystanek 2'}
                  </button>
                )}
                {trip.allow_own_transport && (
                  <button
                    disabled={isUpdating}
                    onClick={(e) => { e.stopPropagation(); onOpenConfirmPanel(key, 'own'); }}
                    className={cn(
                      'col-span-2 flex items-center justify-center gap-1 px-2 py-2.5 sm:col-span-1 sm:px-3 sm:py-1.5 rounded-xl sm:rounded-lg text-xs font-semibold transition-all duration-200 border-2',
                      currentStatus === 'confirmed' && currentStop === 'own'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                        : confirmPanel?.key === key && confirmPanel?.type === 'own'
                          ? 'bg-emerald-500/30 text-white border-emerald-400'
                          : 'bg-transparent border-emerald-400 text-white hover:bg-emerald-500/30'
                    )}
                  >
                    Dojazd własny
                  </button>
                )}
                <button
                  disabled={isUpdating}
                  onClick={(e) => { e.stopPropagation(); onOpenConfirmPanel(key, 'not_going'); }}
                  className={cn(
                    'flex items-center justify-center gap-1 px-2 py-2.5 sm:px-3 sm:py-1.5 rounded-xl sm:rounded-lg text-xs font-semibold transition-all duration-200 border-2',
                    currentStatus === 'not_going'
                      ? 'bg-red-500 text-white border-red-500 shadow-md'
                      : confirmPanel?.key === key && confirmPanel?.type === 'not_going'
                        ? 'bg-red-500/30 text-white border-red-400'
                        : 'bg-transparent border-red-400 text-white hover:bg-red-500/30'
                  )}
                >
                  <X className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  Nie jedzie
                </button>
                <button
                  disabled={isUpdating}
                  onClick={(e) => { e.stopPropagation(); onOpenConfirmPanel(key, 'other'); }}
                  className={cn(
                    'flex items-center justify-center gap-1 px-2 py-2.5 sm:px-3 sm:py-1.5 rounded-xl sm:rounded-lg text-xs font-semibold transition-all duration-200 border-2',
                    currentStatus === 'other' || (confirmPanel?.key === key && confirmPanel?.type === 'other')
                      ? 'bg-amber-500 text-white border-amber-500 shadow-md'
                      : 'bg-transparent border-white/55 text-white hover:bg-white/10'
                  )}
                >
                  <HelpCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  Wiadomość
                </button>
              </div>
            </div>
            {confirmPanel?.key === key && (() => {
              const pType = confirmPanel.type;
              const isStop = ['stop1', 'stop2', 'own'].includes(pType);
              const isNotGoing = pType === 'not_going';
              const confirmBtnCls = isStop
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : isNotGoing ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-blue-600 hover:bg-blue-700';
              const confirmLabel = pType === 'other' ? 'Wyślij' : 'Potwierdź';
              return (
                <div className="space-y-2 sm:ml-11">
                  <Textarea
                    placeholder={pType === 'other' ? 'Wpisz wiadomość do admina…' : 'Wiadomość dla admina (opcjonalna, np. dołączy później)'}
                    value={confirmMessage}
                    onChange={(e) => onConfirmMessageChange(e.target.value)}
                    rows={2}
                    className="text-sm rounded-lg bg-white"
                    onClick={(e) => e.stopPropagation()}
                    autoFocus
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); onCancelConfirmPanel(); }}
                      className="px-4 py-2 sm:px-3 sm:py-1.5 rounded-lg text-xs font-medium bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                    >
                      Anuluj
                    </button>
                    <button
                      disabled={isUpdating || (pType === 'other' && !confirmMessage.trim())}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isStop) {
                          onStatusChange(trip.id, child.child_id, 'confirmed', buildNote(pType as 'stop1' | 'stop2' | 'own', confirmMessage || undefined));
                        } else if (isNotGoing) {
                          onStatusChange(trip.id, child.child_id, 'not_going', confirmMessage || undefined);
                        } else {
                          onStatusChange(trip.id, child.child_id, 'other', confirmMessage);
                        }
                      }}
                      className={cn('px-4 py-2 sm:px-3 sm:py-1.5 rounded-lg text-xs font-medium text-white shadow-sm disabled:opacity-50', confirmBtnCls)}
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
  ) : null;

  return (
    <Collapsible open={isOpen} onOpenChange={() => onToggle(trip.id)}>
      <div className={cn(
        'overflow-hidden rounded-2xl transition-all duration-200',
        isOpen
          ? 'border-2 border-blue-600 bg-white shadow-xl shadow-blue-600/15'
          : 'border border-gray-100 bg-white shadow-sm hover:border-blue-300 hover:shadow-md',
        isPast && !isOpen && 'opacity-60'
      )}>
        <CollapsibleTrigger asChild>
          <div className="cursor-pointer">
            <div className="flex items-start gap-3 p-4 lg:grid lg:gap-x-4 lg:gap-y-1 lg:grid-cols-[auto_18rem_auto_1fr_auto_auto] lg:items-center">
              <div className={cn('flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl', campVisual.iconBox)}>
                <campVisual.Icon className="h-5 w-5" />
              </div>

              {/* Mobile: tytuł/data/grupy w kolumnie; na lg wrapper znika (contents) i wraca grid */}
              <div className="min-w-0 flex-1 space-y-1.5 lg:contents lg:space-y-0">
                <h3 className="min-w-0 truncate text-base font-bold text-slate-900">
                  {trip.title}
                </h3>

                <p className="inline-flex items-center gap-1.5 text-sm font-bold text-blue-700 whitespace-nowrap">
                  <Calendar className="h-3.5 w-3.5 text-blue-500" />
                  {format(departureDate, 'dd.MM.yyyy', { locale: pl })} – {format(returnDate, 'dd.MM.yyyy', { locale: pl })}
                </p>

                <div className="hidden lg:block" />

                {/* Status (tylko zrealizowany / po terminie) + kuleczki grup obok przycisku rozwijania */}
                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                {(isPast || declarationPassed) && (
                  <span className={cn(
                    'inline-flex w-max items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold',
                    isPast
                      ? 'border-slate-200 bg-slate-100 text-slate-500'
                      : 'border-amber-200 bg-amber-50 text-amber-700'
                  )}>
                    <span className={cn('h-1.5 w-1.5 rounded-full', isPast ? 'bg-slate-400' : 'bg-amber-500')} />
                    {isPast ? 'Zrealizowany' : 'Po terminie deklaracji'}
                  </span>
                )}
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
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent className="overflow-hidden data-[state=open]:animate-[collapsible-down_250ms_ease-out] data-[state=closed]:animate-[collapsible-up_200ms_ease-in]">
          <div className="grid gap-4 bg-slate-50 p-4 sm:p-6 lg:grid-cols-3">
            <div className="relative -m-4 mb-2 overflow-hidden bg-blue-600 p-4 text-white shadow-sm sm:-m-6 sm:mb-2 sm:p-6 lg:col-span-3">
              <div className="relative space-y-5">
                {isPast && (
                  <span className="inline-flex rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-blue-50 ring-1 ring-white/20">
                    Zrealizowany
                  </span>
                )}
                {childParticipation}
              </div>
            </div>

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
                  <RichDescription html={trip.description} />
                </div>
              )}
            </div>

            <DetailCard icon={Calendar} title="Terminy" className="lg:order-2">
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
                {!isPast && (
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                      <Calendar className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <p className="text-[11px] font-medium text-slate-500">Za ile dni</p>
                      <p className="text-sm font-bold text-slate-900">{daysUntilDeparture} dni</p>
                    </div>
                  </div>
                )}
              </div>
            </DetailCard>

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
                              paymentDueDate={paymentDueByTemplate.get(template.id)}
                              templateDueDate={template.due_date}
                              dueDaysFromConfirmation={template.due_days_from_confirmation}
                              dueWithFirstInstallment={template.due_with_first_installment}
                              confirmedAt={confirmedChild?.confirmed_at}
                              departureDate={trip.departure_datetime}
                            />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {totalLabel && (
                    <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 ring-1 ring-slate-200">
                      <span className="text-sm font-bold text-slate-900">Razem</span>
                      <span className="text-base font-black text-slate-950">{totalLabel}</span>
                    </div>
                  )}
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
                                paymentDueDate={paymentDueByTemplate.get(template.id)}
                                templateDueDate={template.due_date}
                                dueDaysFromConfirmation={template.due_days_from_confirmation}
                                dueWithFirstInstallment={template.due_with_first_installment}
                                confirmedAt={confirmedChild?.confirmed_at}
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
                    {totalLabel && (
                      <tfoot>
                        <tr className="border-t border-slate-200">
                          <td colSpan={3} className="px-4 py-3 text-left text-sm font-bold text-slate-900">
                            Razem
                          </td>
                          <td className="px-4 py-3 text-left text-lg font-black text-slate-950">
                            {totalLabel}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            )}

            {(trip.bank_account_pln || trip.bank_account_eur) && (
              <DetailCard icon={Banknote} title="Dane do przelewu" className="lg:order-4">
                <div className="grid gap-3">
                  {trip.children.map((child) => {
                    const [firstName, ...lastNameParts] = child.child_name.split(' ');
                    const lastName = lastNameParts.join(' ');
                    const tripDate = format(departureDate, 'dd.MM.yyyy', { locale: pl });
                    const transferTitle = `${lastName} ${firstName} ${trip.title} ${tripDate}`;
                    return (
                      <div key={child.child_id} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                        <div className="min-w-0">
                          <p className="text-xs text-gray-400 mb-0.5">Tytuł przelewu</p>
                          <p className="break-all text-sm font-medium text-gray-900">{transferTitle}</p>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); onCopy(transferTitle, 'Tytuł przelewu'); }} className="ml-2 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-white hover:text-gray-600">
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                  {trip.bank_account_pln && (
                    <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5">Konto PLN</p>
                        <p className="text-sm text-gray-900">{trip.bank_account_pln}</p>
                      </div>
                      <button
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-white hover:text-gray-600"
                        onClick={(e) => { e.stopPropagation(); onCopy(trip.bank_account_pln!, 'Numer konta PLN'); }}
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
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-white hover:text-gray-600"
                        onClick={(e) => { e.stopPropagation(); onCopy(trip.bank_account_eur!, 'Numer konta EUR'); }}
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </DetailCard>
            )}

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

            {trip.additional_info && (
              <DetailCard icon={Info} title="Dodatkowe informacje" className="lg:order-6">
                <ul className="space-y-2">
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
              </DetailCard>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export const TripCard = memo(TripCardInner);
