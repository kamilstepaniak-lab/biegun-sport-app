import { createAdminClient } from '@/lib/supabase/server';
import { sendQueuedSystemEmail } from '@/lib/email';

export const EMAIL_QUEUE_BATCH_SIZE = 15;

type ClaimedEmailQueueItem = {
  id: string;
  template_id: string | null;
  trip_id: string | null;
  to_email: string;
  subject: string;
  body_html: string;
  attempt_count: number;
  max_attempts: number;
};

export type EmailQueueProcessResult = {
  claimed: number;
  sent: number;
  failed: number;
  retried: number;
  errors: string[];
};

function nextRetryDate(attemptCount: number) {
  const date = new Date();
  date.setMinutes(date.getMinutes() + Math.min(60, attemptCount * 10));
  return date.toISOString();
}

export async function processEmailQueueBatch(batchSize = EMAIL_QUEUE_BATCH_SIZE): Promise<EmailQueueProcessResult> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('claim_system_email_queue_batch', { batch_size: batchSize });

  if (error) {
    throw new Error(error.message);
  }

  const claimed = (data ?? []) as ClaimedEmailQueueItem[];
  const result: EmailQueueProcessResult = {
    claimed: claimed.length,
    sent: 0,
    failed: 0,
    retried: 0,
    errors: [],
  };

  for (const item of claimed) {
    try {
      const info = await sendQueuedSystemEmail(item.to_email, item.subject, item.body_html, {
        templateId: item.template_id ?? undefined,
        tripId: item.trip_id ?? undefined,
      });
      await supabase
        .from('system_email_queue')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          smtp_message_id: info?.messageId ?? null,
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id);
      result.sent++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const finalFailure = item.attempt_count >= item.max_attempts;

      await supabase
        .from('system_email_queue')
        .update({
          status: finalFailure ? 'failed' : 'pending',
          scheduled_at: finalFailure ? new Date().toISOString() : nextRetryDate(item.attempt_count),
          last_error: message,
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id);

      if (finalFailure) result.failed++;
      else result.retried++;
      result.errors.push(`${item.to_email}: ${message}`);
    }
  }

  return result;
}

export type EnqueueSystemEmailInput = {
  templateId?: string;
  sourceType: string;
  sourceId?: string;
  tripId?: string;
  parentId?: string;
  toEmail: string;
  recipientName?: string;
  subject: string;
  bodyHtml: string;
};

export async function enqueueSystemEmails(items: EnqueueSystemEmailInput[]) {
  if (items.length === 0) return { queued: 0 };

  const supabase = createAdminClient();
  const { error } = await supabase.from('system_email_queue').insert(
    items.map((item) => ({
      template_id: item.templateId ?? null,
      source_type: item.sourceType,
      source_id: item.sourceId ?? null,
      trip_id: item.tripId ?? null,
      parent_id: item.parentId ?? null,
      to_email: item.toEmail.trim().toLowerCase(),
      recipient_name: item.recipientName ?? null,
      subject: item.subject,
      body_html: item.bodyHtml,
      status: 'pending',
    })),
  );

  if (error) throw new Error(error.message);
  return { queued: items.length };
}
