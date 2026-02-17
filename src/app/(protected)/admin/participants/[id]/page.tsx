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
import { PageHeader, Breadcrumbs } from '@/components/shared';
import { getParticipantFull } from '@/lib/actions/participants';
import { ParticipantNotesCard } from './notes-card';

interface ParticipantDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ParticipantDetailPage({ params }: ParticipantDetailPageProps) {
  const { id } = await params;
  const participant = await getParticipantFull(id);

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
            <CardTitle>Dane rodzica</CardTitle>
            <CardDescription>Informacje kontaktowe</CardDescription>
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

        {/* Zapisy na wyjazdy - placeholder */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Zapisy na wyjazdy</CardTitle>
            <CardDescription>Historia zapisów i płatności</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center py-8">
              Brak zapisów na wyjazdy
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
