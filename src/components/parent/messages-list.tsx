'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { MessageSquare } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/shared';
import { markMessageRead, type AppMessage } from '@/lib/actions/messages';
import { cn } from '@/lib/utils';

interface MessagesListProps {
  initialMessages: AppMessage[];
}

export function ParentMessagesList({ initialMessages }: MessagesListProps) {
  const [messages, setMessages] = useState<AppMessage[]>(initialMessages);
  const [expanded, setExpanded] = useState<AppMessage | null>(null);

  async function handleMarkRead(messageId: string) {
    await markMessageRead(messageId);
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, is_read: true } : m)),
    );
  }

  if (messages.length === 0) {
    return (
      <EmptyState
        icon={MessageSquare}
        title="Brak wiadomości"
        description="Powiadomienia o płatnościach i wyjazdach od organizatora pojawią się tutaj."
      />
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 divide-y divide-gray-50">
        {messages.map((msg) => (
          <button
            key={msg.id}
            onClick={() => {
              setExpanded(msg);
              if (!msg.is_read) handleMarkRead(msg.id);
            }}
            className={cn(
              'w-full text-left px-5 py-4 transition-colors hover:bg-gray-50',
              !msg.is_read && 'bg-blue-50/30',
            )}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-blue-600 text-[11px] font-bold text-white">
                BS
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className={cn('truncate text-sm', msg.is_read ? 'text-gray-700' : 'font-semibold text-gray-900')}>
                    {msg.title}
                  </p>
                  <span className="flex-shrink-0 text-[11px] text-gray-400">
                    {format(new Date(msg.created_at), 'd MMM yyyy', { locale: pl })}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-gray-500">{msg.body}</p>
                {!msg.is_read && (
                  <span className="mt-1.5 inline-block text-[10px] font-semibold text-blue-600">• Nowa</span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      <Dialog open={!!expanded} onOpenChange={(open) => !open && setExpanded(null)}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <div className="mb-1 flex items-center gap-3">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-blue-600">
                <MessageSquare className="h-4 w-4 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base font-semibold leading-tight text-gray-900">
                  {expanded?.title}
                </DialogTitle>
                {expanded && (
                  <p className="mt-0.5 text-xs text-gray-400">
                    {format(new Date(expanded.created_at), 'd MMMM yyyy, HH:mm', { locale: pl })}
                  </p>
                )}
              </div>
            </div>
          </DialogHeader>
          <div className="mt-2 max-h-[60vh] overflow-y-auto whitespace-pre-wrap pr-1 text-sm leading-relaxed text-gray-700">
            {expanded?.body}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
