import { NextResponse } from 'next/server';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

const PREDEFINED_STOPS = ['BP Pasternik', 'Orlen Opatkowice', 'BP Opatkowice', 'Ikea'];

interface ParseTripRequest {
  text: string;
  groups: { id: string; name: string }[];
}

function buildPrompt(userText: string, groups: { id: string; name: string }[]): string {
  const groupList = groups.map(g => `  - "${g.name}" (id: "${g.id}")`).join('\n');
  const today = new Date().toISOString().split('T')[0];
  const currentYear = new Date().getFullYear();

  return `Jesteś asystentem do wypełniania formularzy wyjazdów sportowych dla dzieci.
Na podstawie poniższego opisu wyjazdu, wyodrębnij dane i zwróć je jako JSON.

DOSTĘPNE GRUPY:
${groupList}

PREDEFINIOWANE PRZYSTANKI (użyj dokładnej nazwy jeśli pasuje):
${PREDEFINED_STOPS.map(s => `  - "${s}"`).join('\n')}

DZISIEJSZA DATA: ${today}

FORMAT WYJŚCIOWY (JSON):
{
  "title": "string - tytuł wyjazdu",
  "description": "string lub pusty string",
  "departure_datetime": "YYYY-MM-DDTHH:mm - data i godzina wyjazdu",
  "departure_location": "string - miejsce wyjazdu (przystanek 1)",
  "departure_stop2_datetime": "YYYY-MM-DDTHH:mm lub null - jeśli jest drugi przystanek",
  "departure_stop2_location": "string lub null",
  "return_datetime": "YYYY-MM-DDTHH:mm - data i godzina powrotu",
  "return_location": "string - miejsce powrotu (przystanek 1)",
  "return_stop2_datetime": "YYYY-MM-DDTHH:mm lub null",
  "return_stop2_location": "string lub null",
  "group_ids": ["array of matching group UUIDs"],
  "payment_templates": [
    {
      "payment_type": "installment",
      "installment_number": 1,
      "is_first_installment": true,
      "includes_season_pass": false,
      "category_name": null,
      "birth_year_from": null,
      "birth_year_to": null,
      "amount": 500,
      "currency": "PLN",
      "due_date": "YYYY-MM-DD lub null",
      "payment_method": "transfer"
    }
  ]
}

ZASADY:
1. Daty wyjazdu/powrotu: format YYYY-MM-DDTHH:mm
2. Terminy płatności (due_date): format YYYY-MM-DD
3. Dopasuj nazwy grup do dostępnych grup powyżej i użyj ich UUID. Np. "grupa 2015" → dopasuj do grupy o nazwie zawierającej "2015"
4. Jeśli ktoś mówi "w dniu wyjazdu" przy płatności, ustaw due_date na datę wyjazdu (tylko YYYY-MM-DD) i payment_method na "cash"
5. Domyślna waluta: PLN
6. Domyślna metoda płatności: "transfer"
7. Twórz osobne obiekty w payment_templates dla każdej raty
8. Rata 1 → installment_number: 1, is_first_installment: true
9. Rata 2, 3 itd. → is_first_installment: false
10. Dla "karnet" → payment_type: "season_pass"
11. NIE wymyślaj danych których nie ma w opisie — pomiń pola lub zostaw null
12. Przystanki powrotu zazwyczaj są takie same jak wyjazdu (w odwrotnej kolejności) chyba że zaznaczono inaczej
13. Jeśli rok nie jest podany, użyj ${currentYear}
14. Jeśli miejsce powrotu nie jest podane, użyj tego samego co wyjazd

OPIS WYJAZDU:
"${userText}"

Odpowiedz TYLKO poprawnym JSON-em, bez komentarzy ani markdown.`;
}

function postProcess(
  parsed: Record<string, unknown>,
  groups: { id: string; name: string }[]
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...parsed };

  // Validate group_ids — only keep IDs that exist
  if (Array.isArray(result.group_ids)) {
    const validGroupIds = new Set(groups.map(g => g.id));
    result.group_ids = (result.group_ids as string[]).filter(id => validGroupIds.has(id));
  }

  // Apply "w dniu wyjazdu" logic
  if (Array.isArray(result.payment_templates) && result.departure_datetime) {
    const departureDate = (result.departure_datetime as string).split('T')[0];
    for (const pt of result.payment_templates as Record<string, unknown>[]) {
      if (pt.due_date === departureDate && !pt.payment_method) {
        pt.payment_method = 'cash';
      }
      // Ensure payment_method defaults to 'transfer' if not set
      if (!pt.payment_method) {
        pt.payment_method = 'transfer';
      }
    }
  }

  // Default status to draft
  if (!result.status) {
    result.status = 'draft';
  }

  // Convert null stop2 fields to empty strings for form compatibility
  if (result.departure_stop2_datetime === null) result.departure_stop2_datetime = '';
  if (result.departure_stop2_location === null) result.departure_stop2_location = '';
  if (result.return_stop2_datetime === null) result.return_stop2_datetime = '';
  if (result.return_stop2_location === null) result.return_stop2_location = '';

  // Strip unknown fields
  const allowedKeys = new Set([
    'title', 'description', 'status',
    'departure_datetime', 'departure_location',
    'departure_stop2_datetime', 'departure_stop2_location',
    'return_datetime', 'return_location',
    'return_stop2_datetime', 'return_stop2_location',
    'group_ids', 'payment_templates',
    'bank_account_pln', 'bank_account_eur',
  ]);

  for (const key of Object.keys(result)) {
    if (!allowedKeys.has(key)) {
      delete result[key];
    }
  }

  return result;
}

export async function POST(request: Request) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json(
      { success: false, error: 'Brak klucza API Gemini. Skonfiguruj GEMINI_API_KEY w .env.local' },
      { status: 500 }
    );
  }

  let body: ParseTripRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Nieprawidłowe dane' }, { status: 400 });
  }

  const { text, groups } = body;

  if (!text || typeof text !== 'string' || text.trim().length < 10) {
    return NextResponse.json(
      { success: false, error: 'Opis wyjazdu jest za krótki (min. 10 znaków)' },
      { status: 400 }
    );
  }

  const prompt = buildPrompt(text.trim(), groups || []);

  try {
    const geminiResponse = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (geminiResponse.status === 429) {
      return NextResponse.json(
        { success: false, error: 'Zbyt wiele zapytań do AI. Spróbuj za chwilę.' },
        { status: 429 }
      );
    }

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      console.error('Gemini API error:', geminiResponse.status, errText);
      return NextResponse.json(
        { success: false, error: 'Błąd API Gemini' },
        { status: 502 }
      );
    }

    const geminiData = await geminiResponse.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      return NextResponse.json(
        { success: false, error: 'Brak odpowiedzi z AI' },
        { status: 502 }
      );
    }

    const parsed = JSON.parse(rawText);
    const processed = postProcess(parsed, groups || []);

    return NextResponse.json({ success: true, data: processed });
  } catch (error) {
    console.error('Parse trip AI error:', error);
    return NextResponse.json(
      { success: false, error: 'Nie udało się przetworzyć odpowiedzi AI' },
      { status: 500 }
    );
  }
}
