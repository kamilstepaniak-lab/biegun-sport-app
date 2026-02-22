export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { format, differenceInYears } from 'date-fns';
import { pl } from 'date-fns/locale';
import { ArrowLeft, Edit, Calendar, Ruler, Mail, Phone, Users, StickyNote } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { PageHeader, Breadcrumbs, EmptyState } from '@/components/shared';
import { getParticipantFull } from '@/lib/actions/participants';
import { getParticipantRegistrations } from '@/lib/actions/registrations';
import { ParticipantNotesCard } from './notes-card';
import { DeleteParentAccountButton } from '@/components/admin/delete-parent-account-button';

interface ParticipantDetailPageProps {
  params: Promise<{ id: string }>;
}

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Oczekuje',
  partially_paid: 'Częściowo',
  paid: 'Opłacone',
  overdue: 'Zaległe',
  partially_paid_overdue: 'Częściowo/Zaległe',
  cancelled: 'Anulowane',
};

const PAYMENT_STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'secondary',
  partially_paid: 'outline',
  paid: 'default',
  overdue: 'destructive',
  partially_paid_overdue: 'destructive',
  cancelled: 'outline',
};

const REGISTRATION_STATUS_LABELS: Record<string, string> = {
  active: 'Aktywny',
  cancelled: 'Anulowany',
};

export default async function ParticipantDetailPage({ params }: ParticipantDetailPageProps) {
  const { id } = await params;
  const [participant, registrations] = await Promise.all([
    getParticipantFull(id),
    getParticipantRegistrations(id),
  ]);

  if (!participant) {
    notFound();
  }

  const birthDate = new Date(participant.birth_date);
  const age = differenceInYears(new Date(), birthDate);

  return (
    <div className="space-y-6">
      <Breadcrumbs
        homeHref="/admin/groups"
        items={[
          { label: 'Uczestnicy', href: '/admin/participants' },
          { label: `${participant.first_name} ${participant.last_name}` },
        ]}
      />

      <PageHeader
        title={`${participant.first_name} ${participant.last_name}`}
        description="Szczegóły uczestnika"
      >
        <Button variant="outline" asChild>
          <Link href="/admin/participants">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Powrót
          </Link>
        </Button>
        <Button asChild>
          <Link href={`/admin/participants/${id}?edit=true`}>
            <Edit className="mr-2 h-4 w-4" />
            Edytuj
          </Link>
        </Button>
      </PageHeader>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Dane uczestnika */}
        <Card>
          <CardHeader>
            <CardTitle>Dane uczestnika</CardTitle>
            <CardDescription>Podstawowe informacje</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Data urodzenia</p>
                <p className="font-medium">
                  {format(birthDate, 'd MMMM yyyy', { locale: pl })} ({age} lat)
                </p>
              </div>
            </div>

            {participant.height_cm && (
              <div className="flex items-center gap-3">
                <Ruler className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Wzrost</p>
                  <p className="font-medium">{participant.height_cm} cm</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Grupa</p>
                {participant.group ? (
                  <Badge variant="secondary">{participant.group.name}</Badge>
                ) : (
                  <span className="text-muted-foreground">Brak przypisanej grupy</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Dane rodzica */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle>Dane rodzica</CardTitle>
                <CardDescription>Informacje kontaktowe</CardDescription>
              </div>
              <DeleteParentAccountButton
                parentId={participant.parent.id}
                parentName={`${participant.parent.first_name} ${participant.parent.last_name}`}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Imię i nazwisko</p>
              <p className="font-medium">
                {participant.parent.first_name} {participant.parent.last_name}
              </p>
            </div>

            <Separator />

            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Email główny</p>
                <p className="font-medium">{participant.parent.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Phone className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Telefon główny</p>
                <p className="font-medium">{participant.parent.phone}</p>
              </div>
            </div>

            {participant.parent.secondary_email && (
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Email dodatkowy</p>
                  <p className="font-medium">{participant.parent.secondary_email}</p>
                </div>
              </div>
            )}

            {participant.parent.secondary_phone && (
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Telefon dodatkowy</p>
                  <p className="font-medium">{participant.parent.secondary_phone}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notatki */}
        <ParticipantNotesCard
          participantId={participant.id}
          participantName={`${participant.first_name} ${participant.last_name}`}
          initialNotes={participant.notes || ''}
        />

        {/* Custom fields */}
        {participant.custom_fields && participant.custom_fields.length > 0 && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Dodatkowe informacje</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {participant.custom_fields.map((field) => (
                  <div key={field.id}>
                    <p className="text-sm text-muted-foreground">{field.field_name}</p>
                    <p className="font-medium">{field.field_value || '-'}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Zapisy na wyjazdy */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Zapisy na wyjazdy</CardTitle>
            <CardDescription>Historia zapisów i płatności</CardDescription>
          </CardHeader>
          <CardContent>
            {registrations.length === 0 ? (
              <EmptyState
                icon={StickyNote}
                title="Brak zapisów na wyjazdy"
                description="Uczestnik nie jest zapisany na żaden wyjazd."
              />
            ) : (
              <div className="divide-y">
                {registrations.map((reg) => {
                  const totalAmount = reg.payments.reduce((sum, p) => sum + p.amount, 0);
                  const totalPaid = reg.payments.reduce((sum, p) => sum + p.amount_paid, 0);
                  const currencies = [...new Set(reg.payments.map((p) => p.currency))];
                  const overallStatus = reg.payments.length > 0
                    ? reg.payments.every((p) => p.status === 'paid')
                      ? 'paid'
                      : reg.payments.some((p) => p.status === 'overdue' || p.status === 'partially_paid_overdue')
                        ? 'overdue'
                        : reg.payments.some((p) => p.status === 'partially_paid')
                          ? 'partially_paid'
                          : 'pending'
                    : null;

                  return (
                    <div key={reg.id} className="py-4 flex items-start justify-between gap-4">
                      <div className="space-y-1 min-w-0">
                        <Link
                          href={`/admin/trips/${reg.trip_id}/registrations`}
                          className="font-medium text-sm hover:underline truncate block"
                        >
                          {reg.trip.title}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(reg.trip.departure_datetime), 'd MMM yyyy', { locale: pl })}
                          {' – '}
                          {format(new Date(reg.trip.return_datetime), 'd MMM yyyy', { locale: pl })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Zapis: {format(new Date(reg.created_at), 'd MMM yyyy', { locale: pl })}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <Badge
                          variant={reg.status === 'active' ? 'default' : 'outline'}
                          className="text-xs"
                        >
                          {REGISTRATION_STATUS_LABELS[reg.status] ?? reg.status}
                        </Badge>
                        {overallStatus && (
                          <Badge
                            variant={PAYMENT_STATUS_VARIANTS[overallStatus] ?? 'secondary'}
                            className="text-xs"
                          >
                            {PAYMENT_STATUS_LABELS[overallStatus] ?? overallStatus}
                          </Badge>
                        )}
                        {reg.payments.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            {totalPaid.toFixed(0)}&nbsp;/&nbsp;{totalAmount.toFixed(0)}&nbsp;{currencies.join('/')}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
