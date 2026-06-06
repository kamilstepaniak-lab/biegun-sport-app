import { CreditCard } from 'lucide-react';

import { EmptyState } from '@/components/shared';
import { ChildGuard } from '@/components/parent/child-guard';
import { ParentChildSelector } from '@/components/parent/parent-child-selector';
import { ParentPageHeader } from '@/components/parent/parent-page-header';
import { getPaymentsForParent, getBankAccountsForParent } from '@/lib/actions/payments';
import { getMyChildren } from '@/lib/actions/participants';
import { ParentPaymentsList, BankAccountsSection } from './payments-list';

interface Props {
  searchParams: Promise<{ child?: string; childName?: string }>;
}

export default async function ParentPaymentsPage({ searchParams }: Props) {
  const { child: selectedChildId, childName } = await searchParams;

  const [payments, bankAccounts, myChildren] = await Promise.all([
    getPaymentsForParent(selectedChildId === 'all' ? undefined : selectedChildId),
    getBankAccountsForParent(),
    getMyChildren(),
  ]);

  const childrenList = myChildren.map(c => ({
    id: c.id,
    name: `${c.first_name} ${c.last_name}`,
    groupName: c.group?.name ?? null,
  }));

  const pendingPayments = payments.filter(p => p.status !== 'paid');
  const paidPayments = payments.filter(p => p.status === 'paid');

  return (
    <div className="space-y-6">
      <ParentPageHeader
        icon={CreditCard}
        title="Płatności"
        description={
          <>
            Sprawdzaj należności, terminy i dane do przelewu dla każdego dziecka.
            <br className="hidden sm:block" />
            Płatności pojawią się po potwierdzeniu udziału i odblokowaniu wyjazdu przez organizatora.
          </>
        }
      >
        <ParentChildSelector
          selectedChildId={selectedChildId}
          selectedChildName={childName}
          childrenList={childrenList}
        />
      </ParentPageHeader>

      <ChildGuard selectedChildId={selectedChildId} selectedChildName={childName} childrenList={childrenList} showSelector={false}>
        {(bankAccounts.bank_account_pln || bankAccounts.bank_account_eur) && (
          <BankAccountsSection bankAccounts={bankAccounts} />
        )}

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
