import Link from 'next/link';
import { CreditCard, History } from 'lucide-react';

import { PageHeader, EmptyState } from '@/components/shared';
import {
  getAdminPaymentsPage,
  getAdminPaymentsStats,
  getAdminPaymentsTrips,
  type AdminPaymentsStatusFilter,
} from '@/lib/actions/payments';
import { PaymentsList } from './payments-list';

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
  const status: AdminPaymentsStatusFilter = (['all', 'pending', 'overdue', 'paid'].includes(
    sp.status ?? ''
  )
    ? sp.status
    : 'all') as AdminPaymentsStatusFilter;
  const dateFrom = sp.from ?? '';
  const dateTo = sp.to ?? '';

  const [{ rows, total }, stats, trips] = await Promise.all([
    getAdminPaymentsPage({ page, pageSize, search, tripId, status, dateFrom, dateTo }),
    getAdminPaymentsStats(),
    getAdminPaymentsTrips(),
  ]);

  const hasActiveFilter =
    !!search || tripId !== 'all' || status !== 'all' || !!dateFrom || !!dateTo;

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

      {total === 0 && !hasActiveFilter ? (
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
          dateFrom={dateFrom}
          dateTo={dateTo}
        />
      )}
    </div>
  );
}
