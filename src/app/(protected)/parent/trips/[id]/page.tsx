export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Calendar, Clock, MapPin, Users, CreditCard, Info, Copy, Check, Banknote } from 'lucide-react';

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

  // Filtruj dzieci które mogą jechać na ten wyjazd (są w odpowiedniej grupie)
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
        description={trip.description || 'Szczegóły wyjazdu narciarskiego'}
      />

      <div className="grid gap-6 md:grid-cols-3">
        {/* Main info */}
        <div className="md:col-span-2 space-y-6">
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
                  <h4 className="font-semibold text-green-700">Wyjazd</h4>

                  {/* Przystanek 1 */}
                  <div className="space-y-2 pl-3 border-l-2 border-green-300">
                    <p className="text-xs font-medium text-green-600">Przystanek 1 (główny)</p>
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
                    <div className="space-y-2 pl-3 border-l-2 border-green-200">
                      <p className="text-xs font-medium text-green-500">Przystanek 2</p>
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
                  {trip.groups?.map((group) => (
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

          {/* Payment info */}
          {trip.payment_templates && trip.payment_templates.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Cennik wyjazdu
                </CardTitle>
                <CardDescription>
                  Harmonogram płatności za wyjazd
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PricingTable templates={trip.payment_templates} departureDate={trip.departure_datetime} />
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar - registration & payment info */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Twoje dzieci
              </CardTitle>
              <CardDescription>
                Dzieci mogące uczestniczyć w tym wyjeździe
              </CardDescription>
            </CardHeader>
            <CardContent>
              {eligibleChildren.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Żadne z Twoich dzieci nie jest w grupie, która może uczestniczyć w tym wyjeździe.
                </p>
              ) : (
                <div className="space-y-3">
                  {eligibleChildren.map((child) => (
                    <div key={child.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <p className="font-medium">{child.first_name} {child.last_name}</p>
                        <p className="text-sm text-muted-foreground">{child.group?.name}</p>
                      </div>
                      <Badge variant="outline">Może jechać</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Dane do przelewu */}
          {eligibleChildren.length > 0 && (
            <PaymentInfoCard
              trip={trip}
              children={eligibleChildren}
            />
          )}
        </div>
      </div>
    </div>
  );
}
