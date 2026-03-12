import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Calendar, Clock, MapPin, Users, Backpack, Info } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { PageHeader, Breadcrumbs, PricingTable } from '@/components/shared';
import { getTrip } from '@/lib/actions/trips';
import { getMyChildren } from '@/lib/actions/participants';
import { PaymentInfoCard } from './payment-info-card';

interface TripDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function TripDetailPage({ params }: TripDetailPageProps) {
  const { id } = await params;

  const [trip, children] = await Promise.all([
    getTrip(id),
    getMyChildren(),
  ]);

  if (!trip) {
    notFound();
  }

  const tripGroupIds = trip.groups?.map(g => g.id) || [];
  const eligibleChildren = children.filter(child =>
    child.group && tripGroupIds.includes(child.group.id)
  );

  return (
    <div className="space-y-6">
      <Breadcrumbs
        homeHref="/parent/children"
        items={[
          { label: 'Wyjazdy', href: '/parent/trips' },
          { label: trip.title },
        ]}
      />

      <PageHeader
        title={trip.title}
        description={[trip.location, trip.description].filter(Boolean).join(' · ') || 'Szczegóły wyjazdu narciarskiego'}
      />

      <div className="grid gap-6 md:grid-cols-2">
        {/* Podstawowe informacje */}
        <Card>
          <CardHeader>
            <CardTitle>Informacje</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {trip.groups?.map((group) => (
                <Badge key={group.id} variant="outline" className="text-sm">
                  {group.name}
                </Badge>
              ))}
            </div>

            {eligibleChildren.length > 0 && (
              <>
                <Separator />
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-medium">Twoje dzieci</p>
                  </div>
                  <div className="space-y-2">
                    {eligibleChildren.map((child) => (
                      <div key={child.id} className="flex items-center justify-between">
                        <p className="text-sm">{child.first_name} {child.last_name}</p>
                        <Badge variant="secondary" className="text-xs">{child.group?.name}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Cennik */}
        {trip.payment_templates && trip.payment_templates.length > 0 && (
          <Card className="md:col-span-2 overflow-hidden">
            <CardHeader>
              <CardTitle>Cennik wyjazdu</CardTitle>
              <CardDescription>
                Harmonogram płatności za wyjazd
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto px-0 pb-0">
              <div className="px-6 pb-6">
                <PricingTable templates={trip.payment_templates} departureDate={trip.departure_datetime} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Dane do przelewu */}
        {eligibleChildren.length > 0 && (
          <div className="md:col-span-2">
            <PaymentInfoCard
              trip={trip}
              children={eligibleChildren}
            />
          </div>
        )}

        {/* Co zabrać */}
        {trip.packing_list && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Backpack className="h-5 w-5" />
                Co zabrać
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1">
                {trip.packing_list
                  .split('\n')
                  .map((line) => line.replace(/^[-•*]\s*/, '').trim())
                  .filter(Boolean)
                  .map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
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
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5" />
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
    </div>
  );
}
