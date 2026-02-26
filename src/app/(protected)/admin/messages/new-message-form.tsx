'use client';

import { useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { createMessage } from '@/lib/actions/messages';

export function NewMessageForm() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      toast.error('Wypełnij tytuł i treść wiadomości');
      return;
    }

    setIsLoading(true);
    try {
      const result = await createMessage(title, body);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Wiadomość została wysłana do wszystkich rodziców');
        setTitle('');
        setBody('');
      }
    } catch {
      toast.error('Wystąpił nieoczekiwany błąd');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">Tytuł *</label>
        <Input
          placeholder="np. Informacja o wyjeździe zimowym"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={isLoading}
          maxLength={200}
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">Treść *</label>
        <Textarea
          placeholder="Treść wiadomości widocznej dla rodziców..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={isLoading}
          rows={5}
        />
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={isLoading || !title.trim() || !body.trim()}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Wysyłanie...
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Wyślij wiadomość
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
