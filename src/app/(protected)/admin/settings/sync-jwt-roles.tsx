'use client';

import { useState } from 'react';
import { ShieldCheck, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { syncRolesToAppMetadata } from '@/lib/actions/admin-accounts';

export function SyncJwtRolesButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ synced: number; errors: number; details: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSync() {
    if (!confirm('Zsynchronizować role JWT dla wszystkich użytkowników? Operacja zajmie kilka sekund.')) return;
    setIsLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await syncRolesToAppMetadata();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Wystąpił błąd');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Po kliknięciu każdy użytkownik otrzyma swoją rolę (<code className="bg-gray-100 px-1 rounded text-xs font-mono">admin</code> lub <code className="bg-gray-100 px-1 rounded text-xs font-mono">parent</code>) zapisaną w tokenie JWT. Wyloguj się i zaloguj ponownie po synchronizacji.
      </p>
      <button
        onClick={handleSync}
        disabled={isLoading}
        className="inline-flex items-center gap-2 px-4 py-2 bg-green-700 hover:bg-green-800 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <><Loader2 className="h-4 w-4 animate-spin" />Synchronizacja...</>
        ) : (
          <><ShieldCheck className="h-4 w-4" />Synchronizuj role JWT</>
        )}
      </button>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-600 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-2">
          <div className="flex gap-3">
            <div className="flex-1 bg-emerald-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-emerald-600">{result.synced}</p>
              <p className="text-xs text-emerald-700 mt-0.5">Zsynchronizowano</p>
            </div>
            <div className="flex-1 bg-red-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-red-600">{result.errors}</p>
              <p className="text-xs text-red-700 mt-0.5">Błędy</p>
            </div>
          </div>
          {result.errors > 0 && result.details.length > 0 && (
            <div className="text-xs text-red-600 bg-red-50 rounded-lg p-3 space-y-1">
              {result.details.map((d, i) => <p key={i}>{d}</p>)}
            </div>
          )}
          {result.errors === 0 && (
            <div className="flex items-center gap-2 text-sm text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              Gotowe! Wyloguj się i zaloguj ponownie, aby token się odświeżył.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
