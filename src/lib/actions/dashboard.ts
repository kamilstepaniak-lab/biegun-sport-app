'use server';

import { createAdminClient } from '@/lib/supabase/server';
import { resolveEffectiveDueDate } from '@/lib/payment-due';
import { getAuthUser } from './auth-helpers';
import type { TripCategory } from '@/types/database';

export interface NearestTrip {
  id: string;
  title: string;
  category: TripCategory | null;
  departure_datetime: string;
  departure_location: string;
  departure_stop2_datetime: string | null;
  departure_stop2_location: string | null;
  return_datetime: string;
  return_location: string | null;
  return_stop2_datetime: string | null;
  return_stop2_location: string | null;
  daysUntil: number;
  childNames?: string[];
}

export interface PaymentSummaryItem {
  id: string;
  trip_title: string;
  amount: number;
  currency: string;
  due_date: string | null;
  effective_due_date: string | null;
  status: string;
  amount_paid: number;
  isOverdue: boolean;
  daysOverdue: number;
  daysUntilDue: number | null;
}

export interface AttendanceSummary {
  completed: number;
  total: number;
}

export interface DashboardData {
  upcomingTrips: NearestTrip[];
  overduePayments: PaymentSummaryItem[];
  upcomingPayments: PaymentSummaryItem[];
  overdueCount: number;
  attendance: AttendanceSummary;
}

type TripRecord = {
  id: string;
  title: string;
  category: TripCategory | null;
  departure_datetime: string;
  departure_location: string;
  departure_stop2_datetime: string | null;
  departure_stop2_location: string | null;
  return_datetime: string;
  return_location: string | null;
  return_stop2_datetime: string | null;
  return_stop2_location: string | null;
} | null;

type Registration = {
  id: string;
  participant_id: string;
  participation_status: string;
  status: string;
  confirmed_at: string | null;
  trip: TripRecord | TripRecord[];
};

type PaymentRow = {
  id: string;
  registration_id: string;
  amount: number;
  currency: string;
  due_date: string | null;
  status: string;
  amount_paid: number;
  template_id: string | null;
  template:
    | { due_days_from_confirmation: number | null }[]
    | { due_days_from_confirmation: number | null }
    | null;
};

// Pola wyjazdu pobierane przy rejestracjach — wspólne dla obu ścieżek.
const REGISTRATION_SELECT = `
  id,
  participant_id,
  participation_status,
  status,
  confirmed_at,
  trip:trips (
    id,
    title,
    category,
    departure_datetime,
    departure_location,
    departure_stop2_datetime,
    departure_stop2_location,
    return_datetime,
    return_location,
    return_stop2_datetime,
    return_stop2_location
  )
`;

const PAYMENT_SELECT =
  'id, registration_id, amount, currency, due_date, status, amount_paid, template_id, template:trip_payment_templates!template_id(due_days_from_confirmation)';

function emptyDashboard(): DashboardData {
  return {
    upcomingTrips: [],
    overduePayments: [],
    upcomingPayments: [],
    overdueCount: 0,
    attendance: { completed: 0, total: 0 },
  };
}

// Czysta kalkulacja dashboardu dla JEDNEGO dziecka z już pobranych danych.
// Bez I/O — używana zarówno przez getDashboardData (1 dziecko), jak i przez
// getDashboardDataForChildren (batch — jeden komplet zapytań na wszystkie dzieci).
function computeDashboard(
  regs: Registration[],
  payments: PaymentRow[],
  now: Date,
): DashboardData {
  const nowIso = now.toISOString();
  const getTrip = (r: Registration): TripRecord =>
    Array.isArray(r.trip) ? (r.trip[0] ?? null) : r.trip;

  // ── Upcoming trips (confirmed, departure in future) — top 2 ─────────────
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

  // Dedup po id wyjazdu — dziecko może mieć kilka zapisów na ten sam wyjazd
  const seenTripIds = new Set<string>();
  const upcomingUnique = upcomingConfirmed.filter((r) => {
    const t = getTrip(r);
    if (!t || seenTripIds.has(t.id)) return false;
    seenTripIds.add(t.id);
    return true;
  });

  const upcomingTrips: NearestTrip[] = upcomingUnique.slice(0, 2).map((r) => {
    const t = getTrip(r);
    if (!t) return null;
    const daysUntil = Math.max(
      0,
      Math.ceil((new Date(t.departure_datetime).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    );
    return {
      id: t.id,
      title: t.title,
      category: t.category,
      departure_datetime: t.departure_datetime,
      departure_location: t.departure_location,
      departure_stop2_datetime: t.departure_stop2_datetime,
      departure_stop2_location: t.departure_stop2_location,
      return_datetime: t.return_datetime,
      return_location: t.return_location,
      return_stop2_datetime: t.return_stop2_datetime,
      return_stop2_location: t.return_stop2_location,
      daysUntil,
    };
  }).filter(Boolean) as NearestTrip[];

  // ── Attendance ────────────────────────────────────────────────────────────
  // Liczymy tylko wyjazdy, które rodzic potwierdził ("Jedzie").
  const participatingRegs = regs.filter((r) => r.participation_status === 'confirmed');
  const total = participatingRegs.length;
  const completed = participatingRegs.filter((r) => {
    const t = getTrip(r);
    return t && t.return_datetime < nowIso;
  }).length;

  // ── Payments ──────────────────────────────────────────────────────────────
  let overduePayments: PaymentSummaryItem[] = [];
  let upcomingPayments: PaymentSummaryItem[] = [];
  let overdueCount = 0;

  if (payments.length > 0) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const allMapped: PaymentSummaryItem[] = payments.map((p) => {
      const reg = regs.find((r) => r.id === p.registration_id);
      const t = reg ? getTrip(reg) : null;

      // Supabase zwraca relację many-to-one jako obiekt, ale w niektórych
      // przypadkach jako tablicę — obsługujemy oba warianty.
      const tmpl = Array.isArray(p.template) ? p.template[0] : p.template;
      const templateDueDays = tmpl?.due_days_from_confirmation ?? null;
      const effectiveDueDate = resolveEffectiveDueDate({
        paymentDueDate: p.due_date,
        dueDaysFromConfirmation: templateDueDays,
        confirmedAt: reg?.confirmed_at,
      });

      const isOverdue = !!effectiveDueDate && new Date(effectiveDueDate) < today;
      const daysOverdue =
        isOverdue && effectiveDueDate
          ? Math.floor(
              (today.getTime() - new Date(effectiveDueDate).getTime()) / (1000 * 60 * 60 * 24)
            )
          : 0;
      const daysUntilDue =
        !isOverdue && effectiveDueDate
          ? Math.ceil(
              (new Date(effectiveDueDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
            )
          : null;
      return {
        id: p.id,
        trip_title: t?.title ?? '',
        amount: p.amount,
        currency: p.currency,
        due_date: p.due_date,
        effective_due_date: effectiveDueDate,
        status: p.status,
        amount_paid: p.amount_paid,
        isOverdue,
        daysOverdue,
        daysUntilDue,
      };
    });

    // Zaległe — most overdue first
    const allOverdue = allMapped
      .filter((p) => p.isOverdue)
      .sort((a, b) => b.daysOverdue - a.daysOverdue);
    // Lista pokazuje top 3, ale licznik odzwierciedla wszystkie zaległości
    overduePayments = allOverdue.slice(0, 3);

    // Przyszłe — nearest due date first, top 3
    upcomingPayments = allMapped
      .filter((p) => !p.isOverdue)
      .sort((a, b) => {
        const aDate = a.effective_due_date;
        const bDate = b.effective_due_date;
        if (!aDate && !bDate) return 0;
        if (!aDate) return 1;
        if (!bDate) return -1;
        return new Date(aDate).getTime() - new Date(bDate).getTime();
      })
      .slice(0, 3);

    overdueCount = allOverdue.length;
  }

  return {
    upcomingTrips,
    overduePayments,
    upcomingPayments,
    overdueCount,
    attendance: { completed, total },
  };
}

// Filtruje rejestracje z brakującym wyjazdem (relacja może wrócić jako null/[]).
function normalizeRegs(rows: Registration[] | null): Registration[] {
  return (rows || []).filter((r) => {
    const t = Array.isArray(r.trip) ? r.trip[0] : r.trip;
    return t != null;
  });
}

// Dashboard dla JEDNEGO dziecka. Check własności + rejestracje równolegle,
// płatności po nich (zależą od reg ids).
export async function getDashboardData(participantId: string): Promise<DashboardData> {
  const { supabase, user, role } = await getAuthUser();
  if (!user) return emptyDashboard();
  const supabaseAdmin = createAdminClient();

  const ownershipCheck =
    role !== 'admin'
      ? supabase
          .from('participants')
          .select('id')
          .eq('id', participantId)
          .eq('parent_id', user.id)
          .maybeSingle()
      : Promise.resolve({ data: { id: participantId } });

  const [{ data: owned }, { data: registrations, error: regError }] = await Promise.all([
    ownershipCheck,
    supabase
      .from('trip_registrations')
      .select(REGISTRATION_SELECT)
      .eq('participant_id', participantId)
      .eq('status', 'active'),
  ]);

  if (!owned) return emptyDashboard();
  if (regError) {
    console.error('getDashboardData registrations error:', regError);
    return emptyDashboard();
  }

  const regs = normalizeRegs(registrations as unknown as Registration[]);
  const registrationIds = regs.map((r) => r.id);

  let payments: PaymentRow[] = [];
  if (registrationIds.length > 0) {
    const { data, error: payError } = await supabaseAdmin
      .from('payments')
      .select(PAYMENT_SELECT)
      .in('registration_id', registrationIds)
      .not('status', 'in', '("cancelled","paid")')
      .order('due_date', { ascending: true });
    if (payError) console.error('getDashboardData payments error:', payError);
    payments = (data as unknown as PaymentRow[]) || [];
  }

  return computeDashboard(regs, payments, new Date());
}

// Batch: dashboard dla WIELU dzieci naraz — jeden komplet zapytań zamiast
// (check + rejestracje + płatności) × liczba dzieci. Strona „Moje dzieci"
// jest teraz płaska pod kątem round-tripów niezależnie od liczby dzieci.
// Zwraca mapę participantId → DashboardData (dzieci bez danych dostają pustą).
export async function getDashboardDataForChildren(
  participantIds: string[],
): Promise<Record<string, DashboardData>> {
  const result: Record<string, DashboardData> = {};
  participantIds.forEach((id) => {
    result[id] = emptyDashboard();
  });
  if (participantIds.length === 0) return result;

  const { supabase, user, role } = await getAuthUser();
  if (!user) return result;
  const supabaseAdmin = createAdminClient();

  // Filtr własności (rodzic widzi tylko swoje dzieci) — równolegle z rejestracjami.
  const ownershipCheck =
    role !== 'admin'
      ? supabase
          .from('participants')
          .select('id')
          .eq('parent_id', user.id)
          .in('id', participantIds)
      : Promise.resolve({ data: participantIds.map((id) => ({ id })) });

  const [{ data: owned }, { data: registrations, error: regError }] = await Promise.all([
    ownershipCheck,
    supabase
      .from('trip_registrations')
      .select(REGISTRATION_SELECT)
      .in('participant_id', participantIds)
      .eq('status', 'active'),
  ]);

  const ownedIds = new Set((owned || []).map((o: { id: string }) => o.id));
  if (ownedIds.size === 0) return result;
  if (regError) {
    console.error('getDashboardDataForChildren registrations error:', regError);
    return result;
  }

  // Tylko rejestracje dzieci, do których rodzic ma prawo.
  const regs = normalizeRegs(registrations as unknown as Registration[]).filter((r) =>
    ownedIds.has(r.participant_id),
  );

  // Jedno zapytanie o płatności dla wszystkich rejestracji.
  const allRegIds = regs.map((r) => r.id);
  let payments: PaymentRow[] = [];
  if (allRegIds.length > 0) {
    const { data, error: payError } = await supabaseAdmin
      .from('payments')
      .select(PAYMENT_SELECT)
      .in('registration_id', allRegIds)
      .not('status', 'in', '("cancelled","paid")')
      .order('due_date', { ascending: true });
    if (payError) console.error('getDashboardDataForChildren payments error:', payError);
    payments = (data as unknown as PaymentRow[]) || [];
  }

  // Grupowanie po dziecku i mapie rejestracja → dziecko.
  const regIdToParticipant = new Map<string, string>();
  const regsByChild = new Map<string, Registration[]>();
  for (const r of regs) {
    regIdToParticipant.set(r.id, r.participant_id);
    const arr = regsByChild.get(r.participant_id) ?? [];
    arr.push(r);
    regsByChild.set(r.participant_id, arr);
  }
  const paymentsByChild = new Map<string, PaymentRow[]>();
  for (const p of payments) {
    const childId = regIdToParticipant.get(p.registration_id);
    if (!childId) continue;
    const arr = paymentsByChild.get(childId) ?? [];
    arr.push(p);
    paymentsByChild.set(childId, arr);
  }

  const now = new Date();
  for (const childId of ownedIds) {
    result[childId] = computeDashboard(
      regsByChild.get(childId) ?? [],
      paymentsByChild.get(childId) ?? [],
      now,
    );
  }

  return result;
}
