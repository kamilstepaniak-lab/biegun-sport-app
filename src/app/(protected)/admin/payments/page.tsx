export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { CreditCard, History } from 'lucide-react';

import { PageHeader, EmptyState } from '@/components/shared';
import { getAllPayments } from '@/lib/actions/payments';
import { PaymentsList } from './payments-list';

export default async function AdminPaymentsPage() {
  const payments = await getAllPayments();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Płatności"
          description="Zarządzaj wszystkimi płatnościami w systemie"
        />
        <Link
          href="/admin/payments/history"
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border rounded-xl hover:bg-gray-50 transition-colors whitespace-nowrap flex-shrink-0"
        >
          <History className="h-4 w-4" />
          Historia zmian
        </Link>
      </div>

      {payments.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="Brak płatności"
          description="Nie ma jeszcze żadnych płatności w systemie."
        />
      ) : (
        <PaymentsList payments={payments} />
      )}
    </div>
  );
}
