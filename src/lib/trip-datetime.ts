import { format } from 'date-fns';
import { pl } from 'date-fns/locale';

/**
 * Format a trip datetime ISO string for combined display (e.g. detail pages).
 * If timeKnown is false, shows only the date (no time part).
 */
export function formatTripDatetime(
  iso: string,
  timeKnown: boolean,
  dateFormat = 'd MMMM yyyy'
): string {
  const date = new Date(iso);
  if (timeKnown) {
    return format(date, `${dateFormat}, HH:mm`, { locale: pl });
  }
  return format(date, dateFormat, { locale: pl });
}

/**
 * Short date format variant (e.g. for list views: "15 mar 2025").
 */
export function formatTripDatetimeShort(iso: string, timeKnown: boolean): string {
  return formatTripDatetime(iso, timeKnown, 'd MMM yyyy');
}
