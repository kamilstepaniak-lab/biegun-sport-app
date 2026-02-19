'use client';

import { useState } from 'react';
import { FileText, Eye, EyeOff, Edit3, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ContractDocument } from '@/components/contract-document';

interface TemplateLibraryItem {
  id: string;
  name: string;
  description: string;
  text: string;
}

interface ContractTemplateLibraryProps {
  templates: TemplateLibraryItem[];
}

export function ContractTemplateLibrary({ templates }: ContractTemplateLibraryProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [editTexts, setEditTexts] = useState<Record<string, string>>(
    Object.fromEntries(templates.map((t) => [t.id, t.text]))
  );

  function toggle(id: string) {
    setOpenId(prev => (prev === id ? null : id));
    setPreviewId(null);
  }

  function togglePreview(id: string) {
    setPreviewId(prev => (prev === id ? null : id));
  }

  return (
    <div className="space-y-3">
      {templates.map((tpl) => {
        const isOpen = openId === tpl.id;
        const isPreview = previewId === tpl.id;
        const text = editTexts[tpl.id] ?? tpl.text;

        return (
          <div
            key={tpl.id}
            className={`bg-white rounded-2xl transition-all duration-200 ${
              isOpen
                ? 'shadow-lg ring-1 ring-purple-200'
                : 'shadow-sm ring-1 ring-gray-100 hover:shadow-md'
            }`}
          >
            {/* Nagłówek szablonu */}
            <button
              className="w-full flex items-center justify-between p-4 text-left"
              onClick={() => toggle(tpl.id)}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-100 shrink-0">
                  <FileText className="h-4 w-4 text-purple-600" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900">{tpl.name}</p>
                    <Badge variant="outline" className="text-purple-600 border-purple-200 text-xs">
                      Szablon
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5 truncate">{tpl.description}</p>
                </div>
              </div>
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors shrink-0 ml-4 ${isOpen ? 'bg-gray-100' : 'bg-gray-50'}`}>
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
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => togglePreview(tpl.id)}
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
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${tpl.name.replace(/\s+/g, '_')}.txt`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="text-gray-500"
                  >
                    Pobierz .txt
                  </Button>
                  <span className="text-xs text-gray-400 ml-2">
                    Możesz skopiować treść i wkleić do edytora wzoru danego wyjazdu
                  </span>
                </div>

                {/* Edytor lub podgląd */}
                {isPreview ? (
                  <div>
                    <ContractDocument text={text} contractNumber="PODGLĄD" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Textarea
                      value={text}
                      onChange={(e) =>
                        setEditTexts((prev) => ({ ...prev, [tpl.id]: e.target.value }))
                      }
                      className="font-mono text-xs leading-relaxed min-h-[500px] resize-y"
                      placeholder="Treść szablonu umowy..."
                    />
                    <p className="text-xs text-gray-400">
                      To jest podgląd szablonu — zmiany nie są zapisywane na stałe.
                      Skopiuj treść i wklej do edytora wzoru konkretnego wyjazdu.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
