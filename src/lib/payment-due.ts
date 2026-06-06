import { format, addDays } from 'date-fns';
import { pl } from 'date-fns/locale';

interface PaymentTemplateForDue {
  due_date?: string | null;
  // due_days_from_confirmation > 0 always (Zod .positive()), so falsy check is safe
  due_days_from_confirmation?: number | null;
  // Karnet płatny „w terminie raty 1" — gdy nie znamy jeszcze konkretnej daty
  due_with_first_installment?: boolean | null;
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
  if (template.due_with_first_installment) return 'w terminie raty 1';
  if (!template.due_date) return 'wg ustaleń';
  if (departureDate) {
    const departureDay = new Date(departureDate).toISOString().split('T')[0];
    if (template.due_date === departureDay) return 'w dniu wyjazdu';
  }
  return `do ${format(new Date(template.due_date), 'd.MM.yyyy', { locale: pl })}`;
}

interface ResolveDueDateInput {
  /** Concrete date already stored on the payment row (highest priority). */
  paymentDueDate?: string | null;
  /** Fixed date set on the payment template. */
  templateDueDate?: string | null;
  /** "X days from confirmation" rule from the template. */
  dueDaysFromConfirmation?: number | null;
  /** When the parent confirmed participation (ISO string). */
  confirmedAt?: string | null;
}

/**
 * Single source of truth for the effective payment deadline.
 * Returns a concrete `yyyy-MM-dd` date, or null when the deadline cannot
 * yet be determined (e.g. "days from confirmation" but parent hasn't confirmed).
 *
 * Every place that needs a concrete due date — admin, parent, server actions —
 * MUST go through this function so the value is identical everywhere.
 */
export function resolveEffectiveDueDate(input: ResolveDueDateInput): string | null {
  if (input.paymentDueDate) return input.paymentDueDate;
  if (input.templateDueDate) return input.templateDueDate;
  if (input.dueDaysFromConfirmation && input.confirmedAt) {
    return format(
      addDays(new Date(input.confirmedAt), input.dueDaysFromConfirmation),
      'yyyy-MM-dd'
    );
  }
  return null;
}
