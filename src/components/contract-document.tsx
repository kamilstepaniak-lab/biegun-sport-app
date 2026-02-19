import React from 'react';
import { ExternalLink, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';

interface ContractDocumentProps {
  text: string;
  /** Jeśli true — pokazuje link do OWU i info o akceptacji (dla rodzica) */
  showOwuLink?: boolean;
  contractNumber?: string | null;
  /** Timestamp akceptacji — wyświetla blok podpisu elektronicznego */
  acceptedAt?: string | null;
  /** Imię i nazwisko osoby która zaakceptowała */
  acceptedByName?: string | null;
  /** ID umowy — używany do print */
  contractId?: string;
}

/**
 * Renderuje treść umowy jako stylizowany dokument HTML.
 * Parsuje sekcje oddzielone separatorem ━━━ i renderuje je z typografią.
 */
export function ContractDocument({
  text,
  showOwuLink = false,
  contractNumber,
  acceptedAt,
  acceptedByName,
  contractId,
}: ContractDocumentProps) {
  const sections = text.split(/━+/).map((s) => s.trim()).filter(Boolean);

  return (
    <div
      id={contractId ? `contract-doc-${contractId}` : undefined}
      className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden font-[system-ui,sans-serif]"
    >
      {/* Nagłówek dokumentu */}
      <div className="bg-gradient-to-r from-purple-700 to-purple-900 px-8 py-6 text-white">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-purple-200 text-xs font-medium uppercase tracking-widest mb-1">BiegunSport</p>
            <h1 className="text-xl font-bold leading-tight">Umowa uczestnictwa</h1>
          </div>
          {contractNumber && (
            <div className="text-right shrink-0">
              <p className="text-purple-300 text-xs uppercase tracking-wide">Numer umowy</p>
              <p className="text-white font-bold text-lg">{contractNumber}</p>
            </div>
          )}
        </div>
      </div>

      {/* Treść sekcji */}
      <div className="divide-y divide-gray-100">
        {sections.map((section, idx) => (
          <ContractSection key={idx} text={section} />
        ))}
      </div>

      {/* Stopka z linkiem OWU */}
      {showOwuLink && (
        <div className="bg-blue-50 border-t border-blue-100 px-8 py-4">
          <div className="flex items-center gap-2 text-sm text-blue-700">
            <ExternalLink className="h-4 w-4 shrink-0" />
            <span>
              Ogólne Warunki Uczestnictwa (OWU) dostępne są na stronie{' '}
              <a
                href="/parent/owu"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold underline hover:text-blue-900"
              >
                biegunsport.pl/owu
              </a>
              {' '}i stanowią integralną część niniejszej umowy.
            </span>
          </div>
        </div>
      )}

      {/* Blok podpisu elektronicznego */}
      {acceptedAt && (
        <div className="bg-green-50 border-t border-green-200 px-8 py-5">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="h-4 w-4 text-green-600 shrink-0" />
            <span className="text-sm font-bold text-green-800 uppercase tracking-wide">
              Podpis elektroniczny
            </span>
          </div>
          <div className="grid grid-cols-1 gap-1.5 text-sm">
            {acceptedByName && (
              <div className="flex gap-2">
                <span className="text-gray-500 min-w-[180px] shrink-0">Opiekun:</span>
                <span className="font-medium text-gray-900">{acceptedByName}</span>
              </div>
            )}
            <div className="flex gap-2">
              <span className="text-gray-500 min-w-[180px] shrink-0">Data akceptacji:</span>
              <span className="font-medium text-gray-900">
                {format(new Date(acceptedAt), "d MMMM yyyy, HH:mm", { locale: pl })}
              </span>
            </div>
            <div className="flex gap-2">
              <span className="text-gray-500 min-w-[180px] shrink-0">Forma:</span>
              <span className="text-gray-700">Elektroniczna — akceptacja przez konto BiegunSport</span>
            </div>
          </div>
        </div>
      )}

      {/* Podpis/stopka dokumentu */}
      <div className="bg-gray-50 border-t border-gray-100 px-8 py-4">
        <p className="text-xs text-gray-400 text-center">
          BIEGUNSPORT Stepaniak &amp; Biegun sp. j. · ul. Grochowa 26C, 30-731 Kraków ·{' '}
          biuro@biegunsport.pl · www.biegunsport.pl
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

/** Pogrub kwoty (liczba + PLN/EUR) i inne ważne wyrażenia w linii tekstu */
function highlightLine(text: string): React.ReactNode {
  // Wykryj kwoty np. "500 PLN", "1 200 EUR" i pogrub
  const parts = text.split(/(\b\d[\d\s]*(?:PLN|EUR)\b)/g);
  if (parts.length === 1) return text;
  return (
    <>
      {parts.map((part, i) =>
        /\b\d[\d\s]*(?:PLN|EUR)\b/.test(part)
          ? <strong key={i} className="text-gray-900">{part}</strong>
          : part
      )}
    </>
  );
}

function ContractSection({ text }: { text: string }) {
  const lines = text.split('\n');
  const firstLine = lines[0]?.trim() ?? '';

  // Nagłówek sekcji (np. "§ 1 – Przedmiot Umowy" lub "AKCEPTACJA UMOWY")
  const isSectionHeader =
    /^§\s*\d+/.test(firstLine) ||
    firstLine === 'AKCEPTACJA UMOWY';

  // Blok informacji o wyjezdzie (sekcja §2 — zawiera tabelaryczne pary klucz: wartość)
  const isTripInfo = /^§\s*2/.test(firstLine);

  // Warunki finansowe (§3 — harmonogram płatności)
  const isFinancial = /^§\s*3/.test(firstLine);

  // Nagłówek dokumentu (pierwsza sekcja — UMOWA OBOZU...)
  const isDocumentHeader = firstLine.startsWith('UMOWA OBOZU');

  if (isDocumentHeader) {
    // Klucze które pogrubić (linie zaczynające się od tych słów)
    const boldPrefixes = ['Pan / Pani:', 'E-mail:', 'PESEL:', 'Telefon:', 'Adres', 'Uczestnika:'];
    return (
      <div className="px-8 py-6 bg-gray-50/60">
        {lines.map((line, i) => {
          const trimmed = line.trim();
          if (!trimmed) return <div key={i} className="h-3" />;
          const isBoldLine = boldPrefixes.some(p => trimmed.startsWith(p));
          // Para klucz: wartość w bloku nagłówka
          const colonIdx = trimmed.indexOf(':');
          if (colonIdx > 0 && colonIdx < 30 && isBoldLine) {
            const key = trimmed.slice(0, colonIdx).trim();
            const value = trimmed.slice(colonIdx + 1).trim();
            return (
              <p key={i} className="text-sm leading-relaxed text-gray-700">
                {key}: <strong className="text-gray-900">{value}</strong>
              </p>
            );
          }
          return (
            <p key={i} className={`text-sm leading-relaxed ${i === 0 ? 'font-bold text-base text-gray-900 mb-2' : 'text-gray-600'}`}>
              {trimmed}
            </p>
          );
        })}
      </div>
    );
  }

  if (isTripInfo) {
    // Renderuj sekcję §2 jako siatkę
    return (
      <div className="px-8 py-6">
        <h2 className="text-sm font-bold text-purple-800 uppercase tracking-wide mb-4">{firstLine}</h2>
        <div className="grid grid-cols-1 gap-2">
          {lines.slice(1).map((line, i) => {
            const trimmed = line.trim();
            if (!trimmed) return <div key={i} className="h-1" />;

            // Para klucz: wartość
            const colonIdx = trimmed.indexOf(':');
            if (colonIdx > 0 && colonIdx < 40) {
              const key = trimmed.slice(0, colonIdx).trim();
              const value = trimmed.slice(colonIdx + 1).trim();
              return (
                <div key={i} className="flex gap-2 text-sm py-1 border-b border-gray-50 last:border-0">
                  <span className="text-gray-500 min-w-[200px] shrink-0">{key}</span>
                  <span className="font-semibold text-gray-900">{highlightLine(value) || '—'}</span>
                </div>
              );
            }

            return <p key={i} className="text-sm text-gray-600">{trimmed}</p>;
          })}
        </div>
      </div>
    );
  }

  if (isFinancial) {
    // §3 Warunki finansowe — harmonogram rat
    return (
      <div className="px-8 py-6 bg-blue-50/30">
        <h2 className="text-sm font-bold text-purple-800 uppercase tracking-wide mb-4">{firstLine}</h2>
        <div className="space-y-2">
          {lines.slice(1).map((line, i) => {
            const trimmed = line.trim();
            if (!trimmed) return <div key={i} className="h-1" />;
            // Linie harmonogramu (zaczynają się od "Rata", "Karnet", "Pełna")
            const isScheduleLine = /^(Rata|Karnet|Pe.na)/.test(trimmed);
            if (isScheduleLine) {
              // Format: "Rata 1    500 PLN   termin: 15 marca 2025"
              // Podziel na część kwotową i terminową
              const terminIdx = trimmed.indexOf('termin:');
              if (terminIdx > 0) {
                const left = trimmed.slice(0, terminIdx).trim();
                const right = trimmed.slice(terminIdx).trim();
                return (
                  <div key={i} className="flex items-baseline gap-3 text-sm py-1.5 border-b border-blue-100 last:border-0">
                    <span className="text-gray-900 font-semibold min-w-[120px]">{highlightLine(left)}</span>
                    <span className="text-gray-500 text-xs">{right}</span>
                  </div>
                );
              }
              return (
                <p key={i} className="text-sm font-semibold text-gray-900">{highlightLine(trimmed)}</p>
              );
            }
            return <p key={i} className="text-sm text-gray-700 leading-relaxed">{trimmed}</p>;
          })}
        </div>
      </div>
    );
  }

  if (firstLine === 'AKCEPTACJA UMOWY') {
    return (
      <div className="px-8 py-6 bg-purple-50/40">
        <h2 className="text-sm font-bold text-purple-800 uppercase tracking-wide mb-4">
          {firstLine}
        </h2>
        <div className="space-y-1">
          {lines.slice(1).map((line, i) => {
            const trimmed = line.trim();
            if (!trimmed) return <div key={i} className="h-2" />;
            if (trimmed.startsWith('–') || trimmed.startsWith('-')) {
              return (
                <div key={i} className="flex gap-2 text-sm text-gray-700">
                  <span className="text-purple-500 shrink-0">✓</span>
                  <span>{trimmed.replace(/^[–-]\s*/, '')}</span>
                </div>
              );
            }
            // Para klucz: wartość (Organizator:, Opiekun:, etc.)
            const colonIdx = trimmed.indexOf(':');
            if (colonIdx > 0 && colonIdx < 20) {
              const key = trimmed.slice(0, colonIdx).trim();
              const value = trimmed.slice(colonIdx + 1).trim();
              return (
                <div key={i} className="flex gap-2 text-sm py-0.5">
                  <span className="text-gray-500 min-w-[100px] shrink-0">{key}:</span>
                  <span className="font-bold text-gray-900">{value}</span>
                </div>
              );
            }
            return <p key={i} className="text-sm text-gray-700">{trimmed}</p>;
          })}
        </div>
      </div>
    );
  }

  if (isSectionHeader) {
    return (
      <div className="px-8 py-6">
        <h2 className="text-sm font-bold text-purple-800 uppercase tracking-wide mb-4">{firstLine}</h2>
        <div className="space-y-2">
          {lines.slice(1).map((line, i) => {
            const trimmed = line.trim();
            if (!trimmed) return <div key={i} className="h-1" />;
            // Numerowane punkty
            if (/^\d+\./.test(trimmed)) {
              return (
                <div key={i} className="flex gap-3 text-sm text-gray-700">
                  <span className="font-medium text-gray-500 shrink-0 min-w-[1.2rem]">{trimmed.match(/^\d+/)?.[0]}.</span>
                  <span className="leading-relaxed">{trimmed.replace(/^\d+\.\s*/, '')}</span>
                </div>
              );
            }
            return <p key={i} className="text-sm text-gray-700 leading-relaxed">{trimmed}</p>;
          })}
        </div>
      </div>
    );
  }

  // Domyślnie — prosta sekcja
  return (
    <div className="px-8 py-6">
      <div className="space-y-1">
        {lines.map((line, i) => {
          const trimmed = line.trim();
          if (!trimmed) return <div key={i} className="h-2" />;
          return <p key={i} className="text-sm text-gray-700 leading-relaxed">{trimmed}</p>;
        })}
      </div>
    </div>
  );
}
