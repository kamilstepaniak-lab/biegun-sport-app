import { notFound } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { ArrowLeft } from 'lucide-react';

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
                    <TableHead>Nazwisko i imię</TableHead>
                    <TableHead>Data ur.</TableHead>
                    <TableHead>Grupa</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Telefon</TableHead>
                    <TableHead>Notatka</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {participants.map((participant) => {
                    const birthDate = new Date(participant.birth_date);

                    return (
                      <TableRow key={participant.id}>
                        <TableCell className="font-medium">
                          <Link
                            href={`/admin/participants/${participant.id}`}
                            className="hover:underline"
                          >
                            {participant.last_name} {participant.first_name}
                          </Link>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {format(birthDate, 'dd.MM.yyyy')}
                        </TableCell>
                        <TableCell>{group.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground truncate max-w-[240px]">
                          {participant.parent.email || '—'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {participant.parent.phone || '—'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[280px] truncate">
                          {participant.notes?.trim() || '—'}
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
