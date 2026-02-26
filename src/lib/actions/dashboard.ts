'use server';

import { createClient, createAdminClient } from '@/lib/supabase/server';

export interface NearestTrip {
  id: string;
  title: string;
  departure_datetime: string;
  departure_location: string;
  daysUntil: number;
}

export interface PaymentSummaryItem {
  id: string;
  trip_title: string;
  amount: number;
  currency: string;
  due_date: string | null;
  status: string;
  amount_paid: number;
  isOverdue: boolean;
}

export interface AttendanceSummary {
  completed: number;
  total: number;
}

export interface DashboardData {
  nearestTrip: NearestTrip | null;
  pendingPayments: PaymentSummaryItem[];
  overdueCount: number;
  attendance: AttendanceSummary;
}

type TripRecord = {
  id: string;
  title: string;
  departure_datetime: string;
  departure_location: string;
  return_datetime: string;
} | null;

type Registration = {
  id: string;
  participation_status: string;
  status: string;
  trip: TripRecord | TripRecord[];
};

export async function getDashboardData(participantId: string): Promise<DashboardData> {
  const empty: DashboardData = {
    nearestTrip: null,
    pendingPayments: [],
    overdueCount: 0,
    attendance: { completed: 0, total: 0 },
  };

  const supabase = await createClient();
  const supabaseAdmin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return empty;

  const now = new Date();
  const nowIso = now.toISOString();

  // Fetch all active registrations for this participant with trip data
  const { data: registrations, error: regError } = await supabase
    .from('trip_registrations')
    .select(`
      id,
      participation_status,
      status,
      trip:trips (
        id,
        title,
        departure_datetime,
        departure_location,
        return_datetime
      )
    `)
    .eq('participant_id', participantId)
    .eq('status', 'active');

  if (regError) {
    console.error('getDashboardData registrations error:', regError);
    return empty;
  }

  const regs: Registration[] = (registrations || []).filter((r: Registration) => {
    const t = Array.isArray(r.trip) ? r.trip[0] : r.trip;
    return t != null;
  });

  const getTrip = (r: Registration): TripRecord => {
    return Array.isArray(r.trip) ? (r.trip[0] ?? null) : r.trip;
  };

  // ── Nearest upcoming trip (confirmed, departure in future) ───────────────
  const upcomingConfirmed = regs
    .filter((r) => {
      const t = getTrip(r);
      return r.participation_status === 'confirmed' && t && t.departure_datetime > nowIso;
    })
    .sort((a, b) => {
      const tA = getTrip(a);
      const tB = getTrip(b);
      return (
        new Date(tA?.departure_datetime ?? '').getTime() -
        new Date(tB?.departure_datetime ?? '').getTime()
      );
    });

  let nearestTrip: NearestTrip | null = null;
  if (upcomingConfirmed.length > 0) {
    const t = getTrip(upcomingConfirmed[0]);
    if (t) {
      const daysUntil = Math.ceil(
        (new Date(t.departure_datetime).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      nearestTrip = {
        id: t.id,
        title: t.title,
        departure_datetime: t.departure_datetime,
        departure_location: t.departure_location,
        daysUntil,
      };
    }
  }

  // ── Attendance ────────────────────────────────────────────────────────────
  const participatingRegs = regs.filter((r) =>
    ['confirmed', 'unconfirmed'].includes(r.participation_status)
  );
  const total = participatingRegs.length;
  const completed = participatingRegs.filter((r) => {
    const t = getTrip(r);
    return t && t.return_datetime < nowIso;
  }).length;

  // ── Pending payments ──────────────────────────────────────────────────────
  const registrationIds = regs.map((r) => r.id);
  let pendingPayments: PaymentSummaryItem[] = [];
  let overdueCount = 0;

  if (registrationIds.length > 0) {
    const { data: payments, error: payError } = await supabaseAdmin
      .from('payments')
      .select(
        'id, registration_id, amount, currency, due_date, status, amount_paid'
      )
      .in('registration_id', registrationIds)
      .not('status', 'in', '("cancelled","paid")')
      .order('due_date', { ascending: true });

    if (!payError && payments) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      pendingPayments = payments
        .map(
          (p: {
            id: string;
            registration_id: string;
            amount: number;
            currency: string;
            due_date: string | null;
            status: string;
            amount_paid: number;
          }) => {
            const reg = regs.find((r) => r.id === p.registration_id);
            const t = reg ? getTrip(reg) : null;
            const isOverdue = !!p.due_date && new Date(p.due_date) < today;
            return {
              id: p.id,
              trip_title: t?.title ?? '',
              amount: p.amount,
              currency: p.currency,
              due_date: p.due_date,
              status: p.status,
              amount_paid: p.amount_paid,
              isOverdue,
            };
          }
        )
        .slice(0, 3);

      overdueCount = pendingPayments.filter((p) => p.isOverdue).length;
    }
  }

  return {
    nearestTrip,
    pendingPayments,
    overdueCount,
    attendance: { completed, total },
  };
}
