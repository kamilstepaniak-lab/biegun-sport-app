'use client';

import { useState } from 'react';
import { Copy, Check, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PanelCard, SectionTitle } from '@/components/shared';
import type { SectionProps } from './types';

interface Props extends SectionProps {
  tripId?: string;
}

export function WordpressSection({ formData, updateFormData, tripId }: Props) {
  const [copiedField, setCopiedField] = useState<'id' | 'embed' | null>(null);

  const appOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const embedSnippet = tripId
    ? `<!-- Formularz zapisow BiegunSport — wyjazd ${tripId} -->\n<div data-bs-trip="${tripId}"></div>\n<script src="${appOrigin}/embed/widget.js" async></script>`
    : '';

  async function copy(value: string, which: 'id' | 'embed') {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(which);
      setTimeout(() => setCopiedField(null), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <PanelCard className="p-5 sm:p-6 space-y-5">
      <SectionTitle
        icon={Globe}
        title="Zapisy zewnętrzne (WordPress)"
        description="Połączenie z formularzem „Zapisz dziecko” na stronie BiegunSport."
      />
      <div className="space-y-5">
        {tripId ? (
          <div>
            <label className="text-xs font-medium text-slate-500">
              ID wyjazdu (referencja techniczna, np. do logów / supportu)
            </label>
            <div className="mt-1 flex items-center gap-2">
              <input
                readOnly
                value={tripId}
                onFocus={(e) => e.currentTarget.select()}
                className="flex-1 rounded border border-input bg-slate-50 px-2 py-1.5 font-mono text-xs"
              />
              <Button type="button" variant="outline" size="sm" onClick={() => copy(tripId, 'id')}>
                {copiedField === 'id' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                <span className="ml-1">{copiedField === 'id' ? 'Skopiowano' : 'Kopiuj'}</span>
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            ID wyjazdu pojawi się po jego zapisaniu.
          </p>
        )}

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={formData.registration_form_enabled}
            onChange={(e) => updateFormData({ registration_form_enabled: e.target.checked })}
          />
          <span>
            <span className="font-medium">Przyjmuj zgłoszenia z formularza WP</span>
            <span className="block text-xs text-slate-500">
              Gdy zaznaczone, publiczne API akceptuje zgłoszenia dzieci na ten wyjazd. Zgłoszenia
              trafiają do moderacji w sekcji &bdquo;Zgłoszenia&rdquo;. Domyślnie wyłączone.
            </span>
          </span>
        </label>

        {tripId && (
          <div>
            <label className="text-xs font-medium text-slate-500">
              Kod do wklejenia w stronę WordPress (pod opisem wyjazdu)
            </label>
            <div className="mt-1 flex items-start gap-2">
              <textarea
                readOnly
                value={embedSnippet}
                onFocus={(e) => e.currentTarget.select()}
                rows={3}
                className="flex-1 rounded border border-input bg-slate-50 px-2 py-1.5 font-mono text-[11px] leading-tight"
              />
              <Button type="button" variant="outline" size="sm" onClick={() => copy(embedSnippet, 'embed')}>
                {copiedField === 'embed' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                <span className="ml-1">{copiedField === 'embed' ? 'Skopiowano' : 'Kopiuj'}</span>
              </Button>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
              Wklej w bloku &bdquo;HTML niestandardowy&rdquo; (Gutenberg) lub w edytorze HTML wpisu wyjazdu.
              Formularz załaduje się automatycznie. Działa tylko na domenach, które admin dopisał do whitelisty
              (zmienna <code className="font-mono text-[10px]">WIDGET_ALLOWED_ORIGINS</code>).
            </p>
          </div>
        )}
      </div>
    </PanelCard>
  );
}
