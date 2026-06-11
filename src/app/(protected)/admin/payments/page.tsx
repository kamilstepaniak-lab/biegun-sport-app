import Link from 'next/link';
import { CreditCard, History } from 'lucide-react';

import { PageHeader, EmptyState } from '@/components/shared';
import {
  getAdminPaymentsPage,
  getAdminPaymentParticipants,
  getAdminPaymentsStats,
  getAdminPaymentsTrips,
  type AdminPaymentsStatusFilter,
  type AdminPaymentsSort,
} from '@/lib/actions/payments';
import { PaymentsList } from './payments-list';
import { ManualPaymentDialog } from '@/components/admin/manual-payment-dialog';
import { RecordTransferDialog } from '@/components/admin/record-transfer-dialog';

const PAGE_SIZES = [25, 50, 100];

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;

  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);
  const pageSize = PAGE_SIZES.includes(Number(sp.size)) ? Number(sp.size) : 50;
  const search = sp.q ?? '';
  const tripId = sp.trip ?? 'all';
  // Domyślnie „Do zapłaty" — admin wchodzi tu rozliczać, nie przeglądać archiwum.
  const status: AdminPaymentsStatusFilter = (['all', 'pending', 'overdue', 'paid'].includes(
    sp.status ?? ''
  )
    ? sp.status
    : 'pending') as AdminPaymentsStatusFilter;
  const sort: AdminPaymentsSort = sp.sort === 'created' ? 'created' : 'due';
  const dateFrom = sp.from ?? '';
  const dateTo = sp.to ?? '';

  const filterParams = { search, tripId, dateFrom, dateTo };

  const [{ rows, total }, stats, trips, participants] = await Promise.all([
    getAdminPaymentsPage({ page, pageSize, status, sort, ...filterParams }),
    getAdminPaymentsStats(filterParams),
    getAdminPaymentsTrips(),
    getAdminPaymentParticipants(),
  ]);

  const hasActiveFilter =
    !!search || tripId !== 'all' || status !== 'pending' || !!dateFrom || !!dateTo;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Płatności"
        description="Zarządzaj wszystkimi płatnościami w systemie"
      >
        <RecordTransferDialog participants={participants} />
        <ManualPaymentDialog participants={participants} />
        <Link
          href="/admin/payments/history"
          className="flex items-center gap-2 px-3 py-2 text-sm bg-white border rounded-xl transition-colors whitespace-nowrap flex-shrink-0"
        >
          <History className="h-4 w-4" />
          Historia zmian
        </Link>
      </PageHeader>

      {total === 0 && !hasActiveFilter && stats.paid === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="Brak płatności"
          description="Nie ma jeszcze żadnych płatności w systemie."
        />
      ) : (
        <PaymentsList
          rows={rows}
          total={total}
          stats={stats}
          trips={trips}
          page={page}
          pageSize={pageSize}
          search={search}
          tripId={tripId}
          status={status}
          sort={sort}
          dateFrom={dateFrom}
          dateTo={dateTo}
        />
      )}
    </div>
  );
}
