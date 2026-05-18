'use server';

import { revalidatePath, revalidateTag as _revalidateTag, unstable_cache } from 'next/cache';
const revalidateTag = (tag: string) => (_revalidateTag as unknown as (tag: string) => void)(tag);
import { createClient, createAdminClient } from '@/lib/supabase/server';
import type { Payment, PaymentWithDetails, PaymentTransaction, AdminPaymentRow, PaymentStatus } from '@/types';
import { sendPaymentConfirmedEmail } from '@/lib/email';
import { logPaymentChange } from './payment-history';
import { logActivity } from './activity-logs';
import { format } from 'date-fns';
import { resolveEffectiveDueDate } from '@/lib/payment-due';

import { getAuthUser } from './auth-helpers';
import { getBankAccounts } from './settings';

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null as null, error: 'Nie jesteś zalogowany' as const };
  const role = user.app_metadata?.role ?? user.user_metadata?.role;
  if (role !== 'admin') return { user: null as null, error: 'Brak uprawnień' as const };
  return { user, error: null };
}

export async function getPaymentsForTrip(tripId: string): Promise<PaymentWithDetails[]> {
  const supabase = await createClient();

  const { user } = await requireAdmin(supabase);
  if (!user) return [];

  const { data: payments, error } = await supabase
    .from('payments')
    .select(`
      *,
      registration:trip_registrations (
        *,
        participant:participants (
          *,
          parent:profiles!parent_id (*)
        ),
        trip:trips (*)
      ),
      template:trip_payment_templates (due_days_from_confirmation),
      transactions:payment_transactions (*)
    `)
    .eq('registration.trip_id', tripId)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Payments fetch error:', error);
    return [];
  }

  return payments.filter((p: PaymentWithDetails) => p.registration) as PaymentWithDetails[];
}

const _fetchAllPaymentsDB = unstable_cache(
  async (): Promise<PaymentWithDetails[]> => {
    const supabaseAdmin = createAdminClient();
    const { data: payments, error } = await supabaseAdmin
      .from('payments')
      .select(`
        *,
        registration:trip_registrations (
          *,
          participant:participants (
            *,
            parent:profiles!parent_id (*)
          ),
          trip:trips (*)
        ),
        template:trip_payment_templates (due_days_from_confirmation),
        transactions:payment_transactions (*)
      `)
      .neq('status', 'cancelled')
      .order('due_date', { ascending: true });

    if (error) {
      console.error('Payments fetch error:', error);
      return [];
    }

    return payments.filter((p: PaymentWithDetails) => p.registration) as PaymentWithDetails[];
  },
  ['admin-payments'],
  { revalidate: 30, tags: ['payments'] },
);

export async function getAllPayments(): Promise<PaymentWithDetails[]> {
  const supabase = await createClient();
  const { user } = await requireAdmin(supabase);
  if (!user) return [];
  return _fetchAllPaymentsDB();
}

// ── Ekran /admin/payments — paginacja i filtrowanie po stronie bazy ─────────
// Wymaga widoku admin_payments_view (migracja: supabase/migrations/admin-payments-view.sql).

export type AdminPaymentsStatusFilter = 'all' | 'pending' | 'overdue' | 'paid';

export interface AdminPaymentsPageParams {
  page: number;
  pageSize: number;
  search: string;
  tripId: string;
  status: AdminPaymentsStatusFilter;
  dateFrom: string;
  dateTo: string;
}

export async function getAdminPaymentsPage(
  params: AdminPaymentsPageParams
): Promise<{ rows: AdminPaymentRow[]; total: number }> {
  const supabase = await createClient();
  const { user } = await requireAdmin(supabase);
  if (!user) return { rows: [], total: 0 };

  const admin = createAdminClient();
  let query = admin
    .from('admin_payments_view')
    .select('*', { count: 'exact' })
    .neq('status', 'cancelled');

  if (params.tripId && params.tripId !== 'all') {
    query = query.eq('trip_id', params.tripId);
  }

  const today = format(new Date(), 'yyyy-MM-dd');
  if (params.status === 'pending') {
    query = query.in('status', ['pending', 'partially_paid']);
  } else if (params.status === 'paid') {
    query = query.eq('status', 'paid');
  } else if (params.status === 'overdue') {
    query = query.or(
      `status.in.(overdue,partially_paid_overdue),and(due_date.lt.${today},status.not.in.(paid,cancelled))`
    );
  }

  if (params.search.trim()) {
    // Usuń znaki specjalne PostgREST (zapobiega rozbiciu składni .or)
    const s = params.search.trim().replace(/[%,()*]/g, ' ');
    query = query.or(`participant_name.ilike.%${s}%,trip_title.ilike.%${s}%`);
  }

  if (params.dateFrom) query = query.gte('created_at', params.dateFrom);
  if (params.dateTo) query = query.lte('created_at', `${params.dateTo}T23:59:59.999Z`);

  const fromIdx = (params.page - 1) * params.pageSize;
  query = query
    // id jako tiebreaker — płatności z jednej partii mają identyczny created_at;
    // bez tego kolejność jest niestabilna i wiersze skaczą między stronami.
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(fromIdx, fromIdx + params.pageSize - 1);

  const { data, error, count } = await query;
  if (error) {
    console.error('getAdminPaymentsPage error:', error);
    return { rows: [], total: 0 };
  }
  return { rows: (data ?? []) as AdminPaymentRow[], total: count ?? 0 };
}

export async function getAdminPaymentsStats(): Promise<{
  pending: number;
  paid: number;
  pendingPLN: number;
  pendingEUR: number;
}> {
  const supabase = await createClient();
  const { user } = await requireAdmin(supabase);
  if (!user) return { pending: 0, paid: 0, pendingPLN: 0, pendingEUR: 0 };

  const admin = createAdminClient();
  // Tylko 4 lekkie kolumny — nawet przy dziesiątkach tysięcy wierszy to ułamek
  // payloadu pełnego pobrania z zagnieżdżonymi relacjami.
  const { data, error } = await admin
    .from('payments')
    .select('status, amount, amount_paid, currency')
    .neq('status', 'cancelled');

  if (error || !data) return { pending: 0, paid: 0, pendingPLN: 0, pendingEUR: 0 };

  let pending = 0;
  let paid = 0;
  let pendingPLN = 0;
  let pendingEUR = 0;
  for (const p of data) {
    if (p.status === 'paid') {
      paid++;
    } else {
      pending++;
      const remaining = (p.amount ?? 0) - (p.amount_paid ?? 0);
      if (p.currency === 'PLN') pendingPLN += remaining;
      else pendingEUR += remaining;
    }
  }
  return { pending, paid, pendingPLN, pendingEUR };
}

export async function getAdminPaymentsTrips(): Promise<{ id: string; title: string }[]> {
  const supabase = await createClient();
  const { user } = await requireAdmin(supabase);
  if (!user) return [];

  const admin = createAdminClient();
  const { data } = await admin
    .from('trips')
    .select('id, title, departure_datetime')
    .order('departure_datetime', { ascending: true });

  return (data ?? []).map((t) => ({ id: t.id, title: t.title }));
}

// ── Ekran /admin/finance — agregacja per wyjazd po stronie bazy ─────────────
// Wymaga widoku admin_finance_summary (migracja: admin-finance-summary-view.sql).

export interface TripFinanceSummary {
  tripId: string;
  tripTitle: string;
  tripDeparture: string;
  participantCount: number;
  totalPLN: number;
  paidPLN: number;
  missingPLN: number;
  totalEUR: number;
  paidEUR: number;
  missingEUR: number;
  totalPayments: number;
  paidPayments: number;
  pct: number;
}

export async function getFinanceSummary(): Promise<TripFinanceSummary[]> {
  const supabase = await createClient();
  const { user } = await requireAdmin(supabase);
  if (!user) return [];

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('admin_finance_summary')
    .select('*')
    .order('trip_departure', { ascending: true });

  if (error) {
    console.error('getFinanceSummary error:', error);
    return [];
  }

  return (data ?? []).map((r) => {
    const totalPLN = Number(r.total_pln) || 0;
    const paidPLN = Number(r.paid_pln) || 0;
    const totalEUR = Number(r.total_eur) || 0;
    const paidEUR = Number(r.paid_eur) || 0;
    const totalPayments = Number(r.total_payments) || 0;
    const paidPayments = Number(r.paid_payments) || 0;
    return {
      tripId: r.trip_id,
      tripTitle: r.trip_title,
      tripDeparture: r.trip_departure,
      participantCount: Number(r.participant_count) || 0,
      totalPLN,
      paidPLN,
      missingPLN: totalPLN - paidPLN,
      totalEUR,
      paidEUR,
      missingEUR: totalEUR - paidEUR,
      totalPayments,
      paidPayments,
      pct: totalPayments > 0 ? Math.round((paidPayments / totalPayments) * 100) : 0,
    };
  });
}

export async function addPaymentTransaction(
  paymentId: string,
  amount: number,
  currency: 'PLN' | 'EUR',
  transactionDate: string,
  paymentMethod: 'cash' | 'transfer',
  notes?: string,
  closeAsDiscount: boolean = false
) {
  const supabase = await createClient();

  const { user, error: authError } = await requireAdmin(supabase);
  if (authError) return { error: authError };

  // Pobierz płatność
  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .select('*')
    .eq('id', paymentId)
    .single();

  if (paymentError || !payment) {
    return { error: 'Nie znaleziono płatności' };
  }

  if (amount <= 0) {
    return { error: 'Kwota wpłaty musi być większa od zera' };
  }
  if (payment.status === 'cancelled') {
    return { error: 'Nie można rejestrować wpłaty dla anulowanej płatności' };
  }

  // Utwórz transakcję
  const { error: transactionError } = await supabase
    .from('payment_transactions')
    .insert({
      payment_id: paymentId,
      amount,
      currency,
      transaction_date: transactionDate,
      payment_method: paymentMethod,
      notes: notes || null,
      recorded_by: user.id,
    });

  if (transactionError) {
    console.error('Transaction error:', transactionError);
    return { error: 'Nie udało się dodać wpłaty' };
  }

  // Zaktualizuj amount_paid
  const newAmountPaid = (payment.amount_paid || 0) + amount;

  // Checkbox „zniżka": gdy wpłata nie pokrywa należności, obniżamy kwotę
  // należną do sumy wpłat — płatność zostaje zamknięta jako opłacona.
  // original_amount (cena cennikowa) zostaje, więc widać wielkość zniżki.
  const newAmount =
    closeAsDiscount && newAmountPaid < payment.amount ? newAmountPaid : payment.amount;

  const newStatus = recomputePaymentStatus(newAmount, newAmountPaid, payment.due_date);

  const { error: updateError } = await supabase
    .from('payments')
    .update({
      amount: newAmount,
      amount_paid: newAmountPaid,
      status: newStatus,
      paid_at: newStatus === 'paid' ? new Date(transactionDate).toISOString() : null,
      payment_method_used: paymentMethod,
      updated_at: new Date().toISOString(),
    })
    .eq('id', paymentId);

  if (updateError) {
    console.error('Payment update error:', updateError);
  }

  // Audit log — nie blokuje głównej akcji
  logPaymentChange({
    paymentId,
    userId: user.id,
    oldStatus: payment.status,
    newStatus: newStatus,
    oldAmountPaid: payment.amount_paid || 0,
    newAmountPaid: newAmountPaid,
    action: 'payment_added',
    note: notes,
  }).catch(console.error);

  revalidateTag('payments');
  revalidatePath('/admin/payments');
  revalidatePath('/admin/trips');
  revalidatePath('/parent/payments');

  return { success: true };
}

export async function markPaymentAsPaid(
  paymentId: string,
  paymentMethod: 'cash' | 'transfer'
) {
  const supabase = await createClient();

  const { user, error: authError } = await requireAdmin(supabase);
  if (authError) return { error: authError };

  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .select('*')
    .eq('id', paymentId)
    .single();

  if (paymentError || !payment) {
    return { error: 'Nie znaleziono płatności' };
  }

  const remainingAmount = payment.amount - (payment.amount_paid || 0);

  if (remainingAmount > 0) {
    // Dodaj transakcję na pozostałą kwotę
    await supabase.from('payment_transactions').insert({
      payment_id: paymentId,
      amount: remainingAmount,
      currency: payment.currency,
      transaction_date: new Date().toISOString().split('T')[0],
      payment_method: paymentMethod,
      notes: 'Oznaczone jako opłacone przez admina',
      recorded_by: user.id,
    });
  }

  // Zaktualizuj płatność
  const { error: updateError } = await supabase
    .from('payments')
    .update({
      amount_paid: payment.amount,
      status: 'paid',
      paid_at: new Date().toISOString(),
      payment_method_used: paymentMethod,
      marked_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', paymentId);

  if (updateError) {
    console.error('Payment update error:', updateError);
    return { error: 'Nie udało się oznaczyć jako opłacone' };
  }

  // Audit log
  logPaymentChange({
    paymentId,
    userId: user.id,
    oldStatus: payment.status,
    newStatus: 'paid',
    oldAmountPaid: payment.amount_paid || 0,
    newAmountPaid: payment.amount,
    action: 'marked_paid',
    note: `Oznaczone ręcznie jako opłacone (${paymentMethod === 'cash' ? 'gotówka' : 'przelew'})`,
  }).catch(console.error);

  // Wyślij e-mail potwierdzenia płatności
  try {
    const { data: fullPayment } = await supabase
      .from('payments')
      .select(`
        amount, currency, payment_type, installment_number,
        registration:trip_registrations (
          participant:participants (first_name, last_name, parent:profiles!parent_id (email, first_name)),
          trip:trips (title)
        )
      `)
      .eq('id', paymentId)
      .single();

    const reg = fullPayment?.registration as unknown as {
      participant: { first_name: string; last_name: string; parent: { email: string; first_name: string } };
      trip: { title: string };
    } | null;

    if (reg && fullPayment) {
      const paymentLabel = fullPayment.payment_type === 'installment'
        ? `Rata ${fullPayment.installment_number}`
        : fullPayment.payment_type === 'season_pass' ? 'Karnet' : 'Pełna opłata';

      sendPaymentConfirmedEmail(
        reg.participant.parent.email,
        reg.participant.parent.first_name,
        `${reg.participant.first_name} ${reg.participant.last_name}`,
        reg.trip.title,
        fullPayment.amount,
        fullPayment.currency,
        paymentLabel,
      ).catch(console.error);
    }
  } catch {
    // e-mail nie blokuje aktualizacji
  }

  revalidateTag('payments');
  revalidatePath('/admin/payments');
  revalidatePath('/admin/trips');
  revalidatePath('/parent/payments');

  return { success: true };
}

export async function applyDiscount(paymentId: string, discountPercentage: number) {
  const supabase = await createClient();

  const { user, error: authError } = await requireAdmin(supabase);
  if (authError) return { error: authError };

  if (discountPercentage < 0 || discountPercentage > 100) {
    return { error: 'Zniżka musi być w zakresie 0-100%' };
  }

  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .select('*')
    .eq('id', paymentId)
    .single();

  if (paymentError || !payment) {
    return { error: 'Nie znaleziono płatności' };
  }

  const newAmount = payment.original_amount * (1 - discountPercentage / 100);

  const { error: updateError } = await supabase
    .from('payments')
    .update({
      discount_percentage: discountPercentage,
      amount: newAmount,
      discount_applied_by: user.id,
      discount_applied_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', paymentId);

  if (updateError) {
    console.error('Discount update error:', updateError);
    return { error: 'Nie udało się zastosować zniżki' };
  }

  revalidateTag('payments');
  revalidatePath('/admin/payments');
  revalidatePath('/admin/trips');
  revalidatePath('/parent/payments');

  return { success: true };
}

export async function getPaymentTransactions(paymentId: string): Promise<PaymentTransaction[]> {
  const supabase = await createClient();
  const { user } = await requireAdmin(supabase);
  if (!user) return [];

  const { data: transactions, error } = await supabase
    .from('payment_transactions')
    .select('*')
    .eq('payment_id', paymentId)
    .order('transaction_date', { ascending: false });

  if (error) {
    console.error('Transactions fetch error:', error);
    return [];
  }

  return transactions;
}

// Tworzy płatności dla uczestnika na podstawie szablonów wyjazdu
export async function createPaymentsForRegistration(registrationId: string, tripId: string, participantId: string, confirmedAt: string) {
  // Używamy admin client żeby ominąć RLS
  const supabaseAdmin = createAdminClient();

  // Pobierz szablony płatności dla wyjazdu
  const { data: templates } = await supabaseAdmin
    .from('trip_payment_templates')
    .select('*')
    .eq('trip_id', tripId);

  if (!templates || templates.length === 0) {
    return { success: true, message: 'Brak szablonów płatności' };
  }

  // Pobierz dane uczestnika (do sprawdzenia rocznika dla karnetów)
  const { data: participant } = await supabaseAdmin
    .from('participants')
    .select('birth_date')
    .eq('id', participantId)
    .single();

  const birthYear = participant ? new Date(participant.birth_date).getFullYear() : null;

  // Utwórz płatności
  const paymentsToCreate = templates
    .filter((template: {
      payment_type: string;
      birth_year_from: number | null;
      birth_year_to: number | null;
      category_name: string | null;
    }) => {
      // Dla karnetów sprawdź czy rocznik się zgadza
      if (template.payment_type === 'season_pass' && birthYear) {
        const matchesFrom = !template.birth_year_from || birthYear >= template.birth_year_from;
        const matchesTo = !template.birth_year_to || birthYear <= template.birth_year_to;
        return matchesFrom && matchesTo;
      }
      return true;
    })
    .map((template: {
      id: string;
      payment_type: string;
      installment_number: number | null;
      amount: number;
      currency: string;
      due_date: string | null;
      due_days_from_confirmation: number | null;
      payment_method: string | null;
    }) => {
      const dueDate = resolveEffectiveDueDate({
        templateDueDate: template.due_date,
        dueDaysFromConfirmation: template.due_days_from_confirmation,
        confirmedAt,
      });
      return {
        registration_id: registrationId,
        template_id: template.id,
        payment_type: template.payment_type,
        installment_number: template.installment_number,
        original_amount: template.amount,
        discount_percentage: 0,
        amount: template.amount,
        currency: template.currency,
        due_date: dueDate,
        status: 'pending',
        amount_paid: 0,
      };
    });

  if (paymentsToCreate.length > 0) {
    const { error } = await supabaseAdmin.from('payments').insert(paymentsToCreate);
    if (error) {
      console.error('Create payments error:', error);
      return { error: 'Nie udało się utworzyć płatności' };
    }
  }

  return { success: true };
}

// Typ dla płatności rodzica
export interface ParentPayment {
  id: string;
  participant_id: string;
  trip_title: string;
  trip_id: string;
  trip_departure_date: string;
  trip_return_date: string | null;
  child_name: string;
  child_first_name: string;
  child_last_name: string;
  payment_type: string;
  installment_number: number | null;
  amount: number;
  original_amount: number;
  currency: string;
  due_date: string | null;
  status: string;
  amount_paid: number;
  payment_method: 'cash' | 'transfer' | 'both' | null;
}

// Typ dla danych do przelewu
export interface BankAccountInfo {
  bank_account_pln: string | null;
  bank_account_eur: string | null;
}

// ── Cache DB fetch (bez cookies — tylko admin client) ─────────────────────
const _fetchParentPaymentsDB = unstable_cache(
  async (userId: string): Promise<ParentPayment[]> => {
    const supabaseAdmin = createAdminClient();

    const { data: children } = await supabaseAdmin
      .from('participants')
      .select('id, first_name, last_name')
      .eq('parent_id', userId);

    if (!children || children.length === 0) return [];

    const childIds = children.map((c: { id: string }) => c.id);
    const childDataMap = new Map(children.map((c: { id: string; first_name: string; last_name: string }) => [
      c.id,
      { name: `${c.first_name} ${c.last_name}`, first_name: c.first_name, last_name: c.last_name },
    ]));

    const { data: registrations } = await supabaseAdmin
      .from('trip_registrations')
      .select(`
        id,
        participant_id,
        trip_id,
        participation_status,
        confirmed_at,
        trip:trips (
          id,
          title,
          departure_datetime,
          return_datetime
        )
      `)
      .in('participant_id', childIds)
      .eq('status', 'active')
      .eq('participation_status', 'confirmed');

    if (!registrations || registrations.length === 0) return [];

    const registrationIds = registrations.map((r: { id: string }) => r.id);

    const { data: payments, error } = await supabaseAdmin
      .from('payments')
      .select('*')
      .in('registration_id', registrationIds)
      .neq('status', 'cancelled')
      .order('due_date', { ascending: true });

    if (error || !payments) {
      console.error('Payments fetch error:', error);
      return [];
    }

    const templateIds = [...new Set(
      payments
        .map((p: { template_id: string | null }) => p.template_id)
        .filter((id: string | null): id is string => !!id),
    )];

    const templateMethodMap = new Map<string, 'cash' | 'transfer' | 'both' | null>();
    const templateDueDaysMap = new Map<string, number | null>();
    if (templateIds.length > 0) {
      const { data: templates } = await supabaseAdmin
        .from('trip_payment_templates')
        .select('id, payment_method, due_days_from_confirmation')
        .in('id', templateIds);
      (templates || []).forEach((t: { id: string; payment_method: 'cash' | 'transfer' | 'both' | null; due_days_from_confirmation: number | null }) => {
        templateMethodMap.set(t.id, t.payment_method);
        templateDueDaysMap.set(t.id, t.due_days_from_confirmation);
      });
    }

    const result: ParentPayment[] = payments.map((payment: {
      id: string;
      registration_id: string;
      template_id: string | null;
      payment_type: string;
      installment_number: number | null;
      amount: number;
      original_amount: number;
      currency: string;
      due_date: string | null;
      status: string;
      amount_paid: number;
    }) => {
      const registration = registrations.find((r: { id: string }) => r.id === payment.registration_id) as {
        id: string;
        participant_id: string;
        trip_id: string;
        confirmed_at: string | null;
        trip: { id: string; title: string; departure_datetime: string; return_datetime: string } | null;
      } | undefined;
      const childData = childDataMap.get(registration?.participant_id || '');
      const dueDays = payment.template_id ? (templateDueDaysMap.get(payment.template_id) ?? null) : null;
      const confirmedAt = registration?.confirmed_at ?? null;
      const computedDueDate = resolveEffectiveDueDate({
        paymentDueDate: payment.due_date,
        dueDaysFromConfirmation: dueDays,
        confirmedAt,
      });
      return {
        id: payment.id,
        participant_id: registration?.participant_id || '',
        trip_title: registration?.trip?.title || 'Nieznany wyjazd',
        trip_id: registration?.trip_id || '',
        trip_departure_date: registration?.trip?.departure_datetime || '',
        trip_return_date: registration?.trip?.return_datetime || null,
        child_name: childData?.name || 'Nieznane dziecko',
        child_first_name: childData?.first_name || '',
        child_last_name: childData?.last_name || '',
        payment_type: payment.payment_type,
        installment_number: payment.installment_number,
        amount: payment.amount,
        original_amount: payment.original_amount,
        currency: payment.currency,
        due_date: computedDueDate,
        status: payment.status,
        amount_paid: payment.amount_paid || 0,
        payment_method: payment.template_id ? (templateMethodMap.get(payment.template_id) || null) : null,
      };
    });

    return result;
  },
  ['parent-payments'],
  { revalidate: 60, tags: ['payments'] },
);

export async function getPaymentsForParent(selectedChildId?: string): Promise<ParentPayment[]> {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  if (!user) return [];

  const allPayments = await _fetchParentPaymentsDB(user.id);

  if (selectedChildId) {
    return allPayments.filter((p) => p.participant_id === selectedChildId);
  }
  return allPayments;
}

// Pobierz rzeczywiste daty płatności (z payments) dla uczestnika na danym wyjeździe.
// Zwraca mapę template_id → due_date (obliczone z confirmed_at gdy due_date jest null).
export async function getActualPaymentDueDatesForTrip(
  tripId: string,
  participantId: string,
): Promise<Record<string, string>> {
  const supabaseAdmin = createAdminClient();

  const { data: registration } = await supabaseAdmin
    .from('trip_registrations')
    .select('id, confirmed_at')
    .eq('trip_id', tripId)
    .eq('participant_id', participantId)
    .eq('participation_status', 'confirmed')
    .maybeSingle();

  if (!registration) return {};

  const { data: payments } = await supabaseAdmin
    .from('payments')
    .select('template_id, due_date, template:trip_payment_templates!template_id(due_days_from_confirmation)')
    .eq('registration_id', registration.id)
    .neq('status', 'cancelled');

  if (!payments) return {};

  const result: Record<string, string> = {};
  for (const p of payments) {
    if (!p.template_id) continue;
    const dueDays = (p.template as { due_days_from_confirmation?: number | null } | null)?.due_days_from_confirmation ?? null;
    const dueDate = resolveEffectiveDueDate({
      paymentDueDate: p.due_date,
      dueDaysFromConfirmation: dueDays,
      confirmedAt: registration.confirmed_at,
    });
    if (dueDate) result[p.template_id] = dueDate;
  }
  return result;
}

// Pobierz dane do przelewu — wspólne konto bankowe z ustawień aplikacji
export async function getBankAccountsForParent(): Promise<BankAccountInfo> {
  const { user } = await getAuthUser();
  if (!user) {
    return { bank_account_pln: null, bank_account_eur: null };
  }

  const accounts = await getBankAccounts();
  return {
    bank_account_pln: accounts.bank_account_pln || null,
    bank_account_eur: accounts.bank_account_eur || null,
  };
}

export async function updatePaymentStatus(
  paymentId: string,
  status: 'pending' | 'paid' | 'cancelled'
) {
  const supabase = await createClient();

  const { user, error: authError } = await requireAdmin(supabase);
  if (authError) return { error: authError };

  // Pobierz płatność (wraz ze starym statusem do audit logu)
  const { data: payment } = await supabase
    .from('payments')
    .select('amount, status, amount_paid, due_date')
    .eq('id', paymentId)
    .single();

  if (!payment) {
    return { error: 'Nie znaleziono płatności' };
  }

  const oldStatus = payment.status;
  const oldAmountPaid = payment.amount_paid || 0;

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (status === 'cancelled') {
    // Anulowanie — status ustawiany wprost, kwot nie ruszamy.
    updateData.status = 'cancelled';
  } else {
    // 'paid' → traktujemy jak pełną wpłatę; 'pending' → zerujemy wpłatę.
    // Wynikowy status zawsze przez recomputePaymentStatus (jedno źródło prawdy).
    const newAmountPaid = status === 'paid' ? payment.amount : 0;
    const computed = recomputePaymentStatus(payment.amount, newAmountPaid, payment.due_date);
    updateData.amount_paid = newAmountPaid;
    updateData.status = computed;
    updateData.paid_at = computed === 'paid' ? new Date().toISOString() : null;
    if (status === 'paid') updateData.marked_by = user.id;
  }

  const { error } = await supabase
    .from('payments')
    .update(updateData)
    .eq('id', paymentId);

  if (error) {
    console.error('Update payment status error:', error);
    return { error: `Nie udało się zmienić statusu: ${error.message}` };
  }

  // Audit log — nie blokuje
  logPaymentChange({
    paymentId,
    userId: user.id,
    oldStatus,
    newStatus: status,
    oldAmountPaid,
    newAmountPaid: status === 'paid' ? payment.amount : (status === 'pending' ? 0 : oldAmountPaid),
    action: 'status_changed',
  }).catch(console.error);

  // E-mail potwierdzenia — nie blokuje odpowiedzi (fire & forget)
  if (status === 'paid') {
    (async () => {
      try {
        const { data: fullPayment } = await supabase
          .from('payments')
          .select(`
            amount, currency, payment_type, installment_number,
            registration:trip_registrations (
              participant:participants (first_name, last_name, parent:profiles!parent_id (email, first_name)),
              trip:trips (title)
            )
          `)
          .eq('id', paymentId)
          .single();

        const reg = fullPayment?.registration as unknown as {
          participant: { first_name: string; last_name: string; parent: { email: string; first_name: string } };
          trip: { title: string };
        } | null;

        if (reg && fullPayment) {
          const paymentLabel = fullPayment.payment_type === 'installment'
            ? `Rata ${fullPayment.installment_number}`
            : fullPayment.payment_type === 'season_pass' ? 'Karnet' : 'Pełna opłata';

          await sendPaymentConfirmedEmail(
            reg.participant.parent.email,
            reg.participant.parent.first_name,
            `${reg.participant.first_name} ${reg.participant.last_name}`,
            reg.trip.title,
            fullPayment.amount,
            fullPayment.currency,
            paymentLabel,
          );
        }
      } catch {
        // e-mail nie blokuje aktualizacji
      }
    })().catch(console.error);
  }

  revalidateTag('payments');
  revalidatePath('/admin/payments');
  revalidatePath('/admin/trips');
  revalidatePath('/parent/payments');

  return { success: true };
}

export async function updatePaymentAmount(paymentId: string, newAmount: number) {
  const supabase = await createClient();

  const { error: authError } = await requireAdmin(supabase);
  if (authError) return { error: authError };

  if (newAmount < 0) {
    return { error: 'Kwota nie może być ujemna' };
  }

  const { data: payment } = await supabase
    .from('payments')
    .select('amount_paid, due_date, status')
    .eq('id', paymentId)
    .single();

  if (!payment) {
    return { error: 'Nie znaleziono płatności' };
  }

  const updateData: Record<string, unknown> = {
    amount: newAmount,
    updated_at: new Date().toISOString(),
  };

  // Płatność anulowana — zmieniamy tylko kwotę, statusu nie ruszamy.
  if (payment.status !== 'cancelled') {
    const newStatus = recomputePaymentStatus(newAmount, payment.amount_paid || 0, payment.due_date);
    updateData.status = newStatus;
    updateData.paid_at = newStatus === 'paid' ? new Date().toISOString() : null;
  }

  const { error } = await supabase
    .from('payments')
    .update(updateData)
    .eq('id', paymentId);

  if (error) {
    console.error('Update payment amount error:', error);
    return { error: `Nie udało się zaktualizować kwoty: ${error.message}` };
  }

  revalidateTag('payments');
  revalidatePath('/admin/payments');
  revalidatePath('/admin/trips');
  revalidatePath('/parent/payments');

  return { success: true };
}

export async function updatePaymentNote(paymentId: string, note: string) {
  const supabase = await createClient();

  const { error: authError } = await requireAdmin(supabase);
  if (authError) return { error: authError };

  const { error } = await supabase
    .from('payments')
    .update({ admin_notes: note || null, updated_at: new Date().toISOString() })
    .eq('id', paymentId);

  if (error) {
    console.error('Update payment note error:', error);
    return { error: `Nie udało się zapisać notatki: ${error.message}` };
  }

  revalidateTag('payments');
  revalidatePath('/admin/payments');
  revalidatePath('/admin/trips');

  return { success: true };
}

export async function deletePayment(paymentId: string) {
  const supabase = await createClient();
  const supabaseAdmin = createAdminClient();

  const { user, error: authError } = await requireAdmin(supabase);
  if (authError) return { error: authError };

  // Pobierz snapshot przed usunięciem (do audytu)
  const { data: snapshot } = await supabaseAdmin
    .from('payments')
    .select('id, registration_id, payment_type, installment_number, amount, amount_paid, currency, status')
    .eq('id', paymentId)
    .maybeSingle();

  const { error } = await supabaseAdmin
    .from('payments')
    .delete()
    .eq('id', paymentId);

  if (error) {
    console.error('Delete payment error:', error);
    return { error: 'Nie udało się usunąć płatności' };
  }

  logActivity(user.id, user.email ?? null, 'payment_deleted', {
    paymentId,
    snapshot: snapshot ?? null,
  }).catch(console.error);

  revalidateTag('payments');
  revalidatePath('/admin/payments');
  revalidatePath('/admin/trips');
  revalidatePath('/parent/payments');

  return { success: true };
}

export async function bulkDeletePayments(paymentIds: string[]) {
  if (!paymentIds.length) return { success: true };

  const supabase = await createClient();
  const supabaseAdmin = createAdminClient();

  const { user, error: authError } = await requireAdmin(supabase);
  if (authError) return { error: authError };

  const { data: snapshots } = await supabaseAdmin
    .from('payments')
    .select('id, registration_id, payment_type, installment_number, amount, amount_paid, currency, status')
    .in('id', paymentIds);

  const { error } = await supabaseAdmin
    .from('payments')
    .delete()
    .in('id', paymentIds);

  if (error) {
    console.error('Bulk delete payments error:', error);
    return { error: 'Nie udało się usunąć płatności' };
  }

  logActivity(user.id, user.email ?? null, 'payment_deleted', {
    paymentIds,
    count: paymentIds.length,
    snapshots: snapshots ?? null,
  }).catch(console.error);

  revalidateTag('payments');
  revalidatePath('/admin/payments');
  revalidatePath('/admin/trips');
  revalidatePath('/parent/payments');

  return { success: true };
}

export async function bulkUpdatePaymentStatus(
  paymentIds: string[],
  status: 'paid' | 'pending'
) {
  if (!paymentIds.length) return { success: true };

  const supabase = await createClient();

  const { user, error: authError } = await requireAdmin(supabase);
  if (authError) return { error: authError };

  const now = new Date().toISOString();

  if (status === 'pending') {
    const { error } = await supabase
      .from('payments')
      .update({ status: 'pending', amount_paid: 0, paid_at: null, updated_at: now })
      .in('id', paymentIds);

    if (error) return { error: `Błąd: ${error.message}` };
  } else {
    // Pobierz kwoty — każda płatność ma inną wartość
    const { data: rows } = await supabase
      .from('payments')
      .select('id, amount')
      .in('id', paymentIds)
      .neq('status', 'paid');

    if (rows && rows.length > 0) {
      await Promise.all(
        (rows as { id: string; amount: number }[]).map(row =>
          supabase
            .from('payments')
            .update({ status: 'paid', amount_paid: row.amount, paid_at: now, marked_by: user.id, updated_at: now })
            .eq('id', row.id)
        )
      );
    }
  }

  revalidateTag('payments');
  revalidatePath('/admin/payments');
  revalidatePath('/admin/trips');
  return { success: true };
}

// Jedyne źródło prawdy dla statusu płatności. Wyliczany ze stosunku
// kwoty wpłaconej do należnej oraz terminu. NIE zwraca 'cancelled' —
// nie wolno jej wołać dla płatności anulowanych.
function recomputePaymentStatus(
  amount: number,
  amountPaid: number,
  dueDate: string | null,
): PaymentStatus {
  const isOverdue = dueDate !== null && new Date(dueDate) < new Date();
  if (amountPaid >= amount) return 'paid';
  if (amountPaid > 0) return isOverdue ? 'partially_paid_overdue' : 'partially_paid';
  return isOverdue ? 'overdue' : 'pending';
}
