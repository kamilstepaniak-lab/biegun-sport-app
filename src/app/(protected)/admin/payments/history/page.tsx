import Link from 'next/link';
import { ArrowLeft, History, ArrowRight } from 'lucide-react';

import { PageHeader } from '@/components/shared';
import { getPaymentHistory } from '@/lib/actions/payment-history';

const ACTION_LABELS: Record<string, string> = {
  payment_added: 'Wpłata',
  marked_paid: 'Oznaczono jako opłacone',
  status_changed: 'Zmiana statusu',
  cancelled: 'Anulowanie',
};

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pending: { label: 'Oczekująca', className: 'bg-yellow-100 text-yellow-800' },
  partially_paid: { label: 'Częściowo', className: 'bg-blue-100 text-blue-800' },
  partially_paid_overdue: { label: 'Częściowo (po terminie)', className: 'bg-orange-100 text-orange-800' },
  paid: { label: 'Opłacona', className: 'bg-green-100 text-green-800' },
  overdue: { label: 'Po terminie', className: 'bg-red-100 text-red-800' },
  cancelled: { label: 'Anulowana', className: 'bg-gray-100 text-gray-600' },
};

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-gray-400 text-xs">—</span>;
  const s = STATUS_LABELS[status] ?? { label: status, className: 'bg-gray-100 text-gray-600' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${s.className}`}>
      {s.label}
    </span>
  );
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('pl-PL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatAmount(amount: number | null, currency: string | null) {
  if (amount === null || amount === undefined) return '—';
  return `${amount.toFixed(2)} ${currency ?? 'PLN'}`;
}

export default async function PaymentHistoryPage() {
  const entries = await getPaymentHistory(300);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/payments"
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Płatności
        </Link>
      </div>

      <PageHeader
        title="Historia zmian płatności"
        description={`Audit log — ostatnie ${entries.length} zmian statusów płatności. Tabela jest tylko do odczytu.`}
      />

      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400 space-y-3">
          <History className="h-10 w-10" />
          <p className="text-sm">Brak zapisanych zmian. Historia będzie tu widoczna po pierwszej zmianie statusu płatności.</p>
        </div>
      ) : (
        <div className="rounded-2xl border bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left">
                  <th className="px-4 py-3 font-medium text-gray-600 whitespace-nowrap">Data i czas</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Uczestnik</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Wyjazd</th>
                  <th className="px-4 py-3 font-medium text-gray-600 whitespace-nowrap">Rata / typ</th>
                  <th className="px-4 py-3 font-medium text-gray-600 whitespace-nowrap">Kwota zapłacona</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Zmiana statusu</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Akcja</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Zmienił</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {entries.map((entry) => {
                  const paymentLabel =
                    entry.payment_type === 'installment'
                      ? `Rata ${entry.installment_number ?? ''}`
                      : entry.payment_type === 'season_pass'
                      ? 'Karnet'
                      : entry.payment_type ?? '—';

                  return (
                    <tr key={entry.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap font-mono">
                        {formatDateTime(entry.changed_at)}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                        {entry.participant_name ?? <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-700 max-w-[180px] truncate">
                        {entry.trip_title ?? <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {paymentLabel}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {entry.old_amount_paid !== null && (
                          <span className="text-gray-400 text-xs">
                            {formatAmount(entry.old_amount_paid, entry.currency)}
                          </span>
                        )}
                        {entry.old_amount_paid !== null && entry.new_amount_paid !== null && (
                          <ArrowRight className="inline h-3 w-3 mx-1 text-gray-300" />
                        )}
                        {entry.new_amount_paid !== null && (
                          <span className="font-medium text-gray-800">
                            {formatAmount(entry.new_amount_paid, entry.currency)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <StatusBadge status={entry.old_status} />
                          {entry.old_status && (
                            <ArrowRight className="h-3 w-3 text-gray-300 flex-shrink-0" />
                          )}
                          <StatusBadge status={entry.new_status} />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-700">
                          {ACTION_LABELS[entry.action] ?? entry.action}
                        </span>
                        {entry.note && (
                          <p className="text-xs text-gray-400 mt-0.5">{entry.note}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {entry.changed_by_name ?? entry.changed_by_email ?? (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t bg-gray-50 text-xs text-gray-400">
            Pokazano {entries.length} ostatnich wpisów. Tabela jest append-only — nie można edytować ani usuwać historii.
          </div>
        </div>
      )}
    </div>
  );
}
