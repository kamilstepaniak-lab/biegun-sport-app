'use server';

import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from './auth-helpers';

export type PaymentAction =
  | 'payment_added'
  | 'marked_paid'
  | 'status_changed'
  | 'cancelled'
  | 'payment_deleted';

interface LogPaymentChangeParams {
  paymentId: string;
  userId: string;
  oldStatus: string;
  newStatus: string;
  oldAmountPaid?: number;
  newAmountPaid?: number;
  action: PaymentAction;
  note?: string;
}

/**
 * Wewnętrzna funkcja do zapisu zmiany statusu płatności.
 * Nie-eksportowana — wywoływana tylko z payments.ts i registrations.ts.
 * Błędy logowania NIE blokują głównej akcji (catch + console.error).
 */
export async function logPaymentChange(params: LogPaymentChangeParams): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from('payment_history_logs').insert({
    payment_id: params.paymentId,
    changed_by: params.userId,
    old_status: params.oldStatus,
    new_status: params.newStatus,
    old_amount_paid: params.oldAmountPaid ?? null,
    new_amount_paid: params.newAmountPaid ?? null,
    action: params.action,
    note: params.note ?? null,
  });
  if (error) {
    console.error('Payment history log error:', error);
  }
}

export interface PaymentHistoryEntry {
  id: string;
  changed_at: string;
  action: string;
  old_status: string | null;
  new_status: string;
  old_amount_paid: number | null;
  new_amount_paid: number | null;
  note: string | null;
  changed_by_name: string | null;
  changed_by_email: string | null;
  participant_name: string | null;
  trip_title: string | null;
  payment_type: string | null;
  installment_number: number | null;
  currency: string | null;
  amount: number | null;
}

export async function getPaymentHistory(limit = 300): Promise<PaymentHistoryEntry[]> {
  const { supabase, user, role } = await getAuthUser();
  if (!user || role !== 'admin') return [];

  const { data, error } = await supabase
    .from('payment_history_logs')
    .select(`
      id,
      changed_at,
      action,
      old_status,
      new_status,
      old_amount_paid,
      new_amount_paid,
      note,
      changed_by_profile:profiles!changed_by (
        first_name,
        last_name,
        email
      ),
      payment:payments!payment_id (
        payment_type,
        installment_number,
        currency,
        amount,
        registration:trip_registrations!registration_id (
          participant:participants!participant_id (
            first_name,
            last_name
          ),
          trip:trips!trip_id (
            title
          )
        )
      )
    `)
    .order('changed_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Payment history fetch error:', error);
    return [];
  }

  return (data || []).map((row: unknown) => {
    const r = row as {
      id: string;
      changed_at: string;
      action: string;
      old_status: string | null;
      new_status: string;
      old_amount_paid: number | null;
      new_amount_paid: number | null;
      note: string | null;
      changed_by_profile: { first_name: string | null; last_name: string | null; email: string | null } | Array<{ first_name: string | null; last_name: string | null; email: string | null }> | null;
      payment: {
        payment_type: string | null;
        installment_number: number | null;
        currency: string | null;
        amount: number | null;
        registration: {
          participant: { first_name: string | null; last_name: string | null } | Array<{ first_name: string | null; last_name: string | null }> | null;
          trip: { title: string | null } | Array<{ title: string | null }> | null;
        } | Array<{
          participant: { first_name: string | null; last_name: string | null } | Array<{ first_name: string | null; last_name: string | null }> | null;
          trip: { title: string | null } | Array<{ title: string | null }> | null;
        }> | null;
      } | null;
    };

    const changedBy = Array.isArray(r.changed_by_profile) ? r.changed_by_profile[0] : r.changed_by_profile;
    const payment = r.payment;
    const registration = payment?.registration
      ? (Array.isArray(payment.registration) ? payment.registration[0] : payment.registration)
      : null;
    const participant = registration?.participant
      ? (Array.isArray(registration.participant) ? registration.participant[0] : registration.participant)
      : null;
    const trip = registration?.trip
      ? (Array.isArray(registration.trip) ? registration.trip[0] : registration.trip)
      : null;

    const participantName = participant
      ? `${participant.first_name ?? ''} ${participant.last_name ?? ''}`.trim()
      : null;

    const changedByName = changedBy
      ? `${changedBy.first_name ?? ''} ${changedBy.last_name ?? ''}`.trim()
      : null;

    return {
      id: r.id,
      changed_at: r.changed_at,
      action: r.action,
      old_status: r.old_status,
      new_status: r.new_status,
      old_amount_paid: r.old_amount_paid,
      new_amount_paid: r.new_amount_paid,
      note: r.note,
      changed_by_name: changedByName || null,
      changed_by_email: changedBy?.email ?? null,
      participant_name: participantName || null,
      trip_title: trip?.title ?? null,
      payment_type: payment?.payment_type ?? null,
      installment_number: payment?.installment_number ?? null,
      currency: payment?.currency ?? null,
      amount: payment?.amount ?? null,
    };
  });
}
