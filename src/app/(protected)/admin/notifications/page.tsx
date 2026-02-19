import { Mail, Send, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';

import { createAdminClient } from '@/lib/supabase/server';
import { NotificationsForm } from '@/components/admin/notifications-form';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

async function getPageData() {
  const admin = createAdminClient();

  const [{ data: notifications }, { data: groups }, { data: trips }] = await Promise.all([
    admin
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20),
    admin.from('groups').select('*').order('display_order'),
    admin.from('trips').select('*').eq('status', 'published').order('departure_datetime'),
  ]);

  return {
    notifications: notifications ?? [],
    groups: groups ?? [],
    trips: trips ?? [],
  };
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'draft':
      return <Badge variant="secondary"><Clock className="mr-1 h-3 w-3" />Szkic</Badge>;
    case 'approved':
      return <Badge variant="outline"><CheckCircle className="mr-1 h-3 w-3" />Zatwierdzone</Badge>;
    case 'sent':
      return <Badge variant="default" className="bg-green-600"><Send className="mr-1 h-3 w-3" />Wysłane</Badge>;
    case 'failed':
      return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" />Błąd</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

export default async function NotificationsPage() {
  const { notifications, groups, trips } = await getPageData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Powiadomienia email</h1>
        <p className="text-muted-foreground">
          Wyślij masowe wiadomości email do rodziców przez Gmail
        </p>
      </div>

      {/* Komunikat o konfiguracji */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-medium">Wymagana konfiguracja Gmail OAuth2</p>
          <p className="mt-1">
            Uzupełnij zmienne środowiskowe w <code className="rounded bg-amber-100 px-1 dark:bg-amber-900">.env.local</code>:
            {' '}
            <code>GMAIL_CLIENT_ID</code>, <code>GMAIL_CLIENT_SECRET</code>,{' '}
            <code>GMAIL_REFRESH_TOKEN</code>, <code>GMAIL_FROM_EMAIL</code>.
            Instrukcja konfiguracji znajduje się w pliku{' '}
            <code>src/lib/gmail.ts</code>.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Formularz tworzenia */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Nowe powiadomienie
            </CardTitle>
            <CardDescription>
              Utwórz i wyślij masowy email do wybranych odbiorców
            </CardDescription>
          </CardHeader>
          <CardContent>
            <NotificationsForm groups={groups} trips={trips} />
          </CardContent>
        </Card>

        {/* Historia wysyłek */}
        <Card>
          <CardHeader>
            <CardTitle>Historia wysyłek</CardTitle>
            <CardDescription>Ostatnie 20 powiadomień</CardDescription>
          </CardHeader>
          <CardContent>
            {notifications.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Brak wysłanych powiadomień
              </p>
            ) : (
              <div className="space-y-3">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className="flex items-start justify-between gap-3 rounded-lg border p-3 text-sm"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="truncate font-medium">{n.subject}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(n.created_at), 'd MMM yyyy, HH:mm', { locale: pl })}
                        {n.recipient_count != null && ` · ${n.recipient_count} odbiorców`}
                      </p>
                    </div>
                    <StatusBadge status={n.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
