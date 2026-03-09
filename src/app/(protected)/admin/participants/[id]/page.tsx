import { notFound } from 'next/navigation';
import Link from 'next/link';
import { format, differenceInYears } from 'date-fns';
import { pl } from 'date-fns/locale';
import { ArrowLeft, Calendar, Ruler, Mail, Phone, MapPin, CreditCard, FileText, HeartPulse, Utensils, BedDouble, Info } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { PageHeader, Breadcrumbs } from '@/components/shared';
import { getParticipantFull, getParticipantRegistrations } from '@/lib/actions/participants';
import { getGroups } from '@/lib/actions/groups';
import { ParticipantNotesCard } from './notes-card';
import { ChangeGroupCard } from './change-group-card';

interface ParticipantDetailPageProps {
  params: Promise<{ id: string }>;
}

function formatAmount(amount: number, currency = 'PLN') {
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency }).format(amount);
}

function PaymentStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    paid:       { label: 'Zapłacono',   className: 'bg-green-100 text-green-700' },
    partial:    { label: 'Częściowo',   className: 'bg-yellow-100 text-yellow-700' },
    unpaid:     { label: 'Nieopłacone', className: 'bg-red-100 text-red-700' },
    cancelled:  { label: 'Anulowano',   className: 'bg-gray-100 text-gray-500' },
  };
  const { label, className } = map[status] ?? { label: status, className: 'bg-gray-100 text-gray-600' };
  return <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${className}`}>{label}</span>;
}

export default async function ParticipantDetailPage({ params }: ParticipantDetailPageProps) {
  const { id } = await params;
  const [participant, registrations, groups] = await Promise.all([
    getParticipantFull(id),
    getParticipantRegistrations(id),
    getGroups(),
  ]);

  if (!participant) {
    notFound();
  }

  const birthDate = new Date(participant.birth_date);
  const age = differenceInYears(new Date(), birthDate);
  const parent = participant.parent;

  return (
    <div className="space-y-6">
      <Breadcrumbs
        homeHref="/admin/groups"
        items={[
          { label: 'Uczestnicy', href: '/admin/groups' },
          { label: `${participant.first_name} ${participant.last_name}` },
        ]}
      />

      <PageHeader
        title={`${participant.first_name} ${participant.last_name}`}
        description="Karta uczestnika"
      >
        <Button variant="outline" asChild>
          <Link href="/admin/groups">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Powrót
          </Link>
        </Button>
      </PageHeader>

      <div className="grid gap-6 md:grid-cols-2">

        {/* Dane dziecka */}
        <Card>
          <CardHeader>
            <CardTitle>Dane uczestnika</CardTitle>
            <CardDescription>Podstawowe informacje o dziecku</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <div>
                <p className="text-sm text-muted-foreground">Data urodzenia</p>
                <p className="font-medium">
                  {format(birthDate, 'd MMMM yyyy', { locale: pl })} ({age} lat)
                </p>
              </div>
            </div>

            {participant.height_cm && (
              <div className="flex items-center gap-3">
                <Ruler className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="text-sm text-muted-foreground">Wzrost</p>
                  <p className="font-medium">{participant.height_cm} cm</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <div className="h-5 w-5 flex-shrink-0" />
              <div>
                <p className="text-sm text-muted-foreground">Grupa</p>
                {participant.group ? (
                  <Badge variant="secondary">{participant.group.name}</Badge>
                ) : (
                  <span className="text-muted-foreground text-sm">Brak grupy</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Dane rodzica - kontakt */}
        <Card>
          <CardHeader>
            <CardTitle>Dane rodzica / opiekuna</CardTitle>
            <CardDescription>Informacje kontaktowe i do umowy</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Imię i nazwisko</p>
              <p className="font-medium">{parent.first_name} {parent.last_name}</p>
            </div>

            {parent.pesel && (
              <>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground">PESEL</p>
                  <p className="font-medium font-mono">{parent.pesel}</p>
                </div>
              </>
            )}

            {(parent.address_street || parent.address_zip || parent.address_city) && (
              <>
                <Separator />
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Adres</p>
                    {parent.address_street && <p className="font-medium">{parent.address_street}</p>}
                    {(parent.address_zip || parent.address_city) && (
                      <p className="font-medium">{parent.address_zip} {parent.address_city}</p>
                    )}
                  </div>
                </div>
              </>
            )}

            <Separator />

            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <div>
                <p className="text-sm text-muted-foreground">Email główny</p>
                <p className="font-medium">{parent.email}</p>
              </div>
            </div>

            {parent.secondary_email && (
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="text-sm text-muted-foreground">Email dodatkowy</p>
                  <p className="font-medium">{parent.secondary_email}</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <Phone className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <div>
                <p className="text-sm text-muted-foreground">Telefon główny</p>
                <p className="font-medium">{parent.phone}</p>
              </div>
            </div>

            {parent.secondary_phone && (
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="text-sm text-muted-foreground">Telefon dodatkowy</p>
                  <p className="font-medium">{parent.secondary_phone}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Zmiana grupy */}
        <ChangeGroupCard
          participantId={participant.id}
          currentGroupId={participant.group?.id ?? null}
          groups={groups}
        />

        {/* Notatka od rodzica */}
        {(participant.parent_notes_health || participant.parent_notes_food || participant.parent_notes_accommodation || participant.parent_notes_additional) && (
          <Card className="md:col-span-2 border-amber-100 bg-amber-50/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-800">
                <Info className="h-5 w-5" />
                Notatka od rodzica
              </CardTitle>
              <CardDescription>Informacje przekazane przez opiekuna</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {participant.parent_notes_health && (
                <div className="flex gap-3">
                  <HeartPulse className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Zdrowie i leki</p>
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">{participant.parent_notes_health}</p>
                  </div>
                </div>
              )}
              {participant.parent_notes_food && (
                <div className="flex gap-3">
                  <Utensils className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Jedzenie i dieta</p>
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">{participant.parent_notes_food}</p>
                  </div>
                </div>
              )}
              {participant.parent_notes_accommodation && (
                <div className="flex gap-3">
                  <BedDouble className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Zakwaterowanie</p>
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">{participant.parent_notes_accommodation}</p>
                  </div>
                </div>
              )}
              {participant.parent_notes_additional && (
                <div className="flex gap-3">
                  <Info className="h-5 w-5 text-gray-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Dodatkowe informacje</p>
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">{participant.parent_notes_additional}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Notatki */}
        <ParticipantNotesCard
          participantId={participant.id}
          participantName={`${participant.first_name} ${participant.last_name}`}
          initialNotes={participant.notes || ''}
        />

        {/* Dodatkowe pola */}
        {participant.custom_fields && participant.custom_fields.length > 0 && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Dodatkowe informacje
              </CardTitle>
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

        {/* Wyjazdy */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Zapisy na wyjazdy
            </CardTitle>
            <CardDescription>Historia zapisów i płatności uczestnika</CardDescription>
          </CardHeader>
          <CardContent>
            {registrations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Brak zapisów na wyjazdy
              </p>
            ) : (
              <div className="divide-y">
                {registrations.map((reg) => {
                  const trip = Array.isArray(reg.trip) ? reg.trip[0] : reg.trip;
                  const payment = Array.isArray(reg.payments) ? reg.payments[0] : null;
                  const departureDate = trip?.departure_datetime
                    ? format(new Date(trip.departure_datetime), 'd MMM yyyy', { locale: pl })
                    : null;
                  return (
                    <div key={reg.id} className="py-3 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{trip?.title ?? 'Nieznany wyjazd'}</p>
                        {departureDate && (
                          <p className="text-xs text-muted-foreground">{departureDate}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {payment && (
                          <>
                            <span className="text-sm text-muted-foreground">
                              {formatAmount(payment.amount_paid ?? 0)} / {formatAmount(payment.amount)}
                            </span>
                            <PaymentStatusBadge status={payment.status} />
                          </>
                        )}
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/admin/trips/${trip?.id}/registrations`}>
                            Wyjazd
                          </Link>
                        </Button>
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
