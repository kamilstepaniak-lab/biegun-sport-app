// Pomocniki do treści formatowanej (HTML) w dokumentach.

/** Wykrywa, czy treść jest już HTML-em (a nie zwykłym tekstem). */
export function isHtmlContent(s: string): boolean {
  return /<\/?(p|br|ul|ol|li|strong|b|em|h[1-6]|div|span)\b[^>]*>/i.test(s);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Konwertuje zwykły tekst na HTML zachowując akapity i złamania linii. */
export function textToHtml(text: string): string {
  if (!text.trim()) return '';
  return text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtml(block).split('\n').join('<br>')}</p>`)
    .join('');
}

/** Zwraca treść jako HTML — przepuszcza istniejący HTML, konwertuje czysty tekst. */
export function toHtml(s: string): string {
  if (!s) return '';
  return isHtmlContent(s) ? s : textToHtml(s);
}
