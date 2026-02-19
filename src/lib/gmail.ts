/**
 * Gmail integration via Nodemailer + OAuth2
 *
 * Konfiguracja:
 * 1. Wejdź na https://console.cloud.google.com/
 * 2. Utwórz projekt i włącz Gmail API
 * 3. Utwórz dane uwierzytelniające OAuth 2.0 (typ: Web application)
 * 4. Ustaw Authorized redirect URIs: https://developers.google.com/oauthplayground
 * 5. Wejdź na https://developers.google.com/oauthplayground
 *    - Kliknij ikonę ustawień, zaznacz "Use your own OAuth credentials"
 *    - Wpisz Client ID i Client Secret
 *    - W kroku 1 znajdź i zatwierdź scope: https://mail.google.com/
 *    - W kroku 2 kliknij "Exchange authorization code for tokens"
 *    - Skopiuj Refresh Token
 * 6. Uzupełnij zmienne środowiskowe w .env.local
 *
 * Limity Gmail:
 * - Konto osobiste: 500 emaili/dzień
 * - Google Workspace: 2000 emaili/dzień
 */

import nodemailer from 'nodemailer';
import { google } from 'googleapis';

const {
  GMAIL_CLIENT_ID,
  GMAIL_CLIENT_SECRET,
  GMAIL_REFRESH_TOKEN,
  GMAIL_FROM_EMAIL,
} = process.env;

function validateConfig() {
  if (!GMAIL_CLIENT_ID) throw new Error('Brak GMAIL_CLIENT_ID w zmiennych środowiskowych');
  if (!GMAIL_CLIENT_SECRET) throw new Error('Brak GMAIL_CLIENT_SECRET w zmiennych środowiskowych');
  if (!GMAIL_REFRESH_TOKEN) throw new Error('Brak GMAIL_REFRESH_TOKEN w zmiennych środowiskowych');
  if (!GMAIL_FROM_EMAIL) throw new Error('Brak GMAIL_FROM_EMAIL w zmiennych środowiskowych');
}

async function createTransporter() {
  validateConfig();

  const oauth2Client = new google.auth.OAuth2(
    GMAIL_CLIENT_ID,
    GMAIL_CLIENT_SECRET,
    'https://developers.google.com/oauthplayground'
  );

  oauth2Client.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN });

  const { token: accessToken } = await oauth2Client.getAccessToken();

  if (!accessToken) {
    throw new Error('Nie udało się uzyskać access token z Google OAuth2');
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: GMAIL_FROM_EMAIL,
      clientId: GMAIL_CLIENT_ID,
      clientSecret: GMAIL_CLIENT_SECRET,
      refreshToken: GMAIL_REFRESH_TOKEN,
      accessToken,
    },
  });
}

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface BulkEmailResult {
  email: string;
  success: boolean;
  error?: string;
}

/**
 * Wysyła pojedynczy email przez Gmail
 */
export async function sendEmail(payload: EmailPayload): Promise<void> {
  const transporter = await createTransporter();

  await transporter.sendMail({
    from: `Biegun Sport <${GMAIL_FROM_EMAIL}>`,
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
  });
}

/**
 * Wysyła masowo emaile z rate limitingiem (max 5/sek żeby nie przekroczyć limitów Gmail)
 * Zwraca tablicę wyników dla każdego odbiorcy
 */
export async function sendBulkEmails(
  recipients: string[],
  subject: string,
  htmlBody: string,
  onProgress?: (sent: number, total: number) => void
): Promise<BulkEmailResult[]> {
  const transporter = await createTransporter();
  const results: BulkEmailResult[] = [];

  const BATCH_SIZE = 5;        // emaili na raz
  const DELAY_BETWEEN_BATCHES = 1000; // ms między partiami

  const uniqueRecipients = [...new Set(recipients)];

  for (let i = 0; i < uniqueRecipients.length; i += BATCH_SIZE) {
    const batch = uniqueRecipients.slice(i, i + BATCH_SIZE);

    await Promise.allSettled(
      batch.map(async (email) => {
        try {
          await transporter.sendMail({
            from: `Biegun Sport <${GMAIL_FROM_EMAIL}>`,
            to: email,
            subject,
            html: htmlBody,
          });
          results.push({ email, success: true });
        } catch (err) {
          const error = err instanceof Error ? err.message : 'Nieznany błąd';
          results.push({ email, success: false, error });
        }
      })
    );

    onProgress?.(Math.min(i + BATCH_SIZE, uniqueRecipients.length), uniqueRecipients.length);

    // Przerwa między partiami (pomijamy po ostatniej partii)
    if (i + BATCH_SIZE < uniqueRecipients.length) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
    }
  }

  return results;
}

/**
 * Weryfikuje konfigurację Gmail (do użycia przy starcie aplikacji lub w panelu admina)
 */
export async function verifyGmailConnection(): Promise<{ ok: boolean; error?: string }> {
  try {
    const transporter = await createTransporter();
    await transporter.verify();
    return { ok: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Nieznany błąd';
    return { ok: false, error };
  }
}
