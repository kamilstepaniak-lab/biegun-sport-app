'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { createTrip, updateTrip } from '@/lib/actions/trips';
import type { Group, TripWithPaymentTemplates, TripStatus } from '@/types';

import { type TripFormData } from './types';
import { localToISO, formatDateTimeLocal } from './utils';
import { BasicInfoSection } from './basic-info-section';
import { ScheduleSection } from './schedule-section';
import { EmailContentFields } from './email-content-section';
import { GroupsSection } from './groups-section';
import { PaymentsSection } from './payments-section';
import { WordpressSection } from './wordpress-section';

interface TripFormProps {
  groups: Group[];
  trip?: TripWithPaymentTemplates;
  mode: 'create' | 'edit';
}

export function TripForm({ groups, trip, mode }: TripFormProps) {
  const router = useRouter();
  // Jeden cast do pełnego kształtu — eliminuje powtarzające się inline rzutowania
  const t = trip as (TripWithPaymentTemplates & {
    declaration_deadline?: string | null;
    location?: string | null;
    allow_own_transport?: boolean;
    packing_list?: string | null;
    additional_info?: string | null;
  }) | undefined;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const [formData, setFormData] = useState<TripFormData>({
    title: t?.title || '',
    description: t?.description || '',
    declaration_deadline: t?.declaration_deadline || '',
    location: t?.location || '',
    status: t?.status || 'draft',
    attendance_type: t?.attendance_type ?? 'optional',
    category: t?.category ?? 'winter_camp',
    departure_datetime: trip?.departure_datetime
      ? (() => {
          const full = formatDateTimeLocal(trip.departure_datetime);
          const datePart = full.split('T')[0];
          const timePart = trip?.departure_time_known !== false ? (full.split('T')[1] ?? '00:00') : '00:00';
          return datePart ? `${datePart}T${timePart}` : '';
        })()
      : '',
    departure_time_known: trip?.departure_time_known ?? true,
    departure_location: trip?.departure_location || '',
    departure_stop2_datetime: formatDateTimeLocal(t?.departure_stop2_datetime),
    departure_stop2_location: t?.departure_stop2_location || '',
    return_datetime: trip?.return_datetime
      ? (() => {
          const full = formatDateTimeLocal(trip.return_datetime);
          const datePart = full.split('T')[0];
          const timePart = trip?.return_time_known !== false ? (full.split('T')[1] ?? '00:00') : '00:00';
          return datePart ? `${datePart}T${timePart}` : '';
        })()
      : '',
    return_time_known: trip?.return_time_known ?? true,
    return_location: t?.return_location || '',
    return_stop2_datetime: formatDateTimeLocal(t?.return_stop2_datetime),
    return_stop2_location: t?.return_stop2_location || '',
    group_ids: t?.groups?.map((g) => g.id) || [],
    payment_templates: t?.payment_templates?.map((pt) => ({
      ...pt,
      due_date: pt.due_date ? pt.due_date.split('T')[0] : null,
    })) || [],
    allow_own_transport: t?.allow_own_transport ?? false,
    packing_list: t?.packing_list || '',
    additional_info: t?.additional_info || '',
    registration_form_enabled: t?.registration_form_enabled ?? false,
  });

  function updateFormData(data: Partial<TripFormData>) {
    setFormData((prev) => {
      const next = { ...prev, ...data };
      // Płatności oznaczone „W dniu wyjazdu" (due_date == data wyjazdu) podążają
      // za zmianą daty wyjazdu, żeby zaznaczenie nie cofało się do „Konkretna data".
      if (data.departure_datetime !== undefined) {
        const oldDate = prev.departure_datetime.split('T')[0];
        const newDate = next.departure_datetime.split('T')[0];
        if (oldDate && oldDate !== newDate) {
          next.payment_templates = next.payment_templates.map((p) =>
            p.due_date === oldDate ? { ...p, due_date: newDate || null } : p
          );
        }
      }
      return next;
    });
  }

  // Sprawdź co blokuje walidację
  const validationErrors: string[] = [];
  if (formData.title.trim().length < 3) validationErrors.push('Tytuł za krótki (min 3 znaki)');
  if (!formData.departure_datetime) validationErrors.push('Brak daty wyjazdu');
  // Miejsce wyjazdu/powrotu: zawsze opcjonalne (czasem nie jest jeszcze znane);
  // gdy wpisane, pilnujemy tylko minimalnej długości.
  if (formData.departure_location.trim().length > 0 && formData.departure_location.trim().length < 3) {
    validationErrors.push('Miejsce wyjazdu za krótkie (min 3 znaki)');
  }
  if (!formData.return_datetime) validationErrors.push('Brak daty powrotu');
  if (formData.return_location.trim().length > 0 && formData.return_location.trim().length < 3) {
    validationErrors.push('Miejsce powrotu za krótkie (min 3 znaki)');
  }
  if (formData.departure_datetime && formData.return_datetime &&
      new Date(formData.return_datetime) <= new Date(formData.departure_datetime)) {
    validationErrors.push('Data powrotu musi być po dacie wyjazdu');
  }
  if (formData.group_ids.length === 0) validationErrors.push('Wybierz przynajmniej jedną grupę');
  if (formData.payment_templates.length === 0) validationErrors.push('Dodaj przynajmniej jedną płatność');
  formData.payment_templates.forEach((p, i) => {
    if (p.amount <= 0) validationErrors.push(`Płatność ${i + 1}: kwota musi być > 0`);
    if (p.payment_type === 'installment' && !p.installment_number) {
      validationErrors.push(`Płatność ${i + 1}: podaj numer raty`);
    }
  });

  const isValid = validationErrors.length === 0;

  // Flagi błędów per sekcja (dla podświetlania kart)
  const hasBasicErrors = submitAttempted && validationErrors.some((e) => e.includes('Tytuł'));
  const hasDateErrors = submitAttempted && validationErrors.some((e) =>
    e.includes('wyjazdu') || e.includes('powrotu') || e.includes('Data powrotu')
  );
  const hasGroupErrors = submitAttempted && validationErrors.some((e) => e.includes('grupę'));
  const hasPaymentErrors = submitAttempted && validationErrors.some((e) =>
    e.includes('Płatność') || e.includes('płatność')
  );

  async function handleSubmit(saveAsDraft: boolean = false) {
    setIsSubmitting(true);
    try {
      const data = {
        ...formData,
        status: saveAsDraft ? 'draft' as TripStatus : formData.status,
        location: formData.location || null,
        departure_datetime: localToISO(formData.departure_datetime),
        return_datetime: localToISO(formData.return_datetime),
        departure_stop2_datetime: formData.departure_stop2_datetime ? localToISO(formData.departure_stop2_datetime) : null,
        departure_stop2_location: formData.departure_stop2_location || null,
        return_stop2_datetime: formData.return_stop2_datetime ? localToISO(formData.return_stop2_datetime) : null,
        return_stop2_location: formData.return_stop2_location || null,
        allow_own_transport: formData.allow_own_transport,
        registration_form_enabled: formData.registration_form_enabled,
      };

      const result = mode === 'create'
        ? await createTrip(data)
        : await updateTrip(trip!.id, data);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(
          mode === 'create'
            ? saveAsDraft
              ? 'Wyjazd zapisany jako szkic'
              : 'Wyjazd został utworzony'
            : 'Wyjazd został zaktualizowany'
        );
        router.push('/admin/trips');
        router.refresh();
      }
    } catch {
      toast.error('Wystąpił nieoczekiwany błąd');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <BasicInfoSection
        formData={formData}
        updateFormData={updateFormData}
        hasErrors={hasBasicErrors}
      />
      <ScheduleSection
        formData={formData}
        updateFormData={updateFormData}
        hasErrors={hasDateErrors}
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Treść maila do rodziców</CardTitle>
          <CardDescription>Zaznacz sekcje, które mają pojawić się w mailu wysyłanym do grupy.</CardDescription>
        </CardHeader>
        <CardContent>
          <EmailContentFields formData={formData} updateFormData={updateFormData} />
        </CardContent>
      </Card>
      <PaymentsSection
        formData={formData}
        updateFormData={updateFormData}
        hasErrors={hasPaymentErrors}
      />
      <GroupsSection
        formData={formData}
        updateFormData={updateFormData}
        groups={groups}
        hasErrors={hasGroupErrors}
      />
      <WordpressSection
        formData={formData}
        updateFormData={updateFormData}
        tripId={trip?.id}
      />

      {/* Przyciski akcji */}
      <div className="sticky bottom-4 bg-background rounded-lg border shadow-lg overflow-hidden">
        {/* Panel błędów walidacji */}
        {submitAttempted && validationErrors.length > 0 && (
          <div className="p-3 bg-destructive/10 border-b border-destructive/30">
            <p className="text-sm font-semibold text-destructive mb-1 flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              Uzupełnij brakujące dane:
            </p>
            <ul className="text-sm text-destructive space-y-0.5 pl-5">
              {validationErrors.map((err, i) => (
                <li key={i} className="list-disc">{err}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex justify-between gap-4 p-4">
          <Button
            variant="outline"
            onClick={() => router.push('/admin/trips')}
            disabled={isSubmitting}
          >
            Anuluj
          </Button>
          <div className="flex gap-2">
            {mode === 'create' && (
              <Button
                variant="secondary"
                onClick={() => handleSubmit(true)}
                disabled={isSubmitting || !formData.title.trim()}
              >
                Zapisz jako szkic
              </Button>
            )}
            <Button
              onClick={() => {
                setSubmitAttempted(true);
                if (isValid) handleSubmit(false);
              }}
              disabled={isSubmitting}
              variant={submitAttempted && !isValid ? 'destructive' : 'default'}
            >
              {isSubmitting ? 'Zapisywanie...' : mode === 'create' ? 'Utwórz wyjazd' : 'Zapisz zmiany'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
