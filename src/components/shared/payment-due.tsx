import { format } from 'date-fns';
import { pl } from 'date-fns/locale';

import { resolveEffectiveDueDate, formatPaymentDueDate } from '@/lib/payment-due';
import { cn } from '@/lib/utils';

interface PaymentDueProps {
  /** Konkretna data zapisana na płatności (najwyższy priorytet). */
  paymentDueDate?: string | null;
  /** Stała data z szablonu płatności. */
  templateDueDate?: string | null;
  /** Reguła „X dni od potwierdzenia” z szablonu. */
  dueDaysFromConfirmation?: number | null;
  /** Karnet płatny „w terminie raty 1” (gdy brak konkretnej daty). */
  dueWithFirstInstallment?: boolean | null;
  /** Kiedy rodzic potwierdził udział (ISO). */
  confirmedAt?: string | null;
  /** Data wyjazdu — pozwala pokazać „w dniu wyjazdu”. */
  departureDate?: string | null;
  /** Status płatności — steruje oznaczeniem „po terminie”. */
  status?: string | null;
  className?: string;
}

/**
 * Jednolite oznaczenie terminu płatności — ten sam komponent u admina i rodzica.
 * Zawsze zwykły tekst: „do DD.MM.RRRR”, „w dniu wyjazdu” albo etykieta reguły
 * („5 dni od potwierdzenia”, „wg ustaleń”). Czerwony, gdy płatność po terminie.
 */
export function PaymentDue({
  paymentDueDate,
  templateDueDate,
  dueDaysFromConfirmation,
  dueWithFirstInstallment,
  confirmedAt,
  departureDate,
  status,
  className,
}: PaymentDueProps) {
  const resolved = resolveEffectiveDueDate({
    paymentDueDate,
    templateDueDate,
    dueDaysFromConfirmation,
    confirmedAt,
  });

  if (!resolved) {
    return (
      <span className={cn('text-gray-500', className)}>
        {formatPaymentDueDate(
          {
            due_date: templateDueDate,
            due_days_from_confirmation: dueDaysFromConfirmation,
            due_with_first_installment: dueWithFirstInstallment,
          },
          departureDate ?? undefined,
        )}
      </span>
    );
  }

  const departureDay = departureDate
    ? new Date(departureDate).toISOString().split('T')[0]
    : null;
  const text =
    departureDay && resolved === departureDay
      ? 'w dniu wyjazdu'
      : `do ${format(new Date(resolved), 'dd.MM.yyyy', { locale: pl })}`;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdue =
    status !== 'paid' && status !== 'cancelled' && new Date(resolved) < today;

  return (
    <span className={cn(overdue ? 'text-red-600 font-medium' : 'text-gray-500', className)}>
      {text}
      {overdue && ' · po terminie'}
    </span>
  );
}
