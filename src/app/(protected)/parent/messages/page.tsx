import { PageHeader } from '@/components/shared';
import { ParentMessagesList } from '@/components/parent/messages-list';
import { getMessagesForParent } from '@/lib/actions/messages';

export default async function ParentMessagesPage() {
  const messages = await getMessagesForParent();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Wiadomości"
        description="Powiadomienia i ogłoszenia od organizatora — o płatnościach, wyjazdach i bieżących sprawach klubu. Kliknij wiadomość, aby przeczytać całość."
      />

      <ParentMessagesList initialMessages={messages} />
    </div>
  );
}
