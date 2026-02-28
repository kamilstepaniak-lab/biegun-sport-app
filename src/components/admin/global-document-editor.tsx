'use client';

import { useState, useTransition } from 'react';
import { FileText, ChevronDown, ChevronUp, Eye, Edit3, RotateCcw, Save, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { saveGlobalDocument, resetGlobalDocument } from '@/lib/actions/documents';

interface GlobalDocumentEditorProps {
  id: string;
  title: string;
  initialContent: string;
  defaultContent: string;
}

export function GlobalDocumentEditor({
  id,
  title,
  initialContent,
  defaultContent,
}: GlobalDocumentEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPreview, setIsPreview] = useState(true);
  const [content, setContent] = useState(initialContent);
  const [savedContent, setSavedContent] = useState(initialContent);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isDirty = content !== savedContent;
  const isCustomized = savedContent !== defaultContent;

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await saveGlobalDocument(id, content);
      if (result.error) {
        setError(result.error);
      } else {
        setSavedContent(content);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    });
  }

  function handleReset() {
    if (!confirm('Przywrócić domyślną treść dokumentu? Twoje zmiany zostaną utracone.')) return;
    setError(null);
    startTransition(async () => {
      const result = await resetGlobalDocument(id);
      if (result.error) {
        setError(result.error);
      } else {
        setContent(defaultContent);
        setSavedContent(defaultContent);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
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
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 shrink-0">
            <FileText className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-gray-900">{title}</p>
              {isCustomized ? (
                <Badge variant="outline" className="text-blue-600 border-blue-200 text-xs">
                  Zmodyfikowany
                </Badge>
              ) : (
                <Badge variant="outline" className="text-gray-400 border-gray-200 text-xs">
                  Domyślny
                </Badge>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              Dokument widoczny dla rodziców w zakładce Dokumenty
            </p>
          </div>
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
              <>
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

                {isCustomized && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleReset}
                    disabled={isPending}
                    className="text-gray-500"
                  >
                    <RotateCcw className="mr-2 h-3.5 w-3.5" />
                    Przywróć domyślny
                  </Button>
                )}
              </>
            )}

            {error && (
              <span className="text-xs text-red-600 ml-2">{error}</span>
            )}
          </div>

          {/* Podgląd lub edytor */}
          {isPreview ? (
            <div className="bg-gray-50 rounded-xl p-5 max-h-[600px] overflow-y-auto">
              <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans leading-relaxed">
                {content}
              </pre>
            </div>
          ) : (
            <div className="space-y-2">
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="font-mono text-xs leading-relaxed min-h-[600px] resize-y"
                placeholder="Treść dokumentu..."
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
