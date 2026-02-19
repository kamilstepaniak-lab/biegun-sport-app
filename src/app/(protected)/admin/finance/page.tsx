export const dynamic = 'force-dynamic';

import { BarChart2 } from 'lucide-react';

import { PageHeader, EmptyState } from '@/components/shared';
import { getAllPayments } from '@/lib/actions/payments';
import { FinanceSummary } from './finance-summary';

export default async function AdminFinancePage() {
  const payments = await getAllPayments();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finanse"
        description="Podsumowanie płatności per wyjazd"
      />

      {payments.length === 0 ? (
        <EmptyState
          icon={BarChart2}
          title="Brak danych"
          description="Nie ma jeszcze żadnych płatności w systemie."
        />
      ) : (
        <FinanceSummary payments={payments} />
      )}
    </div>
  );
}
