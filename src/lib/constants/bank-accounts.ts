// Domyślne numery kont bankowych — konfigurowalne przez zmienne środowiskowe.
// Ustaw NEXT_PUBLIC_DEFAULT_BANK_ACCOUNT_PLN i NEXT_PUBLIC_DEFAULT_BANK_ACCOUNT_EUR
// w .env.local / Vercel project settings.
//
// Pusty string oznacza brak domyślnego konta — admin musi je wpisać przy
// tworzeniu wyjazdu (walidacja w `tripPaymentsSchema` wymaga niepustej wartości).

export const DEFAULT_BANK_ACCOUNT_PLN =
  process.env.NEXT_PUBLIC_DEFAULT_BANK_ACCOUNT_PLN ?? '';

export const DEFAULT_BANK_ACCOUNT_EUR =
  process.env.NEXT_PUBLIC_DEFAULT_BANK_ACCOUNT_EUR ?? '';
