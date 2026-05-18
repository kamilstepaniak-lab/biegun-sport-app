import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { format, differenceInYears } from 'date-fns';
import { pl } from 'date-fns/locale';
import {
  ArrowLeft,
  Calendar,
  Ruler,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  FileText,
  HeartPulse,
  Utensils,
  BedDouble,
  Info,
  UserRound,
  Users,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { PageHeader, Breadcrumbs } from '@/components/shared';
import { getParticipantFull, getParticipantRegistrations } from '@/lib/actions/participants';
import { getGroups } from '@/lib/actions/groups';
import { cn } from '@/lib/utils';
import { ParticipantNotesCard } from './notes-card';
import { ChangeGroupCard } from './change-group-card';

interface ParticipantDetailPageProps {
  params: Promise<{ id: string }>;
}

function formatAmount(amount: number, currency = 'PLN') {
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency }).format(amount);
}

function formatShortDate(date: string | Date | null | undefined) {
  if (!date) return 'Brak daty';
  return format(new Date(date), 'd MMM yyyy', { locale: pl });
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

function InfoRow({
  icon,
  label,
  value,
  href,
  muted = false,
}: {
  icon?: ReactNode;
  label: string;
  value: ReactNode;
  href?: string;
  muted?: boolean;
}) {
  const content = (
    <div className="min-w-0">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <p className={cn('mt-0.5 break-words text-sm font-medium text-gray-900', muted && 'text-gray-400')}>
        {value}
      </p>
    </div>
  );

  return (
    <div className="flex items-start gap-3">
      {icon && <div className="mt-0.5 text-gray-400">{icon}</div>}
      {href ? (
        <a href={href} className="min-w-0 hover:text-primary hover:underline">
          {content}
        </a>
      ) : (
        content
      )}
    </div>
  );
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
  const hasParentNotes = Boolean(
    participant.parent_notes_health ||
    participant.parent_notes_food ||
    participant.parent_notes_accommodation ||
    participant.parent_notes_additional
  );
  const hasAddress = Boolean(parent.address_street || parent.address_zip || parent.address_city);
  const activePaymentCount = registrations.filter((reg) => {
    const payment = Array.isArray(reg.payments) ? reg.payments[0] : null;
    return payment && payment.status !== 'paid' && payment.status !== 'cancelled';
  }).length;

  return (
    <div className="space-y-6">
      <Breadcrumbs
        homeHref="/admin"
        items={[
          { label: 'Uczestnicy', href: '/admin/participants' },
          { label: `${participant.first_name} ${participant.last_name}` },
        ]}
      />

      <PageHeader
        title={`${participant.first_name} ${participant.last_name}`}
        description="Karta uczestnika"
      >
        <Button variant="outline" asChild>
          <Link href="/admin/participants">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Do uczestników
          </Link>
        </Button>
      </PageHeader>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Card className="overflow-hidden border-gray-200">
            <div className="border-b bg-gray-50/70 px-6 py-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white ring-1 ring-gray-200">
                      <UserRound className="h-5 w-5 text-gray-600" />
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Uczestnik</p>
                      <h2 className="text-xl font-semibold text-gray-950">
                        {participant.first_name} {participant.last_name}
                      </h2>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {participant.group ? (
                    <Badge variant="secondary" className="rounded-md px-2.5 py-1">
                      <Users className="h-3.5 w-3.5" />
                      {participant.group.name}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="rounded-md px-2.5 py-1 text-gray-500">
                      Bez grupy
                    </Badge>
                  )}
                  {hasParentNotes && (
                    <Badge className="rounded-md bg-amber-100 px-2.5 py-1 text-amber-800 hover:bg-amber-100">
                      Uwagi rodzica
                    </Badge>
                  )}
                  {activePaymentCount > 0 && (
                    <Badge className="rounded-md bg-red-100 px-2.5 py-1 text-red-700 hover:bg-red-100">
                      {activePaymentCount} płatn. do kontroli
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <CardContent className="grid gap-5 py-5 sm:grid-cols-3">
              <InfoRow
                icon={<Calendar className="h-5 w-5" />}
                label="Data urodzenia"
                value={`${format(birthDate, 'd MMMM yyyy', { locale: pl })} (${age} lat)`}
              />
              <InfoRow
                icon={<Ruler className="h-5 w-5" />}
                label="Wzrost"
                value={participant.height_cm ? `${participant.height_cm} cm` : 'Brak danych'}
                muted={!participant.height_cm}
              />
              <InfoRow
                icon={<CreditCard className="h-5 w-5" />}
                label="Aktywne zapisy"
                value={`${registrations.length} ${registrations.length === 1 ? 'wyjazd' : 'wyjazdów'}`}
              />
            </CardContent>
          </Card>

          {hasParentNotes && (
            <Card className="border-amber-200 bg-amber-50/40">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-900">
                  <Info className="h-5 w-5" />
                  Uwagi od rodzica
                </CardTitle>
                <CardDescription>Informacje ważne dla prowadzących i opiekunów</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                {participant.parent_notes_health && (
                  <div className="flex gap-3 rounded-lg bg-white/70 p-4 ring-1 ring-amber-100">
                    <HeartPulse className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Zdrowie i leki</p>
                      <p className="whitespace-pre-wrap text-sm text-gray-950">{participant.parent_notes_health}</p>
                    </div>
                  </div>
                )}
                {participant.parent_notes_food && (
                  <div className="flex gap-3 rounded-lg bg-white/70 p-4 ring-1 ring-amber-100">
                    <Utensils className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-500" />
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Jedzenie i dieta</p>
                      <p className="whitespace-pre-wrap text-sm text-gray-950">{participant.parent_notes_food}</p>
                    </div>
                  </div>
                )}
                {participant.parent_notes_accommodation && (
                  <div className="flex gap-3 rounded-lg bg-white/70 p-4 ring-1 ring-amber-100">
                    <BedDouble className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-500" />
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Zakwaterowanie</p>
                      <p className="whitespace-pre-wrap text-sm text-gray-950">{participant.parent_notes_accommodation}</p>
                    </div>
                  </div>
                )}
                {participant.parent_notes_additional && (
                  <div className="flex gap-3 rounded-lg bg-white/70 p-4 ring-1 ring-amber-100">
                    <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-gray-500" />
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Dodatkowe informacje</p>
                      <p className="whitespace-pre-wrap text-sm text-gray-950">{participant.parent_notes_additional}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Zapisy i płatności
              </CardTitle>
              <CardDescription>Aktywne zapisy uczestnika na wyjazdy</CardDescription>
            </CardHeader>
            <CardContent>
              {registrations.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Brak aktywnych zapisów na wyjazdy
                </p>
              ) : (
                <div className="overflow-hidden rounded-lg border">
                  <div className="grid grid-cols-[minmax(0,1fr)_140px_180px_86px] gap-3 border-b bg-gray-50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-gray-400 max-lg:hidden">
                    <span>Wyjazd</span>
                    <span>Termin</span>
                    <span>Płatność</span>
                    <span></span>
                  </div>
                  <div className="divide-y">
                    {registrations.map((reg) => {
                      const trip = Array.isArray(reg.trip) ? reg.trip[0] : reg.trip;
                      const payment = Array.isArray(reg.payments) ? reg.payments[0] : null;
                      const currency = payment?.currency ?? 'PLN';
                      return (
                        <div
                          key={reg.id}
                          className="grid gap-3 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_140px_180px_86px] lg:items-center"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-gray-950">
                              {trip?.title ?? 'Nieznany wyjazd'}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground lg:hidden">
                              {formatShortDate(trip?.departure_datetime)}
                            </p>
                          </div>
                          <p className="hidden text-sm text-gray-600 lg:block">
                            {formatShortDate(trip?.departure_datetime)}
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            {payment ? (
                              <>
                                <span className="text-sm text-gray-600">
                                  {formatAmount(payment.amount_paid ?? 0, currency)} / {formatAmount(payment.amount, currency)}
                                </span>
                                <PaymentStatusBadge status={payment.status} />
                              </>
                            ) : (
                              <span className="text-sm text-gray-400">Brak płatności</span>
                            )}
                          </div>
                          {trip?.id ? (
                            <Button variant="outline" size="sm" asChild>
                              <Link href={`/admin/trips/${trip.id}/registrations`}>
                                Wyjazd
                              </Link>
                            </Button>
                          ) : (
                            <Button variant="outline" size="sm" disabled>
                              Wyjazd
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {participant.custom_fields && participant.custom_fields.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Dodatkowe informacje
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {participant.custom_fields.map((field) => (
                    <div key={field.id} className="rounded-lg border bg-gray-50/50 p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{field.field_name}</p>
                      <p className="mt-1 text-sm font-medium text-gray-900">{field.field_value || '-'}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Dane rodzica</CardTitle>
              <CardDescription>Kontakt i dane do umowy</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <InfoRow
                label="Imię i nazwisko"
                value={`${parent.first_name} ${parent.last_name}`}
              />
              {parent.pesel && (
                <>
                  <Separator />
                  <InfoRow label="PESEL" value={<span className="font-mono">{parent.pesel}</span>} />
                </>
              )}
              <Separator />
              <InfoRow
                icon={<Mail className="h-5 w-5" />}
                label="Email główny"
                value={parent.email}
                href={`mailto:${parent.email}`}
              />
              {parent.secondary_email && (
                <InfoRow
                  icon={<Mail className="h-5 w-5" />}
                  label="Email dodatkowy"
                  value={parent.secondary_email}
                  href={`mailto:${parent.secondary_email}`}
                />
              )}
              <InfoRow
                icon={<Phone className="h-5 w-5" />}
                label="Telefon główny"
                value={parent.phone || 'Brak telefonu'}
                href={parent.phone ? `tel:${parent.phone}` : undefined}
                muted={!parent.phone}
              />
              {parent.secondary_phone && (
                <InfoRow
                  icon={<Phone className="h-5 w-5" />}
                  label="Telefon dodatkowy"
                  value={parent.secondary_phone}
                  href={`tel:${parent.secondary_phone}`}
                />
              )}
              {hasAddress && (
                <>
                  <Separator />
                  <InfoRow
                    icon={<MapPin className="h-5 w-5" />}
                    label="Adres"
                    value={
                      <>
                        {parent.address_street && <span className="block">{parent.address_street}</span>}
                        {(parent.address_zip || parent.address_city) && (
                          <span className="block">{parent.address_zip} {parent.address_city}</span>
                        )}
                      </>
                    }
                  />
                </>
              )}
            </CardContent>
          </Card>

          <ChangeGroupCard
            participantId={participant.id}
            currentGroupId={participant.group?.id ?? null}
            groups={groups}
          />

          <ParticipantNotesCard
            participantId={participant.id}
            initialNotes={participant.notes || ''}
            compact
          />
        </aside>
      </div>
    </div>
  );
}
