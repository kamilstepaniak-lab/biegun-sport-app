'use client';

import { useState, useTransition } from 'react';
import { Plus, X, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { createDynamicDocument } from '@/lib/actions/documents';

export function AddDocumentDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClose() {
    setIsOpen(false);
    setTitle('');
    setContent('');
    setError(null);
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await createDynamicDocument(title, content);
      if (result.error) {
        setError(result.error);
      } else {
        handleClose();
      }
    });
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-200 p-4 text-sm text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors"
      >
        <Plus className="h-4 w-4" />
        Dodaj dokument
      </button>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg ring-1 ring-blue-200 p-4 space-y-4">
      {/* Nagłówek */}
      <div className="flex items-center justify-between">
        <p className="font-semibold text-gray-900">Nowy dokument</p>
        <button
          onClick={handleClose}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="h-px bg-gray-100" />

      {/* Formularz */}
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="new_doc_title">Tytuł dokumentu</Label>
          <Input
            id="new_doc_title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="np. Klauzula RODO, Zasady płatności..."
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new_doc_content">Treść</Label>
          <Textarea
            id="new_doc_content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Wpisz treść dokumentu..."
            className="font-mono text-xs leading-relaxed min-h-[300px] resize-y"
          />
        </div>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex items-center gap-2 pt-1">
        <Button
          onClick={handleSave}
          disabled={isPending || !title.trim()}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Save className="mr-2 h-3.5 w-3.5" />
          {isPending ? 'Zapisuję...' : 'Zapisz dokument'}
        </Button>
        <Button variant="ghost" onClick={handleClose} disabled={isPending}>
          Anuluj
        </Button>
      </div>
    </div>
  );
}
