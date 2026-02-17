'use client';

import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

import type { Group } from '@/types';
import type { TripFormData } from './index';

interface StepSummaryProps {
  data: TripFormData;
  groups: Group[];
  onPrev: () => void;
  onSubmit: (saveAsDraft: boolean) => void;
  isSubmitting: boolean;
  mode: 'create' | 'edit';
}

export function StepSummary({ data, groups, onPrev, onSubmit, isSubmitting, mode }: StepSummaryProps) {
  const selectedGroups = groups.filter((g) => data.group_ids.includes(g.id));

  const formatDateTime = (dateString: string) => {
    if (!dateString) return '-';
    return format(new Date(dateString), "d MMMM yyyy, HH:mm", { locale: pl });
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return format(new Date(dateString), "d MMMM yyyy", { locale: pl });
  };

  return (
    <div className="space-y-6">
      {/* Podstawowe informacje */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Podstawowe informacje</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tytuł:</span>
            <span className="font-medium">{data.title}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status:</span>
            <Badge variant={data.status === 'published' ? 'default' : 'secondary'}>
              {data.status === 'published' ? 'Opublikowany' : 'Szkic'}
            </Badge>
          </div>
          {data.description && (
            <div>
              <span className="text-muted-foreground">Opis:</span>
              <p className="mt-1">{data.description}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Terminy */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Terminy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <span className="text-muted-foreground">Wyjazd:</span>
            <p className="font-medium">{formatDateTime(data.departure_datetime)}</p>
            <p className="text-sm text-muted-foreground">{data.departure_location}</p>
          </div>
          <Separator />
          <div>
            <span className="text-muted-foreground">Powrót:</span>
            <p className="font-medium">{formatDateTime(data.return_datetime)}</p>
            <p className="text-sm text-muted-foreground">{data.return_location}</p>
          </div>
        </CardContent>
      </Card>

      {/* Grupy */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Grupy</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {selectedGroups.map((group) => (
              <Badge key={group.id} variant="outline">
                {group.name}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Płatności */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Płatności ({data.payment_templates.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.payment_templates.map((payment, index) => (
            <div key={index} className="rounded-lg border p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">
                  {payment.payment_type === 'installment'
                    ? `Rata ${payment.installment_number}`
                    : `Karnet ${payment.category_name || ''}`}
                </span>
                <span className="font-bold">
                  {payment.amount.toLocaleString('pl-PL')} {payment.currency}
                </span>
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                {payment.payment_type === 'installment' && (
                  <>
                    {payment.is_first_installment && (
                      <p>To jest rata 1 {payment.includes_season_pass && '(z karnetem)'}</p>
                    )}
                  </>
                )}
                {payment.payment_type === 'season_pass' && (
                  <p>Roczniki: {payment.birth_year_from} - {payment.birth_year_to}</p>
                )}
                <p>Termin: {formatDate(payment.due_date || null)}</p>
                <p>Forma: {
                  payment.payment_method === 'both' ? 'Gotówka lub przelew' :
                  payment.payment_method === 'cash' ? 'Gotówka' : 'Przelew'
                }</p>
              </div>
            </div>
          ))}

          <Separator />

          <div className="space-y-2">
            <p className="text-sm">
              <span className="text-muted-foreground">Konto PLN:</span>{' '}
              <span className="font-mono">{data.bank_account_pln}</span>
            </p>
            <p className="text-sm">
              <span className="text-muted-foreground">Konto EUR:</span>{' '}
              <span className="font-mono">{data.bank_account_eur}</span>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Przyciski */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <Button variant="outline" onClick={onPrev} disabled={isSubmitting}>
          Wstecz
        </Button>
        <div className="flex gap-2">
          {data.status === 'published' && (
            <Button
              variant="outline"
              onClick={() => onSubmit(true)}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Zapisywanie...
                </>
              ) : (
                'Zapisz jako szkic'
              )}
            </Button>
          )}
          <Button
            onClick={() => onSubmit(false)}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {mode === 'create' ? 'Tworzenie...' : 'Zapisywanie...'}
              </>
            ) : mode === 'create' ? (
              data.status === 'published' ? 'Opublikuj wyjazd' : 'Utwórz szkic'
            ) : (
              'Zapisz zmiany'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
