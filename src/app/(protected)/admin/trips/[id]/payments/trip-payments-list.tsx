'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Download, CreditCard, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PaymentWithDetails } from '@/types';

interface TripPaymentsListProps {
  payments: PaymentWithDetails[];
  tripTitle: string;
}

const statusLabels: Record<string, string> = {
  pending: 'Nieopłacona',
  partially_paid: 'Częściowo',
  paid: 'Opłacona',
  overdue: 'Zaległa',
  partially_paid_overdue: 'Częściowo / Zaległa',
};

const statusColors: Record<string, string> = {
  paid: 'bg-green-100 text-green-700',
  partially_paid: 'bg-yellow-100 text-yellow-700',
  pending: 'bg-gray-100 text-gray-600',
  overdue: 'bg-red-100 text-red-700',
  partially_paid_overdue: 'bg-orange-100 text-orange-700',
};

const paymentTypeLabel = (type: string, installmentNumber: number | null) => {
  if (type === 'season_pass') return 'Karnet';
  if (type === 'installment') return `Rata ${installmentNumber ?? ''}`.trim();
  return type;
};

const methodLabel = (method: string | null) => {
  if (method === 'cash') return 'Gotówka';
  if (method === 'transfer') return 'Przelew';
  return '—';
};

function exportToCSV(payments: PaymentWithDetails[], tripTitle: string) {
  const headers = [
    'Nazwisko',
    'Imię',
    'Typ płatności',
    'Kwota',
    'Waluta',
    'Wpłacono',
    'Pozostało',
    'Status',
    'Termin',
    'Metoda zapłaty',
    'Data zapłaty',
    'Notatki admina',
  ];

  const rows = payments.map((p) => {
    const reg = p.registration as {
      participant?: { first_name: string; last_name: string } | null;
    } | null;
    const participant = reg?.participant;
    const lastName = participant?.last_name ?? '—';
    const firstName = participant?.first_name ?? '—';
    const type = paymentTypeLabel(p.payment_type, p.installment_number);
    const amount = p.amount.toFixed(2);
    const amountPaid = (p.amount_paid ?? 0).toFixed(2);
    const amountRemaining = (p.amount - (p.amount_paid ?? 0)).toFixed(2);
    const status = statusLabels[p.status] ?? p.status;
    const dueDate = p.due_date ? format(new Date(p.due_date), 'dd.MM.yyyy') : '—';
    const method = methodLabel(p.payment_method_used ?? null);
    const paidAt = p.paid_at ? format(new Date(p.paid_at), 'dd.MM.yyyy') : '—';
    const notes = p.admin_notes ?? '—';

    return [lastName, firstName, type, amount, p.currency, amountPaid, amountRemaining, status, dueDate, method, paidAt, notes];
  });

  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
    .join('\n');

  const bom = '\uFEFF';
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeTitle = tripTitle.replace(/[^a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ\s-]/g, '').trim();
  link.href = url;
  link.download = `Płatności - ${safeTitle}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  toast.success('Lista płatności wyeksportowana do pliku CSV');
}

export function TripPaymentsList({ payments, tripTitle }: TripPaymentsListProps) {
  const [search, setSearch] = useState('');

  const stats = useMemo(() => {
    const total = payments.reduce((s, p) => s + p.amount, 0);
    const paid = payments.reduce((s, p) => s + (p.amount_paid ?? 0), 0);
    const remaining = total - paid;
    const countPaid = payments.filter((p) => p.status === 'paid').length;
    const countOverdue = payments.filter((p) => p.status === 'overdue' || p.status === 'partially_paid_overdue').length;
    return { total, paid, remaining, countPaid, countOverdue };
  }, [payments]);

  const filtered = useMemo(() => {
    if (!search.trim()) return payments;
    const q = search.toLowerCase();
    return payments.filter((p) => {
      const reg = p.registration as { participant?: { first_name: string; last_name: string } | null } | null;
      const name = `${reg?.participant?.first_name ?? ''} ${reg?.participant?.last_name ?? ''}`.toLowerCase();
      return name.includes(q);
    });
  }, [payments, search]);

  // Grupuj po uczestniku: last_name + first_name
  const grouped = useMemo(() => {
    const map = new Map<string, { name: string; payments: PaymentWithDetails[] }>();
    for (const p of filtered) {
      const reg = p.registration as { participant?: { first_name: string; last_name: string } | null } | null;
      const key = `${reg?.participant?.last_name ?? ''}__${reg?.participant?.first_name ?? ''}`;
      const name = `${reg?.participant?.last_name ?? '—'} ${reg?.participant?.first_name ?? ''}`.trim();
      if (!map.has(key)) map.set(key, { name, payments: [] });
      map.get(key)!.payments.push(p);
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'pl'));
  }, [filtered]);

  return (
    <div className="space-y-6">
      {/* Statystyki */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                <CreditCard className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xl font-bold">{stats.total.toFixed(0)} PLN</p>
                <p className="text-xs text-muted-foreground">Do zapłaty łącznie</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-green-700">{stats.paid.toFixed(0)} PLN</p>
                <p className="text-xs text-muted-foreground">Wpłacono ({stats.countPaid} opłaconych)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-amber-700">{stats.remaining.toFixed(0)} PLN</p>
                <p className="text-xs text-muted-foreground">Pozostało do zapłaty</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-red-700">{stats.countOverdue}</p>
                <p className="text-xs text-muted-foreground">Zaległych rat</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-base">Lista płatności ({payments.length})</CardTitle>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Szukaj po nazwisku..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 w-48 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => exportToCSV(payments, tripTitle)}
                className="gap-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                Eksportuj CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {payments.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <CreditCard className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Brak płatności</p>
              <p className="text-sm">Płatności pojawią się po zapisaniu uczestników na wyjazd.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50/60 text-xs text-muted-foreground uppercase tracking-wide">
                    <th className="text-left py-2.5 px-4 font-medium">Uczestnik</th>
                    <th className="text-left py-2.5 px-3 font-medium">Typ</th>
                    <th className="text-right py-2.5 px-3 font-medium">Kwota</th>
                    <th className="text-right py-2.5 px-3 font-medium">Wpłacono</th>
                    <th className="text-left py-2.5 px-3 font-medium">Status</th>
                    <th className="text-left py-2.5 px-3 font-medium">Termin</th>
                    <th className="text-left py-2.5 px-3 font-medium">Metoda</th>
                    <th className="text-left py-2.5 px-3 font-medium">Data wpłaty</th>
                    <th className="text-left py-2.5 px-4 font-medium">Notatki</th>
                  </tr>
                </thead>
                <tbody>
                  {grouped.map(({ name, payments: pList }) => (
                    pList.map((p, idx) => (
                      <tr key={p.id} className="border-b last:border-0 hover:bg-gray-50/50 transition-colors">
                        <td className="py-2.5 px-4 font-medium text-gray-900">
                          {idx === 0 ? name : ''}
                        </td>
                        <td className="py-2.5 px-3 text-gray-600">
                          {paymentTypeLabel(p.payment_type, p.installment_number)}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums font-medium">
                          {p.amount.toFixed(0)} {p.currency}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-green-700">
                          {(p.amount_paid ?? 0) > 0 ? `${(p.amount_paid ?? 0).toFixed(0)} ${p.currency}` : '—'}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[p.status] ?? 'bg-gray-100 text-gray-600'}`}>
                            {statusLabels[p.status] ?? p.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-gray-600 text-xs">
                          {p.due_date ? format(new Date(p.due_date), 'd MMM yyyy', { locale: pl }) : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-gray-600 text-xs">
                          {methodLabel(p.payment_method_used ?? null)}
                        </td>
                        <td className="py-2.5 px-3 text-gray-600 text-xs">
                          {p.paid_at ? format(new Date(p.paid_at), 'd MMM yyyy', { locale: pl }) : '—'}
                        </td>
                        <td className="py-2.5 px-4 text-gray-500 text-xs max-w-[160px] truncate">
                          {p.admin_notes || '—'}
                        </td>
                      </tr>
                    ))
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
