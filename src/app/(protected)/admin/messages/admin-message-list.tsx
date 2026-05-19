'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { MessageSquare, Eye, Pencil, Loader2, Check, X, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

import type { Group } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  updateMessage,
  getMessageReadDetails,
  type AdminMessage,
  type MessageReadDetail,
} from '@/lib/actions/messages';
import { MessageGroupPicker } from './message-group-picker';
import { DeleteMessageButton } from './delete-message-button';

function pluralReads(n: number): string {
  if (n === 1) return 'odczytanie';
  const last = n % 10;
  const lastTwo = n % 100;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return 'odczytania';
  return 'odczytań';
}

function targetLabel(message: AdminMessage, groups: Group[]): string {
  if (!message.target_group_ids || message.target_group_ids.length === 0) {
    return 'Wszyscy rodzice';
  }
  const names = message.target_group_ids
    .map((id) => groups.find((g) => g.id === id)?.name)
    .filter(Boolean) as string[];
  return names.length > 0 ? names.join(', ') : `${message.target_group_ids.length} grup`;
}

export function AdminMessageList({
  messages,
  groups,
}: {
  messages: AdminMessage[];
  groups: Group[];
}) {
  const [editing, setEditing] = useState<AdminMessage | null>(null);
  const [statsFor, setStatsFor] = useState<AdminMessage | null>(null);

  if (messages.length === 0) {
    return (
      <div className="py-12 text-center text-gray-400 text-sm">
        <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p>Nie wysłano jeszcze żadnych wiadomości</p>
      </div>
    );
  }

  return (
    <>
      <div className="divide-y divide-gray-50">
        {messages.map((msg) => (
          <div key={msg.id} className="flex items-start gap-4 px-6 py-4 hover:bg-gray-50/50">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-medium text-gray-900 text-sm truncate">{msg.title}</h4>
              </div>
              <p className="text-xs text-gray-500 line-clamp-2 mb-2">{msg.body}</p>
              <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-gray-400">
                <span>{format(new Date(msg.created_at), 'd MMM yyyy, HH:mm', { locale: pl })}</span>
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {targetLabel(msg, groups)}
                </span>
                <button
                  onClick={() => setStatsFor(msg)}
                  className="flex items-center gap-1 hover:text-amber-600 transition-colors"
                >
                  <Eye className="h-3 w-3" />
                  {msg.read_count} / {msg.audience_count} {pluralReads(msg.read_count)}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setEditing(msg)}
                className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-amber-50 text-gray-400 hover:text-amber-600 transition-colors"
                title="Edytuj wiadomość"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <DeleteMessageButton messageId={msg.id} />
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <EditMessageDialog
          message={editing}
          groups={groups}
          onClose={() => setEditing(null)}
        />
      )}
      {statsFor && (
        <ReadStatsDialog message={statsFor} onClose={() => setStatsFor(null)} />
      )}
    </>
  );
}

function EditMessageDialog({
  message,
  groups,
  onClose,
}: {
  message: AdminMessage;
  groups: Group[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(message.title);
  const [body, setBody] = useState(message.body);
  const [groupIds, setGroupIds] = useState<string[]>(message.target_group_ids ?? []);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSave() {
    if (!title.trim() || !body.trim()) {
      toast.error('Wypełnij tytuł i treść wiadomości');
      return;
    }
    setIsLoading(true);
    try {
      const result = await updateMessage(message.id, title, body, groupIds);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Wiadomość zaktualizowana');
        onClose();
        router.refresh();
      }
    } catch {
      toast.error('Wystąpił nieoczekiwany błąd');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !isLoading && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edytuj wiadomość</DialogTitle>
          <DialogDescription>
            Zmiany zobaczą wszyscy rodzice. Historia odczytań zostaje zachowana.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Tytuł *</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isLoading}
              maxLength={200}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Treść *</label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={isLoading}
              rows={5}
              maxLength={5000}
            />
          </div>
          <MessageGroupPicker
            groups={groups}
            selected={groupIds}
            onChange={setGroupIds}
            disabled={isLoading}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Anuluj
          </Button>
          <Button onClick={handleSave} disabled={isLoading || !title.trim() || !body.trim()}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Zapisz zmiany
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReadStatsDialog({
  message,
  onClose,
}: {
  message: AdminMessage;
  onClose: () => void;
}) {
  const [details, setDetails] = useState<MessageReadDetail[] | null>(null);

  useEffect(() => {
    getMessageReadDetails(message.id)
      .then(setDetails)
      .catch(() => setDetails([]));
  }, [message.id]);

  const readCount = details?.filter((d) => d.is_read).length ?? 0;
  const total = details?.length ?? message.audience_count;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="truncate">{message.title}</DialogTitle>
          <DialogDescription>
            Przeczytało {readCount} z {total} rodziców
          </DialogDescription>
        </DialogHeader>
        {details === null ? (
          <div className="py-10 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : details.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">Brak odbiorców</p>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto divide-y divide-gray-50">
            {details.map((d) => (
              <div key={d.user_id} className="flex items-center gap-3 py-2">
                <span
                  className={
                    'flex h-6 w-6 items-center justify-center rounded-full flex-shrink-0 ' +
                    (d.is_read ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400')
                  }
                >
                  {d.is_read ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-800 truncate">{d.name}</p>
                  <p className="text-xs text-gray-400 truncate">{d.email}</p>
                </div>
                {d.is_read && d.read_at && (
                  <span className="text-[11px] text-gray-400 flex-shrink-0">
                    {format(new Date(d.read_at), 'd MMM, HH:mm', { locale: pl })}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
