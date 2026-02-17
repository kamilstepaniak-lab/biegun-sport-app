'use client';

import { useState } from 'react';
import { Copy, Check, Banknote } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import type { TripWithPaymentTemplates, ParticipantWithGroup } from '@/types';

interface PaymentInfoCardProps {
  trip: TripWithPaymentTemplates;
  children: ParticipantWithGroup[];
}

export function PaymentInfoCard({ trip, children }: PaymentInfoCardProps) {
  const [selectedChild, setSelectedChild] = useState<string>(children[0]?.id || '');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const currentChild = children.find(c => c.id === selectedChild);

  // Generuj tytuł przelewu
  const transferTitle = currentChild
    ? `${currentChild.first_name} ${currentChild.last_name} - ${trip.title}`
    : '';

  async function copyToClipboard(text: string, field: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast.success('Skopiowano do schowka');
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast.error('Nie udało się skopiować');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Banknote className="h-5 w-5" />
          Dane do przelewu
        </CardTitle>
        <CardDescription>
          Skopiuj dane do wykonania przelewu
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Wybór dziecka jeśli więcej niż jedno */}
        {children.length > 1 && (
          <div className="space-y-2">
            <Label>Wybierz dziecko</Label>
            <Select value={selectedChild} onValueChange={setSelectedChild}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {children.map((child) => (
                  <SelectItem key={child.id} value={child.id}>
                    {child.first_name} {child.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Tytuł przelewu */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Tytuł przelewu</Label>
          <div className="flex items-center gap-2">
            <div className="flex-1 p-3 rounded-lg bg-muted font-medium text-sm break-all">
              {transferTitle}
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => copyToClipboard(transferTitle, 'title')}
              className="shrink-0"
            >
              {copiedField === 'title' ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Numer konta PLN */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Numer konta (PLN)</Label>
          <div className="flex items-center gap-2">
            <div className="flex-1 p-3 rounded-lg bg-muted font-mono text-sm break-all">
              {trip.bank_account_pln}
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => copyToClipboard(trip.bank_account_pln, 'pln')}
              className="shrink-0"
            >
              {copiedField === 'pln' ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Numer konta EUR */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Numer konta (EUR)</Label>
          <div className="flex items-center gap-2">
            <div className="flex-1 p-3 rounded-lg bg-muted font-mono text-sm break-all">
              {trip.bank_account_eur}
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => copyToClipboard(trip.bank_account_eur, 'eur')}
              className="shrink-0"
            >
              {copiedField === 'eur' ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          W tytule przelewu podaj imię i nazwisko dziecka oraz nazwę wyjazdu.
        </p>
      </CardContent>
    </Card>
  );
}
