export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import {
  ArrowLeft,
  Edit,
  Users,
  CreditCard,
  Calendar,
  MapPin,
  Clock,
  FileText,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { PageHeader, Breadcrumbs, PricingTable } from '@/components/shared';
import { TripMessageGenerator } from '@/components/admin/trip-message-generator';
import { ContractTemplateEditor } from '@/components/admin/contract-template-editor';
import { getTrip } from '@/lib/actions/trips';
import { getTripContractTemplate } from '@/lib/actions/contracts';
import { CONTRACT_TEMPLATE } from '@/lib/contract-template';

const statusLabels: Record<string, string> = {
  draft: 'Szkic',
  published: 'Opublikowany',
  cancelled: 'Anulowany',
  completed: 'Zakończony',
};

interface TripDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function TripDetailPage({ params }: TripDetailPageProps) {
  const { id } = await params;

  const [trip, contractTemplate] = await Promise.all([
    getTrip(id),
    getTripContractTemplate(id),
  ]);

  if (!trip) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs
        homeHref="/admin/groups"
        items={[
          { label: 'Wyjazdy', href: '/admin/trips' },
          { label: trip.title },
        ]}
      />

      <PageHeader
        title={trip.title}
        description={trip.description || undefined}
      >
        <Button variant="outline" asChild>
          <Link href="/admin/trips">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Powrót
          </Link>
        </Button>
        <TripMessageGenerator trip={trip} />
        <ContractTemplateEditor
          tripId={id}
          initialTemplate={contractTemplate}
          defaultTemplateText={CONTRACT_TEMPLATE}
        />
        <Button variant="outline" asChild>
          <Link href={`/admin/trips/${id}/contracts`}>
            <FileText className="mr-2 h-4 w-4" />
            Umowy
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/admin/trips/${id}/registrations`}>
            <Users className="mr-2 h-4 w-4" />
            Zapisani
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/admin/trips/${id}/payments`}>
            <CreditCard className="mr-2 h-4 w-4" />
            Płatności
          </Link>
        </Button>
        <Button asChild>
          <Link href={`/admin/trips/${id}/edit`}>
            <Edit className="mr-2 h-4 w-4" />
            Edytuj
          </Link>
        </Button>
      </PageHeader>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Podstawowe informacje */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Informacje
              <Badge variant={trip.status === 'published' ? 'default' : 'secondary'}>
                {statusLabels[trip.status]}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {trip.declaration_deadline && (
              <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                <span className="text-amber-700 text-sm font-medium">⏰ Deklaracja do:</span>
                <span className="text-amber-800 text-sm font-semibold">
                  {format(new Date(trip.declaration_deadline), "d MMMM yyyy", { locale: pl })}
                </span>
              </div>
            )}
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">Wyjazd</p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(trip.departure_datetime), "d MMMM yyyy, HH:mm", { locale: pl })}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">Miejsce wyjazdu</p>
                <p className="text-sm text-muted-foreground">{trip.departure_location}</p>
              </div>
            </div>

            <Separator />

            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">Powrót</p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(trip.return_datetime), "d MMMM yyyy, HH:mm", { locale: pl })}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">Miejsce powrotu</p>
                <p className="text-sm text-muted-foreground">{trip.return_location}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Grupy */}
        <Card>
          <CardHeader>
            <CardTitle>Grupy</CardTitle>
            <CardDescription>
              Wyjazd dostępny dla następujących grup
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {trip.groups.map((group) => (
                <Badge key={group.id} variant="outline" className="text-sm">
                  {group.name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Płatności */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Szablony płatności ({trip.payment_templates.length})</CardTitle>
            <CardDescription>
              Konfiguracja rat i karnetów dla tego wyjazdu
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PricingTable templates={trip.payment_templates} departureDate={trip.departure_datetime} />

            <Separator className="my-4" />

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">Konto PLN:</p>
                <p className="font-mono text-sm">{trip.bank_account_pln}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Konto EUR:</p>
                <p className="font-mono text-sm">{trip.bank_account_eur}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Wzór umowy — pełna szerokość */}
        <div className="md:col-span-2">
          <ContractTemplateEditor
            tripId={id}
            initialTemplate={contractTemplate}
            defaultTemplateText={CONTRACT_TEMPLATE}
          />
        </div>
      </div>
    </div>
  );
}
