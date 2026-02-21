import nodemailer from 'nodemailer';

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

// ─── Szablony ────────────────────────────────────────────────────────────────

function baseTemplate(content: string) {
  return `
<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>BiegunSport</title>
</head>
<body style="margin:0;padding:0;background:#f8f9fb;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fb;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:#1e56d9;border-radius:16px 16px 0 0;padding:28px 32px;text-align:center;">
            <p style="margin:0;font-size:22px;font-weight:bold;color:#ffffff;letter-spacing:0.5px;">
              BiegunSport
            </p>
          </td>
        </tr>

        <!-- Content -->
        <tr>
          <td style="background:#ffffff;padding:32px;border-radius:0 0 16px 16px;">
            ${content}
            <hr style="border:none;border-top:1px solid #f0f0f0;margin:32px 0 24px;" />
            <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;line-height:1.6;">
              BiegunSport · biuro@biegunsport.pl<br/>
              Ta wiadomość została wysłana automatycznie, prosimy na nią nie odpowiadać.
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

async function sendEmail(to: string, subject: string, html: string) {
  if (!process.env.EMAIL_FROM || !process.env.EMAIL_APP_PASSWORD) {
    console.warn('Email not configured — skipping send');
    return;
  }
  try {
    await transporter.sendMail({ from: FROM, to, subject, html });
  } catch (err) {
    console.error('Email send error:', err);
  }
}

// ─── E-mail powitalny po rejestracji ─────────────────────────────────────────

export async function sendWelcomeEmail(to: string, firstName: string) {
  const html = baseTemplate(`
    <h1 style="margin:0 0 8px;font-size:24px;color:#111827;">Witaj, ${firstName}! 👋</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#4b5563;line-height:1.7;">
      Twoje konto w systemie BiegunSport zostało pomyślnie utworzone.<br/>
      Możesz teraz dodać swoje dziecko i zapisać je na wyjazd narciarski.
    </p>
    <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr>
        <td style="background:#1e56d9;border-radius:10px;padding:12px 28px;">
          <a href="https://biegun-sport-app.vercel.app/parent/children"
             style="color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none;">
            Przejdź do aplikacji →
          </a>
        </td>
      </tr>
    </table>
    <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">
      W razie pytań napisz do nas: <a href="mailto:biuro@biegunsport.pl" style="color:#1e56d9;">biuro@biegunsport.pl</a>
    </p>
  `);

  await sendEmail(to, 'Witaj w BiegunSport! 🎿', html);
}

// ─── E-mail potwierdzenia zapisu dziecka na wyjazd ───────────────────────────

export async function sendRegistrationConfirmationEmail(
  to: string,
  parentFirstName: string,
  childName: string,
  tripTitle: string,
  tripDeparture: string,
  tripLocation: string,
) {
  const departureFormatted = new Date(tripDeparture).toLocaleDateString('pl-PL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const html = baseTemplate(`
    <h1 style="margin:0 0 8px;font-size:24px;color:#111827;">Potwierdzenie zapisu ✅</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#4b5563;line-height:1.7;">
      Cześć ${parentFirstName},<br/>
      <strong>${childName}</strong> został/a pomyślnie zapisany/a na wyjazd:
    </p>

    <!-- Karta wyjazdu -->
    <table width="100%" cellpadding="0" cellspacing="0"
           style="background:#f8f9fb;border-radius:12px;padding:20px 24px;margin:0 0 24px;">
      <tr>
        <td>
          <p style="margin:0 0 4px;font-size:18px;font-weight:bold;color:#111827;">${tripTitle}</p>
          <p style="margin:0 0 8px;font-size:14px;color:#6b7280;">📍 ${tripLocation}</p>
          <p style="margin:0;font-size:14px;color:#6b7280;">🗓️ Wyjazd: ${departureFormatted}</p>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 24px;font-size:14px;color:#4b5563;line-height:1.7;">
      Szczegóły płatności oraz harmonogram rat znajdziesz w aplikacji w zakładce <strong>Płatności</strong>.
    </p>

    <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr>
        <td style="background:#1e56d9;border-radius:10px;padding:12px 28px;">
          <a href="https://biegun-sport-app.vercel.app/parent/payments"
             style="color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none;">
            Zobacz płatności →
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">
      Pytania? Napisz: <a href="mailto:biuro@biegunsport.pl" style="color:#1e56d9;">biuro@biegunsport.pl</a>
    </p>
  `);

  await sendEmail(
    to,
    `✅ ${childName} zapisany/a na: ${tripTitle}`,
    html,
  );
}

// ─── E-mail przypomnienia o płatności ────────────────────────────────────────

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
  const dueDateFormatted = new Date(dueDate).toLocaleDateString('pl-PL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const html = baseTemplate(`
    <h1 style="margin:0 0 8px;font-size:24px;color:#111827;">Przypomnienie o płatności ⏰</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#4b5563;line-height:1.7;">
      Cześć ${parentFirstName},<br/>
      przypominamy o zbliżającym się terminie płatności dla <strong>${childName}</strong>.
    </p>

    <!-- Karta płatności -->
    <table width="100%" cellpadding="0" cellspacing="0"
           style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:20px 24px;margin:0 0 24px;">
      <tr>
        <td>
          <p style="margin:0 0 4px;font-size:16px;font-weight:bold;color:#111827;">${tripTitle}</p>
          <p style="margin:0 0 8px;font-size:14px;color:#6b7280;">${paymentLabel}</p>
          <p style="margin:0 0 4px;font-size:22px;font-weight:bold;color:#ea580c;">
            ${amount.toFixed(0)} ${currency}
          </p>
          <p style="margin:0;font-size:14px;color:#6b7280;">Termin: <strong>${dueDateFormatted}</strong></p>
        </td>
      </tr>
    </table>

    <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr>
        <td style="background:#1e56d9;border-radius:10px;padding:12px 28px;">
          <a href="https://biegun-sport-app.vercel.app/parent/payments"
             style="color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none;">
            Przejdź do płatności →
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">
      Pytania? Napisz: <a href="mailto:biuro@biegunsport.pl" style="color:#1e56d9;">biuro@biegunsport.pl</a>
    </p>
  `);

  await sendEmail(
    to,
    `⏰ Przypomnienie o płatności — ${tripTitle}`,
    html,
  );
}

// ─── E-mail potwierdzenia opłacenia płatności ────────────────────────────────

export async function sendPaymentConfirmedEmail(
  to: string,
  parentFirstName: string,
  childName: string,
  tripTitle: string,
  amount: number,
  currency: string,
  paymentLabel: string,
) {
  const html = baseTemplate(`
    <h1 style="margin:0 0 8px;font-size:24px;color:#111827;">Płatność potwierdzona ✅</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#4b5563;line-height:1.7;">
      Cześć ${parentFirstName},<br/>
      płatność dla <strong>${childName}</strong> została zarejestrowana.
    </p>

    <!-- Karta płatności -->
    <table width="100%" cellpadding="0" cellspacing="0"
           style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px 24px;margin:0 0 24px;">
      <tr>
        <td>
          <p style="margin:0 0 4px;font-size:16px;font-weight:bold;color:#111827;">${tripTitle}</p>
          <p style="margin:0 0 8px;font-size:14px;color:#6b7280;">${paymentLabel}</p>
          <p style="margin:0;font-size:22px;font-weight:bold;color:#16a34a;">
            ${amount.toFixed(0)} ${currency} — opłacone
          </p>
        </td>
      </tr>
    </table>

    <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr>
        <td style="background:#1e56d9;border-radius:10px;padding:12px 28px;">
          <a href="https://biegun-sport-app.vercel.app/parent/payments"
             style="color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none;">
            Zobacz wszystkie płatności →
          </a>
        </td>
      </tr>
    </table>
  `);

  await sendEmail(
    to,
    `✅ Płatność przyjęta — ${tripTitle}`,
    html,
  );
}
