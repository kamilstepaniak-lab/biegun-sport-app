import { MessageSquare } from 'lucide-react';

import { ParentPageHeader } from '@/components/parent/parent-page-header';
import { ParentMessagesList } from '@/components/parent/messages-list';
import { getMessagesForParent } from '@/lib/actions/messages';

export default async function ParentMessagesPage() {
  const messages = await getMessagesForParent();

  return (
    <div className="space-y-6">
      <ParentPageHeader
        icon={MessageSquare}
        title="Wiadomości"
        description="Powiadomienia i ogłoszenia od organizatora o płatnościach, wyjazdach i sprawach klubu."
        note="Kliknij wiadomość, aby przeczytać pełną treść."
      />

      <ParentMessagesList initialMessages={messages} />
    </div>
  );
}
