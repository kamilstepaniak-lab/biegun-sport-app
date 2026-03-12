'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Clock, Loader2, AlertCircle } from 'lucide-react';

interface TokenInfo {
  action: string;
  status: string;
  parentEmail: string;
  participantName: string | null;
  trip: {
    name: string;
    departure_datetime: string;
    location?: string;
  } | null;
}

interface ConfirmResult {
  success: boolean;
  action: string;
  trip: { name: string; departure_datetime: string } | null;
  isNewAccount: boolean;
  parentEmail: string;
}

type Phase = 'loading' | 'confirm' | 'done' | 'error' | 'already-used' | 'expired';

export function ConfirmTokenClient({
  token,
  actionOverride,
}: {
  token: string;
  actionOverride?: string;
}) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [result, setResult] = useState<ConfirmResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadTokenInfo();
  }, [token]);

  async function loadTokenInfo() {
    try {
      const res = await fetch(`/api/public/confirm?token=${token}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Nieprawidłowy link');
        setPhase('error');
        return;
      }

      if (data.status === 'used') {
        setPhase('already-used');
        return;
      }

      if (data.status === 'expired') {
        setPhase('expired');
        return;
      }

      setTokenInfo(data);

      // Jeśli akcja jest z URL param — wykonaj od razu
      if (actionOverride === 'confirm' || actionOverride === 'decline') {
        setPhase('confirm');
        await handleConfirm(actionOverride);
      } else {
        setPhase('confirm');
      }
    } catch {
      setError('Wystąpił błąd. Spróbuj ponownie.');
      setPhase('error');
    }
  }

  async function handleConfirm(action: string) {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/public/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.alreadyUsed) {
          setPhase('already-used');
          return;
        }
        setError(data.error || 'Wystąpił błąd');
        setPhase('error');
        return;
      }

      setResult(data);
      setPhase('done');
    } catch {
      setError('Wystąpił błąd. Spróbuj ponownie.');
      setPhase('error');
    } finally {
      setIsSubmitting(false);
    }
  }

  const tripDate = tokenInfo?.trip?.departure_datetime
    ? new Date(tokenInfo.trip.departure_datetime).toLocaleDateString('pl-PL', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '';

  return (
    <div className="min-h-screen bg-[#f8f9fb] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/logo.png" alt="BiegunSport" className="h-16 w-16 rounded-2xl object-cover mx-auto mb-3" />
          <p className="text-sm text-gray-500">BiegunSport</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-200/60 overflow-hidden p-8">

          {/* Ładowanie */}
          {phase === 'loading' && (
            <div className="text-center py-8">
              <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-gray-500">Ładowanie...</p>
            </div>
          )}

          {/* Błąd */}
          {phase === 'error' && (
            <div className="text-center py-4">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900 mb-2">Błąd</h2>
              <p className="text-sm text-gray-500">{error}</p>
            </div>
          )}

          {/* Już użyty */}
          {phase === 'already-used' && (
            <div className="text-center py-4">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900 mb-2">Link już był użyty</h2>
              <p className="text-sm text-gray-500">
                Ta akcja została już wcześniej wykonana. Zapis jest aktualny.
              </p>
            </div>
          )}

          {/* Wygasły */}
          {phase === 'expired' && (
            <div className="text-center py-4">
              <Clock className="h-12 w-12 text-orange-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900 mb-2">Link wygasł</h2>
              <p className="text-sm text-gray-500">
                Ten link jest nieaktywny. Skontaktuj się z organizatorem, aby otrzymać nowy.
              </p>
            </div>
          )}

          {/* Potwierdzenie */}
          {phase === 'confirm' && tokenInfo && !isSubmitting && (
            <div>
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-gray-900 mb-1">
                  {tokenInfo.action === 'confirm' || tokenInfo.action === 'register'
                    ? 'Potwierdzenie udziału'
                    : 'Rezygnacja z wyjazdu'}
                </h2>
                {tokenInfo.trip && (
                  <p className="text-sm text-gray-500">
                    Wyjazd: <span className="font-medium text-gray-900">{tokenInfo.trip.name}</span>
                    {tripDate && <>, {tripDate}</>}
                  </p>
                )}
              </div>

              {tokenInfo.participantName && (
                <div className="bg-blue-50 rounded-xl p-4 mb-6 text-center">
                  <p className="text-sm text-gray-500 mb-1">Uczestnik</p>
                  <p className="font-semibold text-gray-900 text-lg">{tokenInfo.participantName}</p>
                </div>
              )}

              {tokenInfo.action === 'confirm' || tokenInfo.action === 'register' ? (
                <div className="space-y-3">
                  <button
                    onClick={() => handleConfirm('confirm')}
                    className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="h-5 w-5" />
                    Tak, potwierdzam udział
                  </button>
                  <button
                    onClick={() => handleConfirm('decline')}
                    className="w-full h-12 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    <XCircle className="h-5 w-5 text-gray-400" />
                    Nie, rezygnuję
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <button
                    onClick={() => handleConfirm('decline')}
                    className="w-full h-12 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    <XCircle className="h-5 w-5" />
                    Potwierdzam rezygnację
                  </button>
                  <button
                    onClick={() => handleConfirm('confirm')}
                    className="w-full h-12 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="h-5 w-5 text-gray-400" />
                    Jednak jadę, zachowaj zapis
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Przetwarzanie */}
          {phase === 'confirm' && isSubmitting && (
            <div className="text-center py-8">
              <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-gray-500">Przetwarzanie...</p>
            </div>
          )}

          {/* Sukces */}
          {phase === 'done' && result && (
            <div className="text-center py-4">
              {result.action === 'confirm' || result.action === 'register' ? (
                <>
                  <CheckCircle className="h-14 w-14 text-green-500 mx-auto mb-4" />
                  <h2 className="text-xl font-bold text-gray-900 mb-2">Gotowe!</h2>
                  <p className="text-sm text-gray-600 mb-4">
                    Udział został potwierdzony.
                    {result.trip && (
                      <> Dziecko jest zapisane na <strong>{result.trip.name}</strong>.</>
                    )}
                  </p>
                  {result.isNewAccount && (
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-left">
                      <p className="text-sm font-medium text-blue-900 mb-1">
                        Utworzyliśmy dla Ciebie konto
                      </p>
                      <p className="text-xs text-blue-700">
                        Na adres <strong>{result.parentEmail}</strong> wyślemy dane do logowania.
                        Możesz zalogować się, aby zarządzać zapisami.
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <XCircle className="h-14 w-14 text-gray-400 mx-auto mb-4" />
                  <h2 className="text-xl font-bold text-gray-900 mb-2">Rezygnacja zapisana</h2>
                  <p className="text-sm text-gray-500">
                    Dziękujemy za informację. Zapis został anulowany.
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
