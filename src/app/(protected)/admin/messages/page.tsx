import { MessageSquare } from 'lucide-react';

import { PageHeader, PanelCard, SectionTitle } from '@/components/shared';
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

      <div className="space-y-6">
        <PanelCard className="p-6">
          <SectionTitle
            icon={MessageSquare}
            title="Nowa wiadomość"
            description="Wiadomość będzie widoczna dla wybranych rodziców w panelu „Moje dzieci”."
            className="mb-5"
          />
          <NewMessageForm groups={groups} />
        </PanelCard>

        <PanelCard className="overflow-hidden">
          <div className="p-6">
            <SectionTitle
              icon={MessageSquare}
              title={`Wysłane wiadomości (${messages.length})`}
              description="Historia wszystkich wysłanych komunikatów"
            />
          </div>
          <AdminMessageList messages={messages} groups={groups} />
        </PanelCard>
      </div>
    </div>
  );
}
