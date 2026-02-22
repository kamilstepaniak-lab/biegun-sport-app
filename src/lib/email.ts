import nodemailer from 'nodemailer';
import { createAdminClient } from '@/lib/supabase/server';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_FROM,
    pass: process.env.EMAIL_APP_PASSWORD,
  },
});

const FROM = `BiegunSport <${process.env.EMAIL_FROM}>`;

// ─── Pobieranie szablonu z bazy ───────────────────────────────────────────────

async function getTemplate(id: string): Promise<{ subject: string; body_html: string } | null> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from('email_templates')
      .select('subject, body_html')
      .eq('id', id)
      .single();
    return data;
  } catch {
    return null;
  }
}

// ─── Podstawianie zmiennych ───────────────────────────────────────────────────

function interpolate(text: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (result, [key, value]) => result.replaceAll(key, value),
    text
  );
}

// ─── Wrapper HTML ─────────────────────────────────────────────────────────────

function wrapInTemplate(content: string) {
  return `
<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#f8f9fb;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fb;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr>
          <td style="background:#1e56d9;border-radius:16px 16px 0 0;padding:24px 32px;text-align:center;">
            <p style="margin:0;font-size:22px;font-weight:bold;color:#ffffff;">BiegunSport</p>
          </td>
        </tr>
        <tr>
          <td style="background:#ffffff;padding:32px;border-radius:0 0 16px 16px;line-height:1.6;color:#374151;">
            ${content}
            <hr style="border:none;border-top:1px solid #f0f0f0;margin:32px 0 24px;" />
            <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
              BiegunSport · biuro@biegunsport.pl<br/>
              Ta wiadomość została wysłana automatycznie.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Wysyłka ─────────────────────────────────────────────────────────────────

/** Publiczna funkcja wysyłki — dla własnego HTML z wrapperem BiegunSport */
export async function sendTripEmail(to: string, subject: string, bodyHtml: string) {
  await sendEmail(to, subject, bodyHtml);
}

async function sendEmail(to: string, subject: string, bodyHtml: string) {
  if (!process.env.EMAIL_FROM || !process.env.EMAIL_APP_PASSWORD) {
    console.warn('Email not configured — skipping send');
    return;
  }
  try {
    await transporter.sendMail({
      from: FROM,
      to,
      subject,
      html: wrapInTemplate(bodyHtml),
    });
  } catch (err) {
    console.error('Email send error:', err);
  }
}

// ─── Typy dla maila z danymi wyjazdu ─────────────────────────────────────────

export interface TripEmailData {
  title: string;
  description?: string | null;
  location?: string | null;
  departure_datetime: string;
  departure_location: string;
  departure_stop2_datetime?: string | null;
  departure_stop2_location?: string | null;
  return_datetime: string;
  return_location: string;
  return_stop2_datetime?: string | null;
  return_stop2_location?: string | null;
  bank_account_pln?: string | null;
  bank_account_eur?: string | null;
}

export interface PaymentLineItem {
  payment_type: string;
  installment_number?: number | null;
  amount: number;
  currency: string;
  due_date?: string | null;
  payment_method?: string | null;
}

// ─── Blok HTML z detalami wyjazdu ────────────────────────────────────────────

function buildTripDetailsHtml(trip: TripEmailData, payments: PaymentLineItem[]): string {
  const fmt = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('pl-PL', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  const fmtTime = (dateStr: string) =>
    new Date(dateStr).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });

  let html = '';

  if (trip.description) {
    html += `<p style="color:#6b7280;font-size:14px;margin:0 0 16px;">${trip.description}</p>`;
  }

  // TERMINY
  html += `<table style="width:100%;border-collapse:collapse;border-top:2px solid #e5e7eb;margin-top:20px;">`;
  html += `<tr><td colspan="2" style="padding:16px 0 10px;font-size:15px;font-weight:700;color:#111827;">📅 TERMINY</td></tr>`;

  html += `<tr><td style="padding:4px 16px 4px 0;color:#6b7280;font-size:13px;white-space:nowrap;vertical-align:top;">📅 Wyjazd</td><td style="padding:4px 0;font-size:14px;font-weight:600;color:#111827;">${fmt(trip.departure_datetime)}</td></tr>`;
  html += `<tr><td style="padding:2px 16px 2px 0;color:#6b7280;font-size:13px;white-space:nowrap;">📍 ${fmtTime(trip.departure_datetime)}</td><td style="padding:2px 0;font-size:14px;">${trip.departure_location}</td></tr>`;

  if (trip.departure_stop2_datetime && trip.departure_stop2_location) {
    html += `<tr><td style="padding:2px 16px 2px 0;color:#6b7280;font-size:13px;white-space:nowrap;">📍 ${fmtTime(trip.departure_stop2_datetime)}</td><td style="padding:2px 0;font-size:14px;">${trip.departure_stop2_location}</td></tr>`;
  }

  html += `<tr><td style="padding:12px 16px 4px 0;color:#6b7280;font-size:13px;white-space:nowrap;vertical-align:top;">📅 Powrót</td><td style="padding:12px 0 4px;font-size:14px;font-weight:600;color:#111827;">${fmt(trip.return_datetime)}</td></tr>`;
  html += `<tr><td style="padding:2px 16px 2px 0;color:#6b7280;font-size:13px;white-space:nowrap;">📍 ${fmtTime(trip.return_datetime)}</td><td style="padding:2px 0;font-size:14px;">${trip.return_location}</td></tr>`;

  if (trip.return_stop2_datetime && trip.return_stop2_location) {
    html += `<tr><td style="padding:2px 16px 2px 0;color:#6b7280;font-size:13px;white-space:nowrap;">📍 ${fmtTime(trip.return_stop2_datetime)}</td><td style="padding:2px 0;font-size:14px;">${trip.return_stop2_location}</td></tr>`;
  }

  html += `</table>`;

  // PŁATNOŚCI
  if (payments.length > 0) {
    html += `<table style="width:100%;border-collapse:collapse;border-top:2px solid #e5e7eb;margin-top:20px;">`;
    html += `<tr><td colspan="2" style="padding:16px 0 10px;font-size:15px;font-weight:700;color:#111827;">💰 PŁATNOŚCI</td></tr>`;

    for (const p of payments) {
      const label = p.payment_type === 'season_pass'
        ? 'Karnet'
        : `Rata ${p.installment_number ?? ''}`.trim();
      const method = p.payment_method === 'cash' ? 'gotówka'
        : p.payment_method === 'transfer' ? 'przelew'
        : 'gotówka lub przelew';
      const dueStr = p.due_date
        ? ` · termin: ${new Date(p.due_date).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })}`
        : '';
      html += `<tr><td colspan="2" style="padding:3px 0;font-size:14px;">• <strong>${label}:</strong> ${p.amount.toFixed(0)} ${p.currency} (${method})${dueStr}</td></tr>`;
    }

    html += `<tr><td colspan="2" style="padding:12px 0 4px;">`;
    if (trip.bank_account_pln) {
      html += `<p style="margin:4px 0;font-size:13px;color:#374151;">🏦 Konto PLN: <span style="font-family:monospace;">${trip.bank_account_pln}</span></p>`;
    }
    if (trip.bank_account_eur) {
      html += `<p style="margin:4px 0;font-size:13px;color:#374151;">🏦 Konto EUR: <span style="font-family:monospace;">${trip.bank_account_eur}</span></p>`;
    }
    html += `<p style="margin:10px 0 0;font-size:13px;color:#6b7280;">W tytule przelewu proszę podać: <strong>imię i nazwisko dziecka + nazwa wyjazdu</strong></p>`;
    html += `</td></tr></table>`;
  }

  return html;
}

// ─── Szablony domyślne (fallback gdy brak w bazie) ───────────────────────────

const DEFAULTS = {
  welcome: {
    subject: 'Witaj w BiegunSport! 🎿',
    body_html: '<h2>Witaj, {{imie}}! 👋</h2><p>Twoje konto zostało pomyślnie utworzone. Możesz teraz dodać swoje dziecko i zapisać je na wyjazd narciarski.</p>',
  },
  registration: {
    subject: '{{wyjazd}} – informacja o wyjeździe',
    body_html: '<h2>Potwierdzenie zapisu ✅</h2><p>Cześć {{imie}},</p><p><strong>{{dziecko}}</strong> został/a pomyślnie zapisany/a na wyjazd <strong>{{wyjazd}}</strong>.</p>{{szczegoly_wyjazdu}}',
  },
  payment_confirmed: {
    subject: '✅ Płatność przyjęta — {{wyjazd}}',
    body_html: '<h2>Płatność potwierdzona ✅</h2><p>Cześć {{imie}},</p><p>Płatność dla <strong>{{dziecko}}</strong> została zarejestrowana.</p><p><strong>{{wyjazd}}</strong> · {{rodzaj_platnosci}}</p><p style="font-size:20px;font-weight:bold;color:#16a34a;">{{kwota}} {{waluta}} — opłacone</p>',
  },
  payment_reminder: {
    subject: '⏰ Przypomnienie o płatności — {{wyjazd}}',
    body_html: '<h2>Przypomnienie o płatności ⏰</h2><p>Cześć {{imie}},</p><p>Przypominamy o terminie płatności dla <strong>{{dziecko}}</strong>.</p><p><strong>{{wyjazd}}</strong> · {{rodzaj_platnosci}}</p><p style="font-size:20px;font-weight:bold;color:#ea580c;">{{kwota}} {{waluta}}</p><p>Termin: <strong>{{termin}}</strong></p>',
  },
  trip_info: {
    subject: '{{wyjazd}} – informacja o wyjeździe',
    body_html: '<h2>Informacja o wyjeździe 🏔️</h2><p>Szanowni Rodzice,</p><p>Przekazujemy informacje o planowanym wyjeździe <strong>{{wyjazd}}</strong>.</p>{{szczegoly_wyjazdu}}<p>W razie pytań prosimy o kontakt.</p><p>Pozdrawiamy,<br><strong>Zespół BiegunSport</strong></p>',
  },
};

// ─── Publiczne funkcje wysyłki ────────────────────────────────────────────────

export async function sendWelcomeEmail(to: string, firstName: string) {
  const tpl = await getTemplate('welcome') ?? DEFAULTS.welcome;
  const vars = { '{{imie}}': firstName };
  await sendEmail(to, interpolate(tpl.subject, vars), interpolate(tpl.body_html, vars));
}

export async function sendRegistrationConfirmationEmail(
  to: string,
  parentFirstName: string,
  childName: string,
  trip: TripEmailData,
  payments: PaymentLineItem[] = [],
) {
  const tpl = await getTemplate('registration') ?? DEFAULTS.registration;
  const tripDetailsHtml = buildTripDetailsHtml(trip, payments);
  const vars: Record<string, string> = {
    '{{imie}}': parentFirstName,
    '{{dziecko}}': childName,
    '{{wyjazd}}': trip.title,
    '{{miejsce}}': trip.location || '',
    '{{data_wyjazdu}}': new Date(trip.departure_datetime).toLocaleDateString('pl-PL', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    }),
    '{{szczegoly_wyjazdu}}': tripDetailsHtml,
  };
  let bodyHtml = interpolate(tpl.body_html, vars);
  // Dołącz szczegóły jeśli szablon nie zawiera placeholdera
  if (!tpl.body_html.includes('{{szczegoly_wyjazdu}}')) {
    bodyHtml += tripDetailsHtml;
  }
  await sendEmail(to, interpolate(tpl.subject, vars), bodyHtml);
}

export async function sendPaymentConfirmedEmail(
  to: string,
  parentFirstName: string,
  childName: string,
  tripTitle: string,
  amount: number,
  currency: string,
  paymentLabel: string,
) {
  const tpl = await getTemplate('payment_confirmed') ?? DEFAULTS.payment_confirmed;
  const vars: Record<string, string> = {
    '{{imie}}': parentFirstName,
    '{{dziecko}}': childName,
    '{{wyjazd}}': tripTitle,
    '{{rodzaj_platnosci}}': paymentLabel,
    '{{kwota}}': amount.toFixed(0),
    '{{waluta}}': currency,
  };
  await sendEmail(to, interpolate(tpl.subject, vars), interpolate(tpl.body_html, vars));
}

export async function sendPaymentReminderEmail(
  to: string,
  parentFirstName: string,
  childName: string,
  tripTitle: string,
  amount: number,
  currency: string,
  dueDate: string,
  paymentLabel: string,
) {
  const tpl = await getTemplate('payment_reminder') ?? DEFAULTS.payment_reminder;
  const dueDateFormatted = new Date(dueDate).toLocaleDateString('pl-PL', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
  const vars: Record<string, string> = {
    '{{imie}}': parentFirstName,
    '{{dziecko}}': childName,
    '{{wyjazd}}': tripTitle,
    '{{rodzaj_platnosci}}': paymentLabel,
    '{{kwota}}': amount.toFixed(0),
    '{{waluta}}': currency,
    '{{termin}}': dueDateFormatted,
  };
  await sendEmail(to, interpolate(tpl.subject, vars), interpolate(tpl.body_html, vars));
}
