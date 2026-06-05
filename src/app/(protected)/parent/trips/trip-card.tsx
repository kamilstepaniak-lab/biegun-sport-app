'use client';

import { memo, useState, type ReactNode } from 'react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import {
  Calendar,
  ChevronDown,
  ChevronUp,
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
  MapPin,
  type LucideIcon,
} from 'lucide-react';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Textarea } from '@/components/ui/textarea';

import type { TripForParent, ChildTripStatus } from '@/lib/actions/trips';
import { GroupBadge } from '@/lib/group-icons';
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
  const DANGER_KEY = 'dangerouslySetInnerHTML' as const;
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
    <section className={cn('rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200', className)}>
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
            <div className="grid gap-x-4 gap-y-1 p-4 lg:grid-cols-[auto_18rem_auto_1fr_auto_auto] lg:items-center">
              <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl', campVisual.iconBox)}>
                <campVisual.Icon className="h-5 w-5" />
              </div>

              <h3 className="min-w-0 truncate text-sm font-bold text-slate-900">
                {trip.title}
              </h3>

              <p className="inline-flex items-center gap-1.5 text-sm font-bold text-blue-700 whitespace-nowrap">
                <Calendar className="h-3.5 w-3.5 text-blue-500" />
                {format(departureDate, 'dd.MM.yyyy', { locale: pl })} – {format(returnDate, 'dd.MM.yyyy', { locale: pl })}
              </p>

              <div className="hidden lg:block" />

              <span className={cn(
                'inline-flex w-max items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold',
                isPast
                  ? 'border-slate-200 bg-slate-100 text-slate-500'
                  : 'border-blue-200 bg-white text-blue-700'
              )}>
                <span className={cn('h-1.5 w-1.5 rounded-full', isPast ? 'bg-slate-400' : 'bg-blue-600')} />
                {isPast ? 'Zrealizowany' : 'Zapisy otwarte'}
              </span>

              <div className={cn(
                'flex h-8 w-8 items-center justify-center rounded-lg border transition-all',
                isOpen ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-500'
              )}>
                <ChevronDown className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')} />
              </div>
            </div>

            {!isPast && (
              <div className="space-y-2 border-t border-slate-100 bg-slate-50/70 p-4">
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
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 rounded-xl bg-gray-50/80 gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0">
                            {child.child_name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-800 leading-tight">{child.child_name}</p>
                            {currentStatus !== 'unconfirmed' && (
                              <span className={cn(
                                'mt-0.5 inline-flex items-center gap-1 text-xs font-medium',
                                currentStatus === 'confirmed' ? 'text-emerald-600'
                                  : currentStatus === 'not_going' ? 'text-red-500'
                                    : 'text-amber-600'
                              )}>
                                <StatusIcon className="h-3 w-3" />
                                {statusLabel}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1 flex-wrap">
                          <button
                            disabled={isUpdating}
                            onClick={(e) => { e.stopPropagation(); onOpenConfirmPanel(key, 'stop1'); }}
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
                          {hasStop2 && (
                            <button
                              disabled={isUpdating}
                              onClick={(e) => { e.stopPropagation(); onOpenConfirmPanel(key, 'stop2'); }}
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
                          {trip.allow_own_transport && (
                            <button
                              disabled={isUpdating}
                              onClick={(e) => { e.stopPropagation(); onOpenConfirmPanel(key, 'own'); }}
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
                          <button
                            disabled={isUpdating}
                            onClick={(e) => { e.stopPropagation(); onOpenConfirmPanel(key, 'not_going'); }}
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
                          <button
                            disabled={isUpdating}
                            onClick={(e) => { e.stopPropagation(); onOpenConfirmPanel(key, 'other'); }}
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
                              onChange={(e) => onConfirmMessageChange(e.target.value)}
                              rows={2}
                              className="text-sm rounded-lg bg-white"
                              onClick={(e) => e.stopPropagation()}
                              autoFocus
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={(e) => { e.stopPropagation(); onCancelConfirmPanel(); }}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
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
          <div className="grid gap-4 bg-slate-50 p-6 lg:grid-cols-3">
            <div className="relative -m-6 mb-2 overflow-hidden bg-blue-600 p-6 text-white shadow-sm lg:col-span-3">
              <div className="relative flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <h3 className="text-2xl font-bold leading-tight tracking-tight">{trip.title}</h3>
                    {isPast && (
                      <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-blue-50 ring-1 ring-white/20">
                        Zrealizowany
                      </span>
                    )}
                  </div>
                  <div className="mt-5 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
                      <MapPin className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-blue-100">Miejsce</p>
                      <p className="text-base font-bold text-white">{trip.location || trip.departure_location || '—'}</p>
                    </div>
                  </div>
                </div>
                {trip.groups.length > 0 && (
                  <div className="flex flex-wrap gap-x-4 gap-y-2 xl:justify-end">
                    {trip.groups.map((g) => (
                      <GroupBadge key={g.id} name={g.name} />
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 lg:order-1 lg:col-span-2">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600">
                  <Info className="h-3.5 w-3.5 text-white" />
                </div>
                <h4 className="text-sm font-bold text-slate-900">Podstawowe informacje</h4>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                  <p className="text-[11px] font-medium text-slate-500">Nazwa wyjazdu</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{trip.title}</p>
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
              <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 lg:order-3 lg:col-span-2">
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
                        <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-400 whitespace-nowrap">Kwota</th>
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
                                confirmedAt={confirmedChild?.confirmed_at}
                                departureDate={trip.departure_datetime}
                              />
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium ${method.className}`}>
                                {method.label}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right font-semibold text-gray-900 whitespace-nowrap">
                              {template.amount.toFixed(0)} {template.currency}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {totalLabel && (
                      <tfoot>
                        <tr className="border-t border-slate-200">
                          <td colSpan={3} className="px-4 py-3 text-sm font-bold text-slate-900">
                            Razem
                          </td>
                          <td className="px-4 py-3 text-right text-lg font-black text-slate-950">
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
              <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 lg:order-5 lg:col-span-2">
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
