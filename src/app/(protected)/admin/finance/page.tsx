import { BarChart2 } from 'lucide-react';

import { PageHeader, EmptyState } from '@/components/shared';
import { getFinanceSummary } from '@/lib/actions/payments';
import { FinanceSummary } from './finance-summary';

export default async function AdminFinancePage() {
  const summaries = await getFinanceSummary();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finanse"
        description="Podsumowanie płatności per wyjazd"
      />

      {summaries.length === 0 ? (
        <EmptyState
          icon={BarChart2}
          title="Brak danych"
          description="Nie ma jeszcze żadnych płatności w systemie."
        />
      ) : (
        <FinanceSummary summaries={summaries} />
      )}
    </div>
  );
}
