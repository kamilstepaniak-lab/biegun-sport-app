// Konwertuj string datetime-local (czas lokalny PL) → ISO UTC.
// new Date(y, m-1, d, h, min) z osobnymi arg. jest ZAWSZE lokalny (ECMAScript spec).
export function localToISO(val: string): string {
  if (!val) return val;
  const [datePart, timePart] = val.split('T');
  if (!datePart || !timePart) return val;
  const [y, m, d] = datePart.split('-').map(Number);
  const [h, min] = timePart.split(':').map(Number);
  if (isNaN(y) || isNaN(m) || isNaN(d) || isNaN(h) || isNaN(min)) return val;
  const local = new Date(y, m - 1, d, h, min, 0, 0);
  return isNaN(local.getTime()) ? val : local.toISOString();
}

// Konwertuj datę ISO na format datetime-local (YYYY-MM-DDTHH:mm)
// Używamy Intl.DateTimeFormat z jawną strefą Europe/Warsaw — działa poprawnie
// zarówno na serwerze (UTC) jak i w przeglądarce, bez błędów hydratacji.
export function formatDateTimeLocal(isoDate: string | null | undefined): string {
  if (!isoDate) return '';
  try {
    const date = new Date(isoDate);
    if (isNaN(date.getTime())) return '';

    const parts = new Intl.DateTimeFormat('pl-PL', {
      timeZone: 'Europe/Warsaw',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(date);

    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
    return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
  } catch {
    return '';
  }
}
