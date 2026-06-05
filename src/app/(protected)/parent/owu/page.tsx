import { ArrowLeft, FileCheck2 } from 'lucide-react';
import Link from 'next/link';

import { ParentPageHeader } from '@/components/parent/parent-page-header';
import { OWU_TEXT } from '@/lib/contract-template';

export const metadata = {
  title: 'Ogólne Warunki Uczestnictwa — BiegunSport',
};

export default function OwuPage() {
  const sections = OWU_TEXT.split(/━+/).map((s) => s.trim()).filter(Boolean);

  return (
    <div className="space-y-6">
      <ParentPageHeader
        icon={FileCheck2}
        title="Ogólne Warunki Uczestnictwa"
        description="Regulamin udziału w zajęciach i wyjazdach BiegunSport."
        note="Znajdziesz tu zasady rezygnacji, płatności i bezpieczeństwa."
      >
        <Link
          href="/parent/contracts"
          className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Powrót do umów
        </Link>
      </ParentPageHeader>

      {/* Dokument OWU */}
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Sekcje OWU */}
        <div className="divide-y divide-gray-100">
          {sections.map((section, idx) => (
            <OwuSection key={idx} text={section} isFirst={idx === 0} />
          ))}
        </div>

        {/* Stopka */}
        <div className="bg-gray-50 border-t border-gray-100 px-8 py-4">
          <p className="text-xs text-gray-400 text-center">
            BIEGUNSPORT Stepaniak &amp; Biegun sp. j. · ul. Grochowa 26C, 30-731 Kraków ·{' '}
            biuro@biegunsport.pl · www.biegunsport.pl
          </p>
        </div>
      </div>
    </div>
  );
}

function OwuSection({ text, isFirst }: { text: string; isFirst: boolean }) {
  const lines = text.split('\n');
  const firstLine = lines[0]?.trim() ?? '';
  const isSectionHeader = /^§\s*\d+/.test(firstLine);

  // Pierwsza sekcja — nagłówek dokumentu z datą i organizatorem
  if (isFirst) {
    return (
      <div className="px-8 py-6 bg-gray-50/60">
        {lines.map((line, i) => {
          const trimmed = line.trim();
          if (!trimmed) return <div key={i} className="h-3" />;
          return (
            <p
              key={i}
              className={`text-sm leading-relaxed ${
                i === 0
                  ? 'font-bold text-base text-gray-900 mb-2'
                  : 'text-gray-600'
              }`}
            >
              {trimmed}
            </p>
          );
        })}
      </div>
    );
  }

  if (isSectionHeader) {
    return (
      <div className="px-8 py-6">
        <h2 className="text-sm font-bold text-blue-800 uppercase tracking-wide mb-4">{firstLine}</h2>
        <div className="space-y-2">
          {lines.slice(1).map((line, i) => {
            const trimmed = line.trim();
            if (!trimmed) return <div key={i} className="h-1" />;
            // Numerowane punkty
            if (/^\d+\./.test(trimmed)) {
              return (
                <div key={i} className="flex gap-3 text-sm text-gray-700">
                  <span className="font-medium text-gray-500 shrink-0 min-w-[1.2rem]">
                    {trimmed.match(/^\d+/)?.[0]}.
                  </span>
                  <span className="leading-relaxed">{trimmed.replace(/^\d+\.\s*/, '')}</span>
                </div>
              );
            }
            // Podpunkty literowe a) b) c)
            if (/^[a-z]\)/.test(trimmed)) {
              return (
                <div key={i} className="flex gap-3 text-sm text-gray-600 pl-6">
                  <span className="font-medium text-gray-400 shrink-0">{trimmed.slice(0, 2)}</span>
                  <span className="leading-relaxed">{trimmed.slice(2).trim()}</span>
                </div>
              );
            }
            return (
              <p key={i} className="text-sm text-gray-700 leading-relaxed">
                {trimmed}
              </p>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="px-8 py-6">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-2" />;
        return (
          <p key={i} className="text-sm text-gray-700 leading-relaxed">
            {trimmed}
          </p>
        );
      })}
    </div>
  );
}
