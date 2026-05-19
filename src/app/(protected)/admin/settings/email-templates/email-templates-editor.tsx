'use client';

import { useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyleKit } from '@tiptap/extension-text-style';
import DOMPurify from 'dompurify';
import { toast } from 'sonner';
import {
  Mail,
  Save,
  Eye,
  EyeOff,
  Bold,
  Italic,
  Underline,
  List,
  Heading2,
  Link as LinkIcon,
  Send,
  ChevronDown,
  ChevronUp,
  RotateCcw,
} from 'lucide-react';

import { updateEmailTemplate, sendTestEmail, previewEmailTemplate } from '@/lib/actions/email-templates';
import type { EmailTemplate } from '@/lib/actions/email-templates';

interface Props {
  templates: EmailTemplate[];
}

const TEMPLATE_LABELS: Record<string, { label: string; icon: string; desc: string; trigger: string }> = {
  welcome: {
    label: 'Powitalny', icon: '👋',
    desc: 'Wysyłany gdy rodzic zakłada konto',
    trigger: 'wysyłany automatycznie zaraz po założeniu konta przez rodzica (tylko gdy nie jest wymagane potwierdzenie adresu e-mail — w przeciwnym razie rodzic dostaje wyłącznie maila weryfikacyjnego Supabase).',
  },
  trip_info: {
    label: 'Info o wyjeździe', icon: '✈️',
    desc: 'Bazowy szablon wysyłki info o wyjeździe do grupy (zmienne: {{wyjazd}}, {{szczegoly_wyjazdu}})',
    trigger: 'wysyłany ręcznie przez administratora — masowa wysyłka informacji o wyjeździe do wybranej grupy rodziców z poziomu panelu wyjazdu.',
  },
  registration: {
    label: 'Potwierdzenie zapisu', icon: '✅',
    desc: 'Wysyłany gdy rodzic potwierdzi że dziecko jedzie',
    trigger: 'wysyłany automatycznie po potwierdzeniu zapisu na wyjazd — gdy rodzic potwierdzi udział dziecka w aplikacji albo gdy administrator ręcznie doda uczestnika do wyjazdu.',
  },
  payment_confirmed: {
    label: 'Płatność potwierdzona', icon: '💳',
    desc: 'Wysyłany gdy admin oznaczy płatność jako opłaconą',
    trigger: 'wysyłany automatycznie w chwili, gdy administrator oznaczy płatność jako opłaconą (lub jej status zmieni się na opłacony) w panelu /admin/payments.',
  },
  payment_reminder: {
    label: 'Przypomnienie o płatności', icon: '⏰',
    desc: 'Wysyłany automatycznie 3 dni przed terminem płatności',
    trigger: 'wysyłany automatycznie codziennie o 7:00 do rodziców, którym do terminu płatności zostały dokładnie 3 dni, a płatność nadal nie jest opłacona.',
  },
};

const COLORS = [
  { name: 'Domyślny', value: null },
  { name: 'Niebieski', value: '#1e56d9' },
  { name: 'Zielony', value: '#16a34a' },
  { name: 'Pomarańczowy', value: '#ea580c' },
  { name: 'Czerwony', value: '#dc2626' },
  { name: 'Szary', value: '#6b7280' },
];

const FONT_SIZES = [
  { name: 'Normalny', value: '' },
  { name: 'Mały', value: '13px' },
  { name: 'Duży', value: '20px' },
  { name: 'Bardzo duży', value: '24px' },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pl-PL', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function TemplateEditor({
  template,
  onSaved,
}: {
  template: EmailTemplate;
  onSaved: () => void;
}) {
  // Stan „ostatnio zapisanej" wersji — używany przez przycisk Przywróć
  const [savedSubject, setSavedSubject] = useState(template.subject);
  const [savedBody, setSavedBody] = useState(template.body_html);
  const [savedAt, setSavedAt] = useState(template.updated_at);

  const [subject, setSubject] = useState(template.subject);
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewMode, setPreviewMode] = useState<'draft' | 'sample'>('draft');
  const [sampleHtml, setSampleHtml] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: { openOnClick: false } }),
      TextStyleKit.configure({
        backgroundColor: false,
        fontFamily: false,
        lineHeight: false,
      }),
    ],
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
      const html = editor.getHTML();
      const result = await updateEmailTemplate(template.id, subject, html);
      if (result.error) {
        toast.error(result.error);
      } else {
        setSavedSubject(subject);
        setSavedBody(html);
        setSavedAt(new Date().toISOString());
        toast.success('Szablon zapisany');
        onSaved();
      }
    } catch {
      toast.error('Wystąpił błąd');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSendTest() {
    if (!editor) return;
    setIsSendingTest(true);
    try {
      const result = await sendTestEmail(subject, editor.getHTML());
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Wysłano testową wiadomość na ${result.email}`);
      }
    } catch {
      toast.error('Nie udało się wysłać wiadomości testowej');
    } finally {
      setIsSendingTest(false);
    }
  }

  function handleReset() {
    setSubject(savedSubject);
    editor?.commands.setContent(savedBody);
    toast.info('Przywrócono ostatnio zapisaną wersję');
  }

  function handleSetLink() {
    if (!editor) return;
    const previous = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Adres linku (URL):', previous ?? 'https://');
    if (url === null) return;
    if (url.trim() === '') {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
  }

  async function loadSamplePreview() {
    if (!editor) return;
    setPreviewMode('sample');
    setShowPreview(true);
    setIsRendering(true);
    try {
      const res = await previewEmailTemplate(subject, editor.getHTML());
      if ('error' in res) {
        toast.error(res.error);
        setSampleHtml(null);
      } else {
        setSampleHtml(res.html);
      }
    } catch {
      toast.error('Nie udało się wygenerować podglądu');
      setSampleHtml(null);
    } finally {
      setIsRendering(false);
    }
  }

  const previewHtml = editor?.getHTML() ?? '';
  const btn = (active: boolean) =>
    `p-1.5 rounded-lg hover:bg-gray-200 transition-colors ${active ? 'bg-gray-200' : ''}`;

  return (
    <div className="space-y-3">
      {/* Temat */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Temat wiadomości</label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full h-11 px-3 rounded-xl bg-gray-50 ring-1 ring-gray-200 border-0 text-base md:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-300 transition-all"
          placeholder="Temat e-maila..."
        />
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 rounded-xl ring-1 ring-gray-200 flex-wrap">
        <button type="button" onClick={() => editor?.chain().focus().toggleBold().run()} className={btn(!!editor?.isActive('bold'))} title="Pogrubienie">
          <Bold className="h-3.5 w-3.5 text-gray-600" />
        </button>
        <button type="button" onClick={() => editor?.chain().focus().toggleItalic().run()} className={btn(!!editor?.isActive('italic'))} title="Kursywa">
          <Italic className="h-3.5 w-3.5 text-gray-600" />
        </button>
        <button type="button" onClick={() => editor?.chain().focus().toggleUnderline().run()} className={btn(!!editor?.isActive('underline'))} title="Podkreślenie">
          <Underline className="h-3.5 w-3.5 text-gray-600" />
        </button>
        <button type="button" onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} className={btn(!!editor?.isActive('heading', { level: 2 }))} title="Nagłówek">
          <Heading2 className="h-3.5 w-3.5 text-gray-600" />
        </button>
        <button type="button" onClick={() => editor?.chain().focus().toggleBulletList().run()} className={btn(!!editor?.isActive('bulletList'))} title="Lista">
          <List className="h-3.5 w-3.5 text-gray-600" />
        </button>
        <button type="button" onClick={handleSetLink} className={btn(!!editor?.isActive('link'))} title="Wstaw / edytuj link">
          <LinkIcon className="h-3.5 w-3.5 text-gray-600" />
        </button>

        <div className="w-px h-4 bg-gray-300 mx-1" />

        {/* Kolor tekstu */}
        <div className="flex items-center gap-0.5">
          {COLORS.map((c) => (
            <button
              key={c.name}
              type="button"
              title={`Kolor: ${c.name}`}
              onClick={() =>
                c.value
                  ? editor?.chain().focus().setColor(c.value).run()
                  : editor?.chain().focus().unsetColor().run()
              }
              className="h-5 w-5 rounded-md ring-1 ring-gray-300 hover:scale-110 transition-transform flex items-center justify-center"
              style={{ background: c.value ?? '#ffffff' }}
            >
              {!c.value && <span className="text-[10px] text-gray-400">A</span>}
            </button>
          ))}
        </div>

        <div className="w-px h-4 bg-gray-300 mx-1" />

        {/* Rozmiar tekstu */}
        <select
          title="Rozmiar tekstu"
          onChange={(e) => {
            const v = e.target.value;
            if (v) editor?.chain().focus().setFontSize(v).run();
            else editor?.chain().focus().unsetFontSize().run();
            e.target.selectedIndex = 0;
          }}
          className="text-xs bg-white ring-1 ring-gray-200 rounded-lg px-1.5 py-1 text-gray-600 focus:outline-none"
        >
          {FONT_SIZES.map((s) => (
            <option key={s.name} value={s.value}>{s.name}</option>
          ))}
        </select>

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
            onClick={() => {
              if (showPreview) setShowPreview(false);
              else loadSamplePreview();
            }}
            className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-gray-200 text-xs text-gray-500 transition-colors"
          >
            {showPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {showPreview ? 'Edytor' : 'Podgląd maila'}
          </button>
        </div>
      </div>

      {/* Edytor lub podgląd */}
      {showPreview && (
        <div className="flex items-center gap-1 -mb-1">
          <button
            type="button"
            onClick={() => setPreviewMode('draft')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${previewMode === 'draft' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
          >
            Szablon roboczy
          </button>
          <button
            type="button"
            onClick={loadSamplePreview}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${previewMode === 'sample' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
          >
            Z przykładowymi danymi
          </button>
          {previewMode === 'sample' && (
            <button
              type="button"
              onClick={loadSamplePreview}
              className="ml-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
              title="Odśwież podgląd"
            >
              ↻ Odśwież
            </button>
          )}
        </div>
      )}
      <div className="rounded-xl ring-1 ring-gray-200 overflow-hidden bg-white">
        {!showPreview ? (
          <EditorContent editor={editor} />
        ) : previewMode === 'draft' ? (
          <div
            className="p-6 prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(previewHtml) }}
          />
        ) : isRendering ? (
          <div className="p-12 text-center text-sm text-gray-400">Generowanie podglądu...</div>
        ) : sampleHtml ? (
          <iframe
            srcDoc={sampleHtml}
            title="Podgląd maila z przykładowymi danymi"
            sandbox=""
            className="w-full h-[560px] border-0 bg-white"
          />
        ) : (
          <div className="p-12 text-center text-sm text-gray-400">Brak podglądu</div>
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
      <div className="flex items-center justify-between pt-1 gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Przywróć zapisaną
          </button>
          <span className="text-xs text-gray-300">·</span>
          <span className="text-xs text-gray-400">Ostatnia zmiana: {formatDate(savedAt)}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSendTest}
            disabled={isSendingTest}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 disabled:opacity-50 transition-all"
          >
            <Send className="h-4 w-4" />
            {isSendingTest ? 'Wysyłanie...' : 'Wyślij test do siebie'}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-all"
          >
            <Save className="h-4 w-4" />
            {isSaving ? 'Zapisywanie...' : 'Zapisz szablon'}
          </button>
        </div>
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
        const meta = TEMPLATE_LABELS[template.id] ?? { label: template.name, icon: '📧', desc: '', trigger: '' };
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
                {meta.trigger && (
                  <p className="text-xs lowercase text-gray-400 mb-4">
                    <span className="font-medium not-italic">kiedy wychodzi:</span> {meta.trigger}
                  </p>
                )}
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
