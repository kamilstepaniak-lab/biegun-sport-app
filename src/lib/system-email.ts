import {
  renderPaymentConfirmedEmail,
  renderPaymentReminderEmail,
  renderRegistrationConfirmationEmail,
  type PaymentLineItem,
  type TripEmailData,
} from '@/lib/email';
import { enqueueSystemEmails } from '@/lib/email-queue';

export async function queueRegistrationConfirmationEmail(
  to: string,
  parentFirstName: string,
  childName: string,
  trip: TripEmailData,
  payments: PaymentLineItem[] = [],
  tripId?: string,
  parentId?: string,
) {
  const rendered = await renderRegistrationConfirmationEmail(parentFirstName, childName, trip, payments);

  await enqueueSystemEmails([{
    templateId: 'registration',
    sourceType: 'registration',
    sourceId: tripId,
    tripId,
    parentId,
    toEmail: to,
    recipientName: parentFirstName || to,
    subject: rendered.subject,
    bodyHtml: rendered.bodyHtml,
  }]);
}

export async function queuePaymentConfirmedEmail(
  to: string,
  parentFirstName: string,
  childName: string,
  tripTitle: string,
  amount: number,
  currency: string,
  paymentLabel: string,
  meta?: { paymentId?: string; tripId?: string; parentId?: string },
) {
  const rendered = await renderPaymentConfirmedEmail(parentFirstName, childName, tripTitle, amount, currency, paymentLabel);

  await enqueueSystemEmails([{
    templateId: 'payment_confirmed',
    sourceType: 'payment_confirmed',
    sourceId: meta?.paymentId,
    tripId: meta?.tripId,
    parentId: meta?.parentId,
    toEmail: to,
    recipientName: parentFirstName || to,
    subject: rendered.subject,
    bodyHtml: rendered.bodyHtml,
  }]);
}

export async function queuePaymentReminderEmail(
  to: string,
  parentFirstName: string,
  childName: string,
  tripTitle: string,
  amount: number,
  currency: string,
  dueDate: string,
  paymentLabel: string,
  meta?: { paymentId?: string; tripId?: string; parentId?: string },
) {
  const rendered = await renderPaymentReminderEmail(parentFirstName, childName, tripTitle, amount, currency, dueDate, paymentLabel);

  await enqueueSystemEmails([{
    templateId: 'payment_reminder',
    sourceType: 'payment_reminder',
    sourceId: meta?.paymentId,
    tripId: meta?.tripId,
    parentId: meta?.parentId,
    toEmail: to,
    recipientName: parentFirstName || to,
    subject: rendered.subject,
    bodyHtml: rendered.bodyHtml,
  }]);
}
