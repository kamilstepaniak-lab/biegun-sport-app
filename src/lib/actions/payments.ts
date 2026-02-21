'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import type { Payment, PaymentWithDetails, PaymentTransaction } from '@/types';
import { sendPaymentConfirmedEmail } from '@/lib/email';

export async function getPaymentsForTrip(tripId: string): Promise<PaymentWithDetails[]> {
  const supabase = await createClient();

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

export async function getAllPayments(): Promise<PaymentWithDetails[]> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') return [];

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
      transactions:payment_transactions (*)
    `)
    .neq('status', 'cancelled')
    .order('due_date', { ascending: true });

  if (error) {
    console.error('Payments fetch error:', error);
    return [];
  }

  return payments.filter((p: PaymentWithDetails) => p.registration) as PaymentWithDetails[];
}

export async function getMyPayments(): Promise<PaymentWithDetails[]> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Pobierz dzieci
  const { data: children } = await supabase
    .from('participants')
    .select('id')
    .eq('parent_id', user.id);

  if (!children || children.length === 0) return [];

  const childIds = children.map((c) => c.id);

  // Pobierz rejestracje
  const { data: registrations } = await supabase
    .from('trip_registrations')
    .select('id')
    .in('participant_id', childIds)
    .eq('status', 'active');

  if (!registrations || registrations.length === 0) return [];

  const registrationIds = registrations.map((r) => r.id);

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
      transactions:payment_transactions (*)
    `)
    .in('registration_id', registrationIds)
    .neq('status', 'cancelled')
    .order('due_date', { ascending: true });

  if (error) {
    console.error('Payments fetch error:', error);
    return [];
  }

  return payments.filter((p: PaymentWithDetails) => p.registration) as PaymentWithDetails[];
}

export async function addPaymentTransaction(
  paymentId: string,
  amount: number,
  currency: 'PLN' | 'EUR',
  transactionDate: string,
  paymentMethod: 'cash' | 'transfer',
  notes?: string
) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'Nie jesteś zalogowany' };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return { error: 'Brak uprawnień' };
  }

  // Pobierz płatność
  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .select('*')
    .eq('id', paymentId)
    .single();

  if (paymentError || !payment) {
    return { error: 'Nie znaleziono płatności' };
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
  let newStatus = payment.status;

  if (newAmountPaid >= payment.amount) {
    newStatus = 'paid';
  } else if (newAmountPaid > 0) {
    const isOverdue = payment.due_date && new Date(payment.due_date) < new Date();
    newStatus = isOverdue ? 'partially_paid_overdue' : 'partially_paid';
  }

  const { error: updateError } = await supabase
    .from('payments')
    .update({
      amount_paid: newAmountPaid,
      status: newStatus,
      paid_at: newStatus === 'paid' ? new Date().toISOString() : null,
      payment_method_used: paymentMethod,
      updated_at: new Date().toISOString(),
    })
    .eq('id', paymentId);

  if (updateError) {
    console.error('Payment update error:', updateError);
  }

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

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'Nie jesteś zalogowany' };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return { error: 'Brak uprawnień' };
  }

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

  revalidatePath('/admin/payments');
  revalidatePath('/admin/trips');
  revalidatePath('/parent/payments');

  return { success: true };
}

export async function applyDiscount(paymentId: string, discountPercentage: number) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'Nie jesteś zalogowany' };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return { error: 'Brak uprawnień' };
  }

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

  revalidatePath('/admin/payments');
  revalidatePath('/admin/trips');
  revalidatePath('/parent/payments');

  return { success: true };
}

export async function getPaymentTransactions(paymentId: string): Promise<PaymentTransaction[]> {
  const supabase = await createClient();

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
export async function createPaymentsForRegistration(registrationId: string, tripId: string, participantId: string) {
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
      payment_method: string | null;
    }) => ({
      registration_id: registrationId,
      template_id: template.id,
      payment_type: template.payment_type,
      installment_number: template.installment_number,
      original_amount: template.amount,
      discount_percentage: 0,
      amount: template.amount,
      currency: template.currency,
      due_date: template.due_date,
      status: 'pending',
      amount_paid: 0,
    }));

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
  trip_title: string;
  trip_id: string;
  trip_departure_date: string;
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

export async function getPaymentsForParent(selectedChildId?: string): Promise<ParentPayment[]> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return [];
  }

  // Pobierz dzieci — jeśli wybrano konkretne, pobierz tylko je
  let childrenQuery = supabase
    .from('participants')
    .select('id, first_name, last_name')
    .eq('parent_id', user.id);

  if (selectedChildId) {
    childrenQuery = childrenQuery.eq('id', selectedChildId);
  }

  const { data: children } = await childrenQuery;

  if (!children || children.length === 0) return [];

  const childIds = children.map((c: { id: string }) => c.id);
  const childDataMap = new Map(children.map((c: { id: string; first_name: string; last_name: string }) => [
    c.id,
    { name: `${c.first_name} ${c.last_name}`, first_name: c.first_name, last_name: c.last_name }
  ]));

  // Pobierz rejestracje gdzie dziecko jedzie (confirmed)
  const { data: registrations, error: regError } = await supabase
    .from('trip_registrations')
    .select(`
      id,
      participant_id,
      trip_id,
      participation_status,
      trip:trips (
        id,
        title,
        departure_datetime
      )
    `)
    .in('participant_id', childIds)
    .eq('status', 'active')
    .eq('participation_status', 'confirmed');

  if (!registrations || registrations.length === 0) return [];

  const registrationIds = registrations.map((r: { id: string }) => r.id);

  // Pobierz płatności używając admin client (omija RLS)
  const supabaseAdmin = createAdminClient();
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

  // Pobierz szablony płatności żeby mieć payment_method
  const templateIds = [...new Set(
    payments
      .map((p: { template_id: string | null }) => p.template_id)
      .filter((id: string | null): id is string => !!id)
  )];

  const templateMethodMap = new Map<string, 'cash' | 'transfer' | 'both' | null>();
  if (templateIds.length > 0) {
    const { data: templates } = await supabaseAdmin
      .from('trip_payment_templates')
      .select('id, payment_method')
      .in('id', templateIds);

    (templates || []).forEach((t: { id: string; payment_method: 'cash' | 'transfer' | 'both' | null }) => {
      templateMethodMap.set(t.id, t.payment_method);
    });
  }

  // Złóż dane
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
      trip: { id: string; title: string; departure_datetime: string } | null;
    } | undefined;

    const childData = childDataMap.get(registration?.participant_id || '');

    return {
      id: payment.id,
      trip_title: registration?.trip?.title || 'Nieznany wyjazd',
      trip_id: registration?.trip_id || '',
      trip_departure_date: registration?.trip?.departure_datetime || '',
      child_name: childData?.name || 'Nieznane dziecko',
      child_first_name: childData?.first_name || '',
      child_last_name: childData?.last_name || '',
      payment_type: payment.payment_type,
      installment_number: payment.installment_number,
      amount: payment.amount,
      original_amount: payment.original_amount,
      currency: payment.currency,
      due_date: payment.due_date,
      status: payment.status,
      amount_paid: payment.amount_paid || 0,
      payment_method: payment.template_id ? (templateMethodMap.get(payment.template_id) || null) : null,
    };
  });

  return JSON.parse(JSON.stringify(result));
}

// Pobierz dane do przelewu (konta bankowe) — z wyjazdu na który dziecko jest zapisane
export async function getBankAccountsForParent(): Promise<BankAccountInfo> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return {
      bank_account_pln: '39 1240 1444 1111 0010 7170 4855',
      bank_account_eur: 'PL21 1240 1444 1978 0010 7136 2778',
    };
  }

  // Pobierz dziecko rodzica
  const { data: children } = await supabase
    .from('participants')
    .select('id')
    .eq('parent_id', user.id)
    .limit(1);

  if (!children || children.length === 0) {
    return {
      bank_account_pln: '39 1240 1444 1111 0010 7170 4855',
      bank_account_eur: 'PL21 1240 1444 1978 0010 7136 2778',
    };
  }

  // Pobierz konto z wyjazdu na który dziecko jest zapisane
  const { data: registration } = await supabase
    .from('trip_registrations')
    .select('trip:trips(bank_account_pln, bank_account_eur)')
    .eq('participant_id', children[0].id)
    .eq('participation_status', 'confirmed')
    .limit(1)
    .maybeSingle();

  const trip = registration?.trip as unknown as { bank_account_pln: string | null; bank_account_eur: string | null } | null;

  return {
    bank_account_pln: trip?.bank_account_pln || '39 1240 1444 1111 0010 7170 4855',
    bank_account_eur: trip?.bank_account_eur || 'PL21 1240 1444 1978 0010 7136 2778',
  };
}

export async function updatePaymentStatus(
  paymentId: string,
  status: 'pending' | 'paid' | 'cancelled'
) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'Nie jesteś zalogowany' };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return { error: 'Brak uprawnień' };
  }

  // Pobierz płatność
  const { data: payment } = await supabase
    .from('payments')
    .select('amount')
    .eq('id', paymentId)
    .single();

  if (!payment) {
    return { error: 'Nie znaleziono płatności' };
  }

  const updateData: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };

  // Jeśli oznaczamy jako opłacone, ustaw amount_paid i paid_at
  if (status === 'paid') {
    updateData.amount_paid = payment.amount;
    updateData.paid_at = new Date().toISOString();
    updateData.marked_by = user.id;
  } else if (status === 'pending') {
    // Jeśli cofamy do oczekującej, wyzeruj
    updateData.amount_paid = 0;
    updateData.paid_at = null;
  }

  const { error } = await supabase
    .from('payments')
    .update(updateData)
    .eq('id', paymentId);

  if (error) {
    console.error('Update payment status error:', error);
    return { error: `Nie udało się zmienić statusu: ${error.message}` };
  }

  // Wyślij e-mail potwierdzenia gdy płatność oznaczona jako opłacona
  if (status === 'paid') {
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
  }

  revalidatePath('/admin/payments');
  revalidatePath('/admin/trips');
  revalidatePath('/parent/payments');

  return { success: true };
}

export async function updatePaymentAmount(paymentId: string, newAmount: number) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'Nie jesteś zalogowany' };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return { error: 'Brak uprawnień' };
  }

  if (newAmount < 0) {
    return { error: 'Kwota nie może być ujemna' };
  }

  const { error } = await supabase
    .from('payments')
    .update({
      amount: newAmount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', paymentId);

  if (error) {
    console.error('Update payment amount error:', error);
    return { error: `Nie udało się zaktualizować kwoty: ${error.message}` };
  }

  revalidatePath('/admin/payments');
  revalidatePath('/admin/trips');
  revalidatePath('/parent/payments');

  return { success: true };
}

export async function updatePaymentNote(paymentId: string, note: string) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Nie jesteś zalogowany' };

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();

  if (profile?.role !== 'admin') return { error: 'Brak uprawnień' };

  const { error } = await supabase
    .from('payments')
    .update({ admin_notes: note || null, updated_at: new Date().toISOString() })
    .eq('id', paymentId);

  if (error) {
    console.error('Update payment note error:', error);
    return { error: `Nie udało się zapisać notatki: ${error.message}` };
  }

  revalidatePath('/admin/payments');
  revalidatePath('/admin/trips');

  return { success: true };
}
