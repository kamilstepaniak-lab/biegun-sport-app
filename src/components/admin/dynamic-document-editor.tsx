'use client';

import { useState, useTransition } from 'react';
import { FileText, ChevronDown, ChevronUp, Eye, Edit3, Trash2, Save, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { updateDynamicDocument, deleteDynamicDocument } from '@/lib/actions/documents';

interface DynamicDocumentEditorProps {
  id: string;
  initialTitle: string;
  initialContent: string;
}

export function DynamicDocumentEditor({
  id,
  initialTitle,
  initialContent,
}: DynamicDocumentEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPreview, setIsPreview] = useState(true);
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [savedTitle, setSavedTitle] = useState(initialTitle);
  const [savedContent, setSavedContent] = useState(initialContent);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isDirty = content !== savedContent || title !== savedTitle;

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await updateDynamicDocument(id, title, content);
      if (result.error) {
        setError(result.error);
      } else {
        setSavedTitle(title);
        setSavedContent(content);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    });
  }

  function handleDelete() {
    if (!confirm(`Usunąć dokument "${savedTitle}"? Tej operacji nie można cofnąć.`)) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteDynamicDocument(id);
      if (result.error) setError(result.error);
      // po usunięciu strona się odświeży przez revalidatePath
    });
  }

  return (
    <div
      className={`bg-white rounded-2xl transition-all duration-200 ${
        isOpen
          ? 'shadow-lg ring-1 ring-blue-200'
          : 'shadow-sm ring-1 ring-gray-100 hover:shadow-md'
      }`}
    >
      {/* Nagłówek */}
      <button
        className="w-full flex items-center justify-between p-4 text-left"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 shrink-0">
            <FileText className="h-4 w-4 text-white" />
          </div>
          <p className="font-semibold text-gray-900">{savedTitle}</p>
        </div>
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors shrink-0 ml-4 ${
            isOpen ? 'bg-gray-100' : 'bg-gray-50'
          }`}
        >
          {isOpen ? (
            <ChevronUp className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-500" />
          )}
        </div>
      </button>

      {/* Treść rozwinięta */}
      {isOpen && (
        <div className="px-4 pb-4 space-y-4">
          <div className="h-px bg-gray-100" />

          {/* Toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPreview((prev) => !prev)}
            >
              {isPreview ? (
                <>
                  <Edit3 className="mr-2 h-3.5 w-3.5" />
                  Edytuj
                </>
              ) : (
                <>
                  <Eye className="mr-2 h-3.5 w-3.5" />
                  Podgląd
                </>
              )}
            </Button>

            {!isPreview && (
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isPending || !isDirty}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {saved ? (
                  <>
                    <Check className="mr-2 h-3.5 w-3.5" />
                    Zapisano
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-3.5 w-3.5" />
                    {isPending ? 'Zapisuję...' : 'Zapisz'}
                  </>
                )}
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={isPending}
              className="text-red-500 hover:text-red-700 hover:bg-red-50 ml-auto"
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              Usuń
            </Button>

            {error && <span className="text-xs text-red-600">{error}</span>}
          </div>

          {/* Tytuł (tylko w trybie edycji) */}
          {!isPreview && (
            <div className="space-y-1.5">
              <Label htmlFor={`title_${id}`}>Tytuł</Label>
              <Input
                id={`title_${id}`}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
          )}

          {/* Podgląd lub edytor treści */}
          {isPreview ? (
            <div className="bg-gray-50 rounded-xl p-5 max-h-[600px] overflow-y-auto">
              <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans leading-relaxed">
                {content}
              </pre>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor={`content_${id}`}>Treść</Label>
              <Textarea
                id={`content_${id}`}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="font-mono text-xs leading-relaxed min-h-[400px] resize-y"
              />
              {isDirty && (
                <p className="text-xs text-amber-600">
                  Masz niezapisane zmiany — kliknij &quot;Zapisz&quot; aby je zachować.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
