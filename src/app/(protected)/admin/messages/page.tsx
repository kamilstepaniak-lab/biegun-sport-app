import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { MessageSquare, Eye } from 'lucide-react';

import { PageHeader } from '@/components/shared';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getAdminMessages } from '@/lib/actions/messages';
import { NewMessageForm } from './new-message-form';
import { DeleteMessageButton } from './delete-message-button';

export default async function AdminMessagesPage() {
  const messages = await getAdminMessages();

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <PageHeader
        title="Wiadomości"
        description="Wysyłaj informacje do wszystkich rodziców"
      />

      {/* Formularz nowej wiadomości */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-amber-600" />
            Nowa wiadomość
          </CardTitle>
          <CardDescription>
            Wiadomość będzie widoczna dla wszystkich zalogowanych rodziców w panelu „Moje dzieci".
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NewMessageForm />
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
          {messages.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p>Nie wysłano jeszcze żadnych wiadomości</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {messages.map((msg) => (
                <div key={msg.id} className="flex items-start gap-4 px-6 py-4 hover:bg-gray-50/50">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-gray-900 text-sm truncate">{msg.title}</h4>
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-2 mb-2">{msg.body}</p>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span>{format(new Date(msg.created_at), 'd MMM yyyy, HH:mm', { locale: pl })}</span>
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {msg.read_count} {msg.read_count === 1 ? 'odczytanie' : 'odczytania'}
                      </span>
                    </div>
                  </div>
                  <DeleteMessageButton messageId={msg.id} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
