'use client';

import { useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { toast } from 'sonner';
import {
  Mail,
  Save,
  Eye,
  EyeOff,
  Bold,
  Italic,
  List,
  Heading2,
  ChevronDown,
  ChevronUp,
  RotateCcw,
} from 'lucide-react';

import { updateEmailTemplate } from '@/lib/actions/email-templates';
import type { EmailTemplate } from '@/lib/actions/email-templates';

interface Props {
  templates: EmailTemplate[];
}

const TEMPLATE_LABELS: Record<string, { label: string; icon: string; desc: string }> = {
  welcome:           { label: 'Powitalny',                   icon: '👋', desc: 'Wysyłany gdy rodzic zakłada konto' },
  trip_info:         { label: 'Info o wyjeździe',            icon: '✈️', desc: 'Bazowy szablon wysyłki info o wyjeździe do grupy (zmienne: {{wyjazd}}, {{szczegoly_wyjazdu}})' },
  registration:      { label: 'Potwierdzenie zapisu',        icon: '✅', desc: 'Wysyłany gdy rodzic potwierdzi że dziecko jedzie' },
  payment_confirmed: { label: 'Płatność potwierdzona',       icon: '💳', desc: 'Wysyłany gdy admin oznaczy płatność jako opłaconą' },
  payment_reminder:  { label: 'Przypomnienie o płatności',   icon: '⏰', desc: 'Wysyłany automatycznie 3 dni przed terminem płatności' },
};

function TemplateEditor({
  template,
  onSaved,
}: {
  template: EmailTemplate;
  onSaved: () => void;
}) {
  const [subject, setSubject] = useState(template.subject);
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const editor = useEditor({
    extensions: [StarterKit],
    content: template.body_html,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[180px] p-4',
      },
    },
  });

  async function handleSave() {
    if (!editor) return;
    setIsSaving(true);
    try {
      const result = await updateEmailTemplate(
        template.id,
        subject,
        editor.getHTML(),
      );
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Szablon zapisany');
        onSaved();
      }
    } catch {
      toast.error('Wystąpił błąd');
    } finally {
      setIsSaving(false);
    }
  }

  function handleReset() {
    setSubject(template.subject);
    editor?.commands.setContent(template.body_html);
    toast.info('Przywrócono ostatnio zapisaną wersję');
  }

  const previewHtml = editor?.getHTML() ?? '';

  return (
    <div className="space-y-3">
      {/* Temat */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Temat wiadomości</label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full h-10 px-3 rounded-xl bg-gray-50 ring-1 ring-gray-200 border-0 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-300 transition-all"
          placeholder="Temat e-maila..."
        />
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 rounded-xl ring-1 ring-gray-200 flex-wrap">
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleBold().run()}
          className={`p-1.5 rounded-lg hover:bg-gray-200 transition-colors ${editor?.isActive('bold') ? 'bg-gray-200' : ''}`}
          title="Pogrubienie"
        >
          <Bold className="h-3.5 w-3.5 text-gray-600" />
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          className={`p-1.5 rounded-lg hover:bg-gray-200 transition-colors ${editor?.isActive('italic') ? 'bg-gray-200' : ''}`}
          title="Kursywa"
        >
          <Italic className="h-3.5 w-3.5 text-gray-600" />
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`p-1.5 rounded-lg hover:bg-gray-200 transition-colors ${editor?.isActive('heading', { level: 2 }) ? 'bg-gray-200' : ''}`}
          title="Nagłówek"
        >
          <Heading2 className="h-3.5 w-3.5 text-gray-600" />
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          className={`p-1.5 rounded-lg hover:bg-gray-200 transition-colors ${editor?.isActive('bulletList') ? 'bg-gray-200' : ''}`}
          title="Lista"
        >
          <List className="h-3.5 w-3.5 text-gray-600" />
        </button>

        <div className="w-px h-4 bg-gray-300 mx-1" />

        {/* Zmienne do wklejenia */}
        {template.variables.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-xs text-gray-400">Wstaw:</span>
            {template.variables.map((v) => (
              <button
                key={v.key}
                type="button"
                title={v.desc}
                onClick={() => editor?.chain().focus().insertContent(v.key).run()}
                className="px-2 py-0.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-mono transition-colors"
              >
                {v.key}
              </button>
            ))}
          </div>
        )}

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowPreview(v => !v)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-gray-200 text-xs text-gray-500 transition-colors"
          >
            {showPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {showPreview ? 'Edytor' : 'Podgląd'}
          </button>
        </div>
      </div>

      {/* Edytor lub podgląd */}
      <div className="rounded-xl ring-1 ring-gray-200 overflow-hidden bg-white">
        {showPreview ? (
          <div
            className="p-6 prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        ) : (
          <EditorContent editor={editor} />
        )}
      </div>

      {/* Zmienne — opis */}
      {template.variables.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {template.variables.map((v) => (
            <span key={v.key} className="text-xs text-gray-400">
              <span className="font-mono text-gray-600">{v.key}</span> — {v.desc}
            </span>
          ))}
        </div>
      )}

      {/* Akcje */}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={handleReset}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Przywróć zapisaną
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 disabled:opacity-50 transition-all"
        >
          <Save className="h-4 w-4" />
          {isSaving ? 'Zapisywanie...' : 'Zapisz szablon'}
        </button>
      </div>
    </div>
  );
}

export function EmailTemplatesEditor({ templates }: Props) {
  const [openId, setOpenId] = useState<string | null>(templates[0]?.id ?? null);
  const [savedAt, setSavedAt] = useState<Record<string, string>>({});

  return (
    <div className="space-y-3">
      {templates.map((template) => {
        const meta = TEMPLATE_LABELS[template.id] ?? { label: template.name, icon: '📧', desc: '' };
        const isOpen = openId === template.id;

        return (
          <div key={template.id} className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 overflow-hidden">
            {/* Header */}
            <button
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
              onClick={() => setOpenId(isOpen ? null : template.id)}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-lg">
                  {meta.icon}
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-gray-900">{meta.label}</p>
                  <p className="text-xs text-gray-400">{meta.desc}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {savedAt[template.id] && (
                  <span className="text-xs text-emerald-600 flex items-center gap-1">
                    <Mail className="h-3 w-3" /> Zapisano
                  </span>
                )}
                {isOpen
                  ? <ChevronUp className="h-4 w-4 text-gray-400" />
                  : <ChevronDown className="h-4 w-4 text-gray-400" />
                }
              </div>
            </button>

            {/* Edytor */}
            {isOpen && (
              <div className="border-t border-gray-100 px-5 py-5">
                <TemplateEditor
                  template={template}
                  onSaved={() => setSavedAt(prev => ({ ...prev, [template.id]: new Date().toISOString() }))}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
