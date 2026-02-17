export const dynamic = 'force-dynamic';

import { CreditCard } from 'lucide-react';

import { PageHeader, EmptyState } from '@/components/shared';
import { ChildGuard } from '@/components/parent/child-guard';
import { getPaymentsForParent, getBankAccountsForParent } from '@/lib/actions/payments';
import { ParentPaymentsList } from './payments-list';

interface Props {
  searchParams: Promise<{ child?: string; childName?: string }>;
}

export default async function ParentPaymentsPage({ searchParams }: Props) {
  const { child: selectedChildId, childName } = await searchParams;

  const [payments, bankAccounts] = await Promise.all([
    getPaymentsForParent(selectedChildId),
    getBankAccountsForParent(),
  ]);

  const pendingPayments = payments.filter(p => p.status !== 'paid');
  const paidPayments = payments.filter(p => p.status === 'paid');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Płatności"
        description="Zarządzaj płatnościami za wyjazdy swoich dzieci"
      />

      <ChildGuard selectedChildId={selectedChildId} selectedChildName={childName}>
        {payments.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="Brak płatności"
            description="Zapisz dziecko na wyjazd klikając na przystanek, aby zobaczyć płatności."
          />
        ) : (
          <ParentPaymentsList
            pendingPayments={pendingPayments}
            paidPayments={paidPayments}
            bankAccounts={bankAccounts}
          />
        )}
      </ChildGuard>
    </div>
  );
}
