'use client';

import { useState } from 'react';
import { UserPlus, CheckCircle2, AlertCircle, Clock, Loader2, Users, KeyRound } from 'lucide-react';
import { createParentAccounts, resetParentPasswords, type ParentAccountResult } from '@/lib/actions/admin-accounts';

export function ParentAccountsManager() {
  const [isLoading, setIsLoading] = useState(false);
  const [activeAction, setActiveAction] = useState<'create' | 'reset' | null>(null);
  const [results, setResults] = useState<ParentAccountResult[] | null>(null);
  const [summary, setSummary] = useState<{ created?: number; alreadyExists?: number; reset?: number; errors: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!confirm('Czy na pewno chcesz utworzyć konta dla wszystkich rodziców z hasłem "biegunsport"?')) return;
    setIsLoading(true);
    setActiveAction('create');
    setError(null);
    setResults(null);
    setSummary(null);
    try {
      const data = await createParentAccounts();
      setResults(data.results);
      setSummary({ created: data.created, alreadyExists: data.alreadyExists, errors: data.errors });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Wystąpił nieoczekiwany błąd');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleReset() {
    if (!confirm('Czy na pewno chcesz zresetować hasła WSZYSTKICH rodziców na "biegunsport"? Tej operacji nie można cofnąć.')) return;
    setIsLoading(true);
    setActiveAction('reset');
    setError(null);
    setResults(null);
    setSummary(null);
    try {
      const data = await resetParentPasswords();
      setResults(data.results);
      setSummary({ reset: data.reset, errors: data.errors });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Wystąpił nieoczekiwany błąd');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <p className="text-sm text-gray-600">
          Domyślne hasło: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono font-semibold">biegunsport</code>
        </p>

        <div className="flex flex-wrap gap-3">
          {/* Utwórz konta */}
          <div className="flex-1 min-w-[220px] bg-gray-50 rounded-xl p-4 space-y-2">
            <p className="text-sm font-medium text-gray-800">Utwórz konta</p>
            <p className="text-xs text-gray-500">Dla rodziców którzy jeszcze nie mają konta w systemie logowania.</p>
            <button
              onClick={handleCreate}
              disabled={isLoading}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading && activeAction === 'create' ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Tworzenie...</>
              ) : (
                <><UserPlus className="h-4 w-4" />Utwórz konta</>
              )}
            </button>
          </div>

          {/* Resetuj hasła */}
          <div className="flex-1 min-w-[220px] bg-amber-50 rounded-xl p-4 space-y-2">
            <p className="text-sm font-medium text-amber-900">Resetuj hasła</p>
            <p className="text-xs text-amber-700">Ustawia hasło "biegunsport" dla wszystkich rodziców którzy już mają konto.</p>
            <button
              onClick={handleReset}
              disabled={isLoading}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading && activeAction === 'reset' ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Resetowanie...</>
              ) : (
                <><KeyRound className="h-4 w-4" />Resetuj hasła</>
              )}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-600 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {summary && (
        <div className="flex gap-3">
          {summary.created !== undefined && (
            <div className="flex-1 bg-emerald-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-emerald-600">{summary.created}</p>
              <p className="text-xs text-emerald-700 mt-0.5">Utworzono</p>
            </div>
          )}
          {summary.alreadyExists !== undefined && (
            <div className="flex-1 bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-gray-600">{summary.alreadyExists}</p>
              <p className="text-xs text-gray-500 mt-0.5">Już istniało</p>
            </div>
          )}
          {summary.reset !== undefined && (
            <div className="flex-1 bg-emerald-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-emerald-600">{summary.reset}</p>
              <p className="text-xs text-emerald-700 mt-0.5">Zresetowano</p>
            </div>
          )}
          <div className="flex-1 bg-red-50 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-red-600">{summary.errors}</p>
            <p className="text-xs text-red-700 mt-0.5">Błędy</p>
          </div>
        </div>
      )}

      {results && results.length > 0 && (
        <div className="bg-white rounded-xl ring-1 ring-gray-100 divide-y divide-gray-50 overflow-hidden max-h-80 overflow-y-auto">
          {results.map((r, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-2.5">
              {(r.status === 'created' || r.status === 'reset') && <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />}
              {r.status === 'already_exists' && <Clock className="h-4 w-4 text-gray-400 flex-shrink-0" />}
              {r.status === 'error' && <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{r.firstName} {r.lastName}</p>
                <p className="text-xs text-gray-400">{r.email}</p>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-lg flex-shrink-0 ${
                r.status === 'created' ? 'bg-emerald-100 text-emerald-700' :
                r.status === 'reset' ? 'bg-emerald-100 text-emerald-700' :
                r.status === 'already_exists' ? 'bg-gray-100 text-gray-500' :
                'bg-red-100 text-red-700'
              }`}>
                {r.status === 'created' ? 'Utworzono' :
                 r.status === 'reset' ? 'Zresetowano' :
                 r.status === 'already_exists' ? 'Już istnieje' :
                 r.error || 'Błąd'}
              </span>
            </div>
          ))}
        </div>
      )}

      {results && results.length === 0 && (
        <div className="text-center py-6 text-gray-400 text-sm flex flex-col items-center gap-2">
          <Users className="h-8 w-8" />
          Brak rodziców w bazie danych
        </div>
      )}
    </div>
  );
}
