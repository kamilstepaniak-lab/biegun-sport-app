'use client';

import { useState } from 'react';
import { Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

import { deleteMessage } from '@/lib/actions/messages';

export function DeleteMessageButton({ messageId }: { messageId: string }) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    if (!confirm('Czy na pewno chcesz usunąć tę wiadomość?')) return;
    setIsLoading(true);
    try {
      const result = await deleteMessage(messageId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Wiadomość usunięta');
        router.refresh();
      }
    } catch {
      toast.error('Wystąpił błąd');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={isLoading}
      className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
      title="Usuń wiadomość"
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Trash2 className="h-4 w-4" />
      )}
    </button>
  );
}
