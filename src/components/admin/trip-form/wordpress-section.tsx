'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { SectionProps } from './types';

interface Props extends SectionProps {
  tripId?: string;
}

export function WordpressSection({ formData, updateFormData, tripId }: Props) {
  const [copied, setCopied] = useState(false);

  async function copyId() {
    if (!tripId) return;
    try {
      await navigator.clipboard.writeText(tripId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Zapisy zewnętrzne (WordPress)</CardTitle>
        <CardDescription>
          Połączenie z formularzem &bdquo;Zapisz dziecko&rdquo; na stronie BiegunSport.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {tripId ? (
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              ID wyjazdu (wklej w pole &bdquo;ID wyjazdu w systemie&rdquo; przy wpisie WP)
            </label>
            <div className="mt-1 flex items-center gap-2">
              <input
                readOnly
                value={tripId}
                onFocus={(e) => e.currentTarget.select()}
                className="flex-1 rounded border border-input bg-muted px-2 py-1.5 font-mono text-xs"
              />
              <Button type="button" variant="outline" size="sm" onClick={copyId}>
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                <span className="ml-1">{copied ? 'Skopiowano' : 'Kopiuj'}</span>
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
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
            <span className="block text-xs text-muted-foreground">
              Gdy zaznaczone, publiczne API akceptuje zgłoszenia dzieci na ten wyjazd. Zgłoszenia
              trafiają do moderacji w sekcji &bdquo;Zgłoszenia&rdquo;. Domyślnie wyłączone.
            </span>
          </span>
        </label>
      </CardContent>
    </Card>
  );
}
