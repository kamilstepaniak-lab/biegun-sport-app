'use client';

import { memo } from 'react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import {
  ChevronDown,
  ChevronUp,
  X,
  HelpCircle,
  Clock,
  Calendar,
  Banknote,
  Copy,
  Receipt,
  ArrowRight,
  ArrowLeft,
  Bus,
  CheckCircle2,
  Backpack,
  Info,
} from 'lucide-react';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Textarea } from '@/components/ui/textarea';

import type { TripForParent, ChildTripStatus } from '@/lib/actions/trips';
import { getGroupColor } from '@/lib/group-colors';
import { cn } from '@/lib/utils';
import { formatTripDatetime } from '@/lib/trip-datetime';
import { formatPaymentDueDate } from '@/lib/payment-due';

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

function getMethodLabel(method: string | null | undefined, short = false) {
  if (method === 'transfer') return 'Przelew';
  if (method === 'cash') return 'Gotówka';
  if (method === 'both') return short ? 'Przel./Got.' : 'Przelew/Got.';
  return '–';
}

// Opis wyjazdu zawiera HTML kontrolowany przez admina (edytor WYSIWYG).
function RichDescription({ html }: { html: string }) {
  const DANGER_KEY = 'dangerouslySetInnerHTML' as const;
  const props = { className: 'rich-content text-sm text-gray-600 leading-relaxed', [DANGER_KEY]: { __html: html } } as React.HTMLAttributes<HTMLDivElement>;
  return <div {...props} />;
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
  const departureDate = new Date(trip.departure_datetime);
  const hasStop2 = !!trip.departure_stop2_location;

  return (
    <Collapsible open={isOpen} onOpenChange={() => onToggle(trip.id)}>
      <div className={cn(
        'rounded-2xl transition-all duration-200',
        isOpen
          ? 'bg-white shadow-lg ring-2 ring-blue-400'
          : 'bg-white shadow-sm border border-gray-100 hover:shadow-md hover:border-gray-200',
        isPast && !isOpen && 'opacity-60'
      )}>
        <CollapsibleTrigger asChild>
          <div className="p-3 sm:p-5 cursor-pointer">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="mb-1.5">
                  <h3 className="font-semibold text-lg text-gray-900 leading-tight">{trip.title}</h3>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    {trip.groups.map((g) => {
                      const colors = getGroupColor(g.name);
                      return (
                        <span key={g.id} className={cn(
                          'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-medium',
                          colors.bg, colors.text
                        )}>
                          <span className={cn('w-1 h-1 rounded-full', colors.dot)} />
                          {g.name}
                        </span>
                      );
                    })}
                    {isPast && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-medium bg-gray-100 text-gray-400">
                        <CheckCircle2 className="h-2.5 w-2.5" />
                        Zrealizowany
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className={cn(
                'w-8 h-8 rounded-xl flex items-center justify-center transition-colors ml-3',
                isOpen ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'
              )}>
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </div>

            {!isPast && (
              <div className="mt-4 space-y-2">
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
                      {currentStatus === 'confirmed' && child.payments.length > 0 && (
                        <div className="px-3 pb-1 space-y-0.5">
                          {child.payments.map((p, i) => {
                            const label = p.payment_type === 'installment'
                              ? `Rata ${p.installment_number}`
                              : p.payment_type === 'season_pass'
                                ? 'Karnet'
                                : 'Opłata';
                            const dateStr = p.due_date
                              ? `do ${format(new Date(p.due_date), 'd MMM yyyy', { locale: pl })}`
                              : 'brak terminu';
                            return (
                              <p key={i} className="text-xs text-gray-500">
                                {label}: <span className="font-medium text-gray-700">{p.amount.toFixed(0)} {p.currency}</span>
                                {' · '}{dateStr}
                              </p>
                            );
                          })}
                        </div>
                      )}
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
          <div className="px-3 sm:px-5 pb-4 sm:pb-5 space-y-4">
            <div className="h-px bg-gray-100" />

            <div className="grid gap-4 md:grid-cols-2">
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600">
                    <Calendar className="h-3.5 w-3.5 text-white" />
                  </div>
                  <h4 className="text-sm font-semibold text-gray-900">Wyjazd</h4>
                </div>
                <div className="bg-white rounded-xl p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <ArrowRight className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{trip.departure_location}</p>
                      <p className="text-xs text-gray-500">
                        {formatTripDatetime(trip.departure_datetime, trip.departure_time_known ?? true)}
                      </p>
                    </div>
                  </div>
                  {trip.departure_stop2_location && (
                    <div className="flex items-start gap-2">
                      <ArrowRight className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
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
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600">
                    <Calendar className="h-3.5 w-3.5 text-white" />
                  </div>
                  <h4 className="text-sm font-semibold text-gray-900">Powrót</h4>
                </div>
                <div className="bg-white rounded-xl p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <ArrowLeft className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{trip.return_location}</p>
                      <p className="text-xs text-gray-500">
                        {formatTripDatetime(trip.return_datetime, trip.return_time_known ?? true)}
                      </p>
                    </div>
                  </div>
                  {trip.return_stop2_location && (
                    <div className="flex items-start gap-2">
                      <ArrowLeft className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
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

            {trip.description && (
              <div className="bg-gray-50 rounded-xl p-4">
                <RichDescription html={trip.description} />
              </div>
            )}

            {trip.payment_templates && trip.payment_templates.length > 0 && (
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600">
                    <Receipt className="h-3.5 w-3.5 text-white" />
                  </div>
                  <h4 className="text-sm font-semibold text-gray-900">Cennik</h4>
                </div>
                <div className="bg-white rounded-xl overflow-x-auto ring-1 ring-gray-100">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 whitespace-nowrap">Typ</th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 whitespace-nowrap">Termin</th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 whitespace-nowrap">Forma</th>
                        <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 whitespace-nowrap">Kwota</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {trip.payment_templates.map((template) => {
                        const label = getTemplateLabel(template);
                        const methodLabel = getMethodLabel(template.payment_method);
                        const methodCls = template.payment_method === 'cash'
                          ? 'bg-amber-100 text-amber-700'
                          : template.payment_method === 'both'
                            ? 'bg-violet-100 text-violet-700'
                            : 'bg-blue-100 text-blue-700';
                        return (
                          <tr key={template.id} className="hover:bg-gray-50/50">
                            <td className="px-4 py-2.5 font-medium text-gray-900 whitespace-nowrap">{label}</td>
                            <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">
                              {formatPaymentDueDate(template, trip.departure_datetime)}
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium ${methodCls}`}>
                                {methodLabel}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right font-semibold text-gray-900 whitespace-nowrap">
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
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600">
                    <Banknote className="h-3.5 w-3.5 text-white" />
                  </div>
                  <h4 className="text-sm font-semibold text-gray-900">Dane do przelewu</h4>
                </div>
                <div className="space-y-2">
                  {trip.children.map((child) => {
                    const [firstName, ...lastNameParts] = child.child_name.split(' ');
                    const lastName = lastNameParts.join(' ');
                    const tripDate = format(departureDate, 'dd.MM.yyyy', { locale: pl });
                    const transferTitle = `${lastName} ${firstName} ${trip.title} ${tripDate}`;
                    return (
                      <div key={child.child_id} className="flex items-center justify-between bg-white rounded-xl p-3 ring-1 ring-gray-100">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-400 mb-0.5">Tytuł przelewu – {child.child_name}</p>
                          <p className="text-sm font-medium text-gray-900 break-all">{transferTitle}</p>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); onCopy(transferTitle, 'Tytuł przelewu'); }} className="ml-2 flex h-8 w-8 items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600 flex-shrink-0">
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                  <div className="grid gap-2 md:grid-cols-2">
                    {trip.bank_account_pln && (
                      <div className="flex items-center justify-between bg-white rounded-xl p-3 ring-1 ring-gray-100">
                        <div>
                          <p className="text-xs text-gray-400 mb-0.5">Konto PLN</p>
                          <p className="text-sm text-gray-900">{trip.bank_account_pln}</p>
                        </div>
                        <button
                          className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
                          onClick={(e) => { e.stopPropagation(); onCopy(trip.bank_account_pln!, 'Numer konta PLN'); }}
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
                          onClick={(e) => { e.stopPropagation(); onCopy(trip.bank_account_eur!, 'Numer konta EUR'); }}
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {trip.packing_list && (
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600">
                    <Backpack className="h-3.5 w-3.5 text-white" />
                  </div>
                  <h4 className="text-sm font-semibold text-gray-900">Co zabrać</h4>
                </div>
                <ul className="bg-white rounded-xl p-3 space-y-1.5">
                  {trip.packing_list
                    .split('\n')
                    .map((line) => line.replace(/^[-•*]\s*/, '').trim())
                    .filter(Boolean)
                    .map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                </ul>
              </div>
            )}

            {trip.additional_info && (
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600">
                    <Info className="h-3.5 w-3.5 text-white" />
                  </div>
                  <h4 className="text-sm font-semibold text-gray-900">Dodatkowe informacje</h4>
                </div>
                <ul className="bg-white rounded-xl p-3 space-y-1.5">
                  {trip.additional_info
                    .split('\n')
                    .map((line) => line.replace(/^[-•*]\s*/, '').trim())
                    .filter(Boolean)
                    .map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export const TripCard = memo(TripCardInner);
