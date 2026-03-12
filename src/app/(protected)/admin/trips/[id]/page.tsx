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
  Backpack,
  Info,
  MessageCircle,
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
        description={[trip.location, trip.description].filter(Boolean).join(' · ') || undefined}
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

      <div className="grid gap-6 md:grid-cols-3">
        {/* Main area */}
        <div className="md:col-span-2 space-y-6">
          {/* Informacje o wyjeździe */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5" />
                Informacje o wyjeździe
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-6 sm:grid-cols-2">
                {/* WYJAZD */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-blue-700">Wyjazd</h4>

                  {/* Przystanek 1 */}
                  <div className="space-y-2 pl-3 border-l-2 border-blue-300">
                    <p className="text-xs font-medium text-blue-600">Przystanek 1 (główny)</p>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-primary" />
                      <span>{format(new Date(trip.departure_datetime), 'd MMMM yyyy', { locale: pl })}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" />
                      <span>{format(new Date(trip.departure_datetime), 'HH:mm')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" />
                      <span>{trip.departure_location}</span>
                    </div>
                  </div>

                  {/* Przystanek 2 */}
                  {trip.departure_stop2_location && (
                    <div className="space-y-2 pl-3 border-l-2 border-blue-200">
                      <p className="text-xs font-medium text-blue-500">Przystanek 2</p>
                      {trip.departure_stop2_datetime && (
                        <>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span>{format(new Date(trip.departure_stop2_datetime), 'd MMMM yyyy', { locale: pl })}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span>{format(new Date(trip.departure_stop2_datetime), 'HH:mm')}</span>
                          </div>
                        </>
                      )}
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>{trip.departure_stop2_location}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* POWRÓT */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-blue-700">Powrót</h4>

                  {/* Przystanek 1 */}
                  <div className="space-y-2 pl-3 border-l-2 border-blue-300">
                    <p className="text-xs font-medium text-blue-600">Przystanek 1 (główny)</p>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-primary" />
                      <span>{format(new Date(trip.return_datetime), 'd MMMM yyyy', { locale: pl })}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" />
                      <span>{format(new Date(trip.return_datetime), 'HH:mm')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" />
                      <span>{trip.return_location}</span>
                    </div>
                  </div>

                  {/* Przystanek 2 */}
                  {trip.return_stop2_location && (
                    <div className="space-y-2 pl-3 border-l-2 border-blue-200">
                      <p className="text-xs font-medium text-blue-500">Przystanek 2</p>
                      {trip.return_stop2_datetime && (
                        <>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span>{format(new Date(trip.return_stop2_datetime), 'd MMMM yyyy', { locale: pl })}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span>{format(new Date(trip.return_stop2_datetime), 'HH:mm')}</span>
                          </div>
                        </>
                      )}
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>{trip.return_stop2_location}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-medium text-sm text-muted-foreground mb-2">Grupy</h4>
                <div className="flex flex-wrap gap-2">
                  {trip.groups.map((group) => (
                    <Badge key={group.id} variant="secondary">
                      {group.name}
                    </Badge>
                  ))}
                </div>
              </div>

              {trip.description && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-medium text-sm text-muted-foreground mb-2">Opis</h4>
                    <p className="text-sm">{trip.description}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Cennik */}
          {trip.payment_templates && trip.payment_templates.length > 0 && (
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Cennik wyjazdu
                </CardTitle>
                <CardDescription>
                  Harmonogram płatności za wyjazd
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto px-0 pb-0">
                <div className="px-6 pb-6">
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
                </div>
              </CardContent>
            </Card>
          )}

          {/* Co zabrać */}
          {trip.packing_list && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Backpack className="h-5 w-5" />
                  Co zabrać
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {trip.packing_list
                    .split('\n')
                    .map((line) => line.replace(/^[-•*]\s*/, '').trim())
                    .filter(Boolean)
                    .map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Dodatkowe informacje */}
          {trip.additional_info && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5" />
                  Dodatkowe informacje
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {trip.additional_info
                    .split('\n')
                    .filter(Boolean)
                    .map((line, i) => (
                      <p key={i} className="text-sm text-muted-foreground">{line}</p>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Status
                <Badge variant={trip.status === 'published' ? 'default' : 'secondary'}>
                  {statusLabels[trip.status]}
                </Badge>
              </CardTitle>
            </CardHeader>
            {trip.declaration_deadline && (
              <CardContent>
                <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                  <span className="text-amber-700 text-sm font-medium">⏰ Deklaracja do:</span>
                  <span className="text-amber-800 text-sm font-semibold">
                    {format(new Date(trip.declaration_deadline), "d MMMM yyyy", { locale: pl })}
                  </span>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Wzór umowy */}
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
