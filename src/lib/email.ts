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

// ─── Szablony domyślne (fallback gdy brak w bazie) ───────────────────────────

const DEFAULTS = {
  welcome: {
    subject: 'Witaj w BiegunSport! 🎿',
    body_html: '<h2>Witaj, {{imie}}! 👋</h2><p>Twoje konto zostało pomyślnie utworzone. Możesz teraz dodać swoje dziecko i zapisać je na wyjazd narciarski.</p>',
  },
  registration: {
    subject: '✅ {{dziecko}} zapisany/a na: {{wyjazd}}',
    body_html: '<h2>Potwierdzenie zapisu ✅</h2><p>Cześć {{imie}},</p><p><strong>{{dziecko}}</strong> został/a pomyślnie zapisany/a na wyjazd <strong>{{wyjazd}}</strong>.</p><p>📍 {{miejsce}}</p><p>🗓️ {{data_wyjazdu}}</p>',
  },
  payment_confirmed: {
    subject: '✅ Płatność przyjęta — {{wyjazd}}',
    body_html: '<h2>Płatność potwierdzona ✅</h2><p>Cześć {{imie}},</p><p>Płatność dla <strong>{{dziecko}}</strong> została zarejestrowana.</p><p><strong>{{wyjazd}}</strong> · {{rodzaj_platnosci}}</p><p style="font-size:20px;font-weight:bold;color:#16a34a;">{{kwota}} {{waluta}} — opłacone</p>',
  },
  payment_reminder: {
    subject: '⏰ Przypomnienie o płatności — {{wyjazd}}',
    body_html: '<h2>Przypomnienie o płatności ⏰</h2><p>Cześć {{imie}},</p><p>Przypominamy o terminie płatności dla <strong>{{dziecko}}</strong>.</p><p><strong>{{wyjazd}}</strong> · {{rodzaj_platnosci}}</p><p style="font-size:20px;font-weight:bold;color:#ea580c;">{{kwota}} {{waluta}}</p><p>Termin: <strong>{{termin}}</strong></p>',
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
  tripTitle: string,
  tripDeparture: string,
  tripLocation: string,
) {
  const tpl = await getTemplate('registration') ?? DEFAULTS.registration;
  const departureFormatted = new Date(tripDeparture).toLocaleDateString('pl-PL', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const vars: Record<string, string> = {
    '{{imie}}': parentFirstName,
    '{{dziecko}}': childName,
    '{{wyjazd}}': tripTitle,
    '{{miejsce}}': tripLocation,
    '{{data_wyjazdu}}': departureFormatted,
  };
  await sendEmail(to, interpolate(tpl.subject, vars), interpolate(tpl.body_html, vars));
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
