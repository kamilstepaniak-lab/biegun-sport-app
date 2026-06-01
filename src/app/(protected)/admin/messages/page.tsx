import { MessageSquare } from 'lucide-react';

import { PageHeader } from '@/components/shared';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getAdminMessages } from '@/lib/actions/messages';
import { getGroups } from '@/lib/actions/groups';
import { NewMessageForm } from './new-message-form';
import { AdminMessageList } from './admin-message-list';

export default async function AdminMessagesPage() {
  const [messages, groups] = await Promise.all([getAdminMessages(), getGroups()]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Wiadomości"
        description="Wysyłaj informacje do rodziców"
      />

      <div className="space-y-6 max-w-3xl mx-auto">
      {/* Formularz nowej wiadomości */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-amber-600" />
            Nowa wiadomość
          </CardTitle>
          <CardDescription>
            Wiadomość będzie widoczna dla wybranych rodziców w panelu „Moje dzieci&rdquo;.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NewMessageForm groups={groups} />
        </CardContent>
      </Card>

      {/* Historia wiadomości */}
      <Card>
        <CardHeader>
          <CardTitle>Wysłane wiadomości ({messages.length})</CardTitle>
          <CardDescription>
            Historia wszystkich wysłanych komunikatów
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <AdminMessageList messages={messages} groups={groups} />
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
