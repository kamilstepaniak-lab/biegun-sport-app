import { format, addDays } from 'date-fns';
import { pl } from 'date-fns/locale';

interface PaymentTemplateForDue {
  due_date?: string | null;
  // due_days_from_confirmation > 0 always (Zod .positive()), so falsy check is safe
  due_days_from_confirmation?: number | null;
}

/**
 * Format the due date label for display in pricing tables and lists.
 * departureDate is the trip's departure_datetime ISO string.
 */
export function formatPaymentDueDate(
  template: PaymentTemplateForDue,
  departureDate?: string
): string {
  if (template.due_days_from_confirmation) {
    return `${template.due_days_from_confirmation} dni od potwierdzenia`;
  }
  if (!template.due_date) return 'wg ustaleń';
  if (departureDate) {
    const departureDay = new Date(departureDate).toISOString().split('T')[0];
    if (template.due_date === departureDay) return 'w dniu wyjazdu';
  }
  return `do ${format(new Date(template.due_date), 'd.MM.yyyy', { locale: pl })}`;
}

/**
 * Calculate the actual due date for a "days from confirmation" payment.
 * Returns null if confirmed_at is missing (parent hasn't confirmed yet).
 */
export function calcConfirmationDueDate(
  dueDaysFromConfirmation: number,
  confirmedAt: string | null | undefined
): Date | null {
  if (!confirmedAt) return null;
  return addDays(new Date(confirmedAt), dueDaysFromConfirmation);
}

/**
 * Check if a "days from confirmation" payment deadline has passed.
 */
export function isConfirmationDeadlineOverdue(
  dueDaysFromConfirmation: number,
  confirmedAt: string | null | undefined
): boolean {
  const dueDate = calcConfirmationDueDate(dueDaysFromConfirmation, confirmedAt);
  if (!dueDate) return false;
  return new Date() > dueDate;
}
