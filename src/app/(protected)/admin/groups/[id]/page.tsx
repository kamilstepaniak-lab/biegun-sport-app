import { notFound } from 'next/navigation';
import Link from 'next/link';
import { format, differenceInYears } from 'date-fns';
import { pl } from 'date-fns/locale';
import { ArrowLeft, Mail, Phone } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PageHeader, Breadcrumbs, EmptyState } from '@/components/shared';
import { getGroup, getGroupParticipants } from '@/lib/actions/groups';

interface GroupDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function GroupDetailPage({ params }: GroupDetailPageProps) {
  const { id } = await params;
  const [group, participants] = await Promise.all([
    getGroup(id),
    getGroupParticipants(id),
  ]);

  if (!group) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs
        homeHref="/admin/groups"
        items={[
          { label: 'Grupy', href: '/admin/groups' },
          { label: group.name },
        ]}
      />

      <PageHeader
        title={group.name}
        description={group.description || `${participants.length} uczestników`}
      >
        <Button variant="outline" asChild>
          <Link href="/admin/groups">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Powrót
          </Link>
        </Button>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>Uczestnicy grupy</CardTitle>
          <CardDescription>
            Lista wszystkich uczestników przypisanych do tej grupy
          </CardDescription>
        </CardHeader>
        <CardContent>
          {participants.length === 0 ? (
            <EmptyState
              title="Brak uczestników"
              description="Do tej grupy nie są przypisani żadni uczestnicy."
            />
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Imię i nazwisko</TableHead>
                    <TableHead>Data urodzenia</TableHead>
                    <TableHead>Wiek</TableHead>
                    <TableHead>Rodzic</TableHead>
                    <TableHead>Kontakt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {participants.map((participant) => {
                    const birthDate = new Date(participant.birth_date);
                    const age = differenceInYears(new Date(), birthDate);

                    return (
                      <TableRow key={participant.id}>
                        <TableCell className="font-medium">
                          <Link
                            href={`/admin/participants/${participant.id}`}
                            className="hover:underline"
                          >
                            {participant.first_name} {participant.last_name}
                          </Link>
                        </TableCell>
                        <TableCell>
                          {format(birthDate, 'd MMM yyyy', { locale: pl })}
                        </TableCell>
                        <TableCell>{age} lat</TableCell>
                        <TableCell>
                          {participant.parent.first_name} {participant.parent.last_name}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1 text-sm">
                              <Mail className="h-3 w-3 text-muted-foreground" />
                              <span className="text-muted-foreground">
                                {participant.parent.email}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-sm">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              <span className="text-muted-foreground">
                                {participant.parent.phone}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
