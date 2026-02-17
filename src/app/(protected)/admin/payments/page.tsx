export const dynamic = 'force-dynamic';

import { CreditCard } from 'lucide-react';

import { PageHeader, EmptyState } from '@/components/shared';
import { getAllPayments } from '@/lib/actions/payments';
import { PaymentsList } from './payments-list';

export default async function AdminPaymentsPage() {
  const payments = await getAllPayments();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Płatności"
        description="Zarządzaj wszystkimi płatnościami w systemie"
      />

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
