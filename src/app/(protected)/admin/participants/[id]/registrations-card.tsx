'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, CreditCard } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ParticipantRegistration {
  id: string;
  trip:
    | {
        id: string;
        title: string;
        status: string;
        departure_datetime: string | null;
      }
    | {
        id: string;
        title: string;
        status: string;
        departure_datetime: string | null;
      }[]
    | null;
  payments:
    | {
        id: string;
        status: string;
        amount: number;
        amount_paid: number | null;
        currency: string | null;
      }[]
    | null;
}

interface RegistrationsCardProps {
  registrations: ParticipantRegistration[];
}

const PAGE_SIZE = 10;

function formatAmount(amount: number, currency = 'PLN') {
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency }).format(amount);
}

function formatShortDate(date: string | null | undefined) {
  if (!date) return 'Brak daty';
  return format(new Date(date), 'd.MM.yyyy', { locale: pl });
}

function PaymentStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    paid: { label: 'Zapłacono', className: 'bg-emerald-100 text-emerald-700' },
    partial: { label: 'Do dopłaty', className: 'bg-amber-100 text-amber-700' },
    unpaid: { label: 'Nieopłacone', className: 'bg-red-100 text-red-700' },
    cancelled: { label: 'Anulowano', className: 'bg-gray-100 text-gray-500' },
  };
  const { label, className } = map[status] ?? { label: status, className: 'bg-gray-100 text-gray-600' };
  return <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${className}`}>{label}</span>;
}

export function RegistrationsCard({ registrations }: RegistrationsCardProps) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(registrations.length / PAGE_SIZE));
  const paginated = useMemo(
    () => registrations.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [registrations, page]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600">
            <CreditCard className="h-3.5 w-3.5 text-white" />
          </span>
          Zapisy i płatności
        </CardTitle>
        <CardDescription>Wyjazdy i płatności przypisane do uczestnika</CardDescription>
      </CardHeader>
      <CardContent>
        {registrations.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">
            Brak zapisów na wyjazdy
          </p>
        ) : (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-lg border">
              <div className="grid grid-cols-[minmax(0,1fr)_120px_190px] gap-3 border-b bg-gray-50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-gray-400 max-lg:hidden">
                <span>Wyjazd</span>
                <span>Termin</span>
                <span>Płatność</span>
              </div>
              <div className="divide-y">
                {paginated.map((reg) => {
                  const trip = Array.isArray(reg.trip) ? reg.trip[0] : reg.trip;
                  const payment = Array.isArray(reg.payments) ? reg.payments[0] : null;
                  const currency = payment?.currency ?? 'PLN';

                  return (
                    <div
                      key={reg.id}
                      className="grid gap-3 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_120px_190px] lg:items-center"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-950">
                          {trip?.title ?? 'Nieznany wyjazd'}
                        </p>
                        <p className="mt-1 text-xs text-slate-500 lg:hidden">
                          {formatShortDate(trip?.departure_datetime)}
                        </p>
                      </div>
                      <p className="hidden text-sm text-gray-600 lg:block">
                        {formatShortDate(trip?.departure_datetime)}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        {payment ? (
                          <>
                            <span className="text-sm text-gray-600">
                              {formatAmount(payment.amount_paid ?? 0, currency)} / {formatAmount(payment.amount, currency)}
                            </span>
                            <PaymentStatusBadge status={payment.status} />
                          </>
                        ) : (
                          <span className="text-sm text-gray-400">Brak płatności</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {pageCount > 1 && (
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-gray-500">
                  Strona {page} z {pageCount}, rekordy {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, registrations.length)} z {registrations.length}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Poprzednia
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                    disabled={page === pageCount}
                  >
                    Następna
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
