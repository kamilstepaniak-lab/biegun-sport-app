'use client';

import { useState } from 'react';
import { Copy, ExternalLink, ToggleLeft, ToggleRight, Code2, Eye } from 'lucide-react';
import { createEmbedForm, updateEmbedForm } from '@/lib/actions/embed-forms';

interface EmbedForm {
  id: string;
  public_key: string;
  is_active: boolean;
  title: string | null;
  description: string | null;
  button_text: string;
  success_message: string;
  require_phone: boolean;
  require_child_birth_date: boolean;
  max_registrations: number | null;
  current_registrations: number;
}

interface Props {
  tripId: string;
  tripTitle: string;
  embedForm: EmbedForm | null;
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || '';

export function EmbedFormAdmin({ tripId, tripTitle, embedForm: initialForm }: Props) {
  const [form, setForm] = useState<EmbedForm | null>(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [tab, setTab] = useState<'iframe' | 'api'>('iframe');

  const [settings, setSettings] = useState({
    title: initialForm?.title || '',
    description: initialForm?.description || '',
    buttonText: initialForm?.button_text || 'Zapisz dziecko',
    successMessage: initialForm?.success_message || 'Dziękujemy za rejestrację! Skontaktujemy się wkrótce.',
    requirePhone: initialForm?.require_phone ?? true,
    requireBirthDate: initialForm?.require_child_birth_date ?? false,
    maxRegistrations: initialForm?.max_registrations?.toString() || '',
  });

  async function handleCreate() {
    setSaving(true);
    setError(null);
    const result = await createEmbedForm(tripId, settings);
    if (result.error) {
      setError(result.error);
    } else if (result.form) {
      setForm(result.form as EmbedForm);
    }
    setSaving(false);
  }

  async function handleUpdate() {
    if (!form) return;
    setSaving(true);
    setError(null);
    const result = await updateEmbedForm(form.id, settings);
    if (result.error) {
      setError(result.error);
    } else if (result.form) {
      setForm(result.form as EmbedForm);
    }
    setSaving(false);
  }

  async function toggleActive() {
    if (!form) return;
    const result = await updateEmbedForm(form.id, { isActive: !form.is_active });
    if (result.form) setForm(result.form as EmbedForm);
  }

  async function copyToClipboard(text: string, key: string) {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : APP_URL;
  const embedUrl = form ? `${baseUrl}/embed/${form.public_key}` : '';
  const iframeCode = form
    ? `<iframe\n  src="${embedUrl}"\n  width="100%"\n  height="600"\n  frameborder="0"\n  style="border: none; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);"\n></iframe>`
    : '';

  const jsCode = form
    ? `<!-- Formularz zapisu: ${tripTitle} -->
<div id="bs-form-${form.public_key}"></div>
<script>
(function() {
  var el = document.getElementById('bs-form-${form.public_key}');
  var iframe = document.createElement('iframe');
  iframe.src = '${embedUrl}';
  iframe.style.cssText = 'width:100%;border:none;min-height:500px;';
  iframe.onload = function() {
    iframe.contentWindow.postMessage('getHeight', '*');
  };
  window.addEventListener('message', function(e) {
    if (e.data && e.data.bsFormHeight) iframe.style.height = e.data.bsFormHeight + 'px';
  });
  el.appendChild(iframe);
})();
</script>`
    : '';

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Formularz embed</h1>
        <p className="text-sm text-gray-500 mt-1">
          Wygeneruj formularz, który możesz wstawić na dowolną stronę (WordPress, Wix, itp.)
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Ustawienia */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Ustawienia formularza</h2>

        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">
              Tytuł (opcjonalnie)
            </label>
            <input
              className="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              placeholder={tripTitle}
              value={settings.title}
              onChange={(e) => setSettings(s => ({ ...s, title: e.target.value }))}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">
              Opis / instrukcje (opcjonalnie)
            </label>
            <textarea
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
              rows={2}
              placeholder="Formularz zapisu na obóz..."
              value={settings.description}
              onChange={(e) => setSettings(s => ({ ...s, description: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Tekst przycisku</label>
              <input
                className="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                value={settings.buttonText}
                onChange={(e) => setSettings(s => ({ ...s, buttonText: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Limit miejsc</label>
              <input
                type="number"
                min="0"
                className="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                placeholder="Bez limitu"
                value={settings.maxRegistrations}
                onChange={(e) => setSettings(s => ({ ...s, maxRegistrations: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">
              Wiadomość po zapisie
            </label>
            <input
              className="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              value={settings.successMessage}
              onChange={(e) => setSettings(s => ({ ...s, successMessage: e.target.value }))}
            />
          </div>

          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.requirePhone}
                onChange={(e) => setSettings(s => ({ ...s, requirePhone: e.target.checked }))}
                className="rounded"
              />
              <span className="text-sm text-gray-700">Wymagaj telefonu</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.requireBirthDate}
                onChange={(e) => setSettings(s => ({ ...s, requireBirthDate: e.target.checked }))}
                className="rounded"
              />
              <span className="text-sm text-gray-700">Wymagaj daty urodzenia dziecka</span>
            </label>
          </div>
        </div>

        {!form ? (
          <button
            onClick={handleCreate}
            disabled={saving}
            className="w-full h-10 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
          >
            {saving ? 'Tworzenie...' : 'Utwórz formularz'}
          </button>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={handleUpdate}
              disabled={saving}
              className="flex-1 h-10 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
            >
              {saving ? 'Zapisywanie...' : 'Zapisz zmiany'}
            </button>
            <button
              onClick={toggleActive}
              className={`flex items-center gap-2 px-4 h-10 text-sm font-medium rounded-xl border transition-colors ${
                form.is_active
                  ? 'border-green-200 text-green-700 bg-green-50 hover:bg-green-100'
                  : 'border-gray-200 text-gray-500 bg-gray-50 hover:bg-gray-100'
              }`}
            >
              {form.is_active ? (
                <><ToggleRight className="h-4 w-4" />Aktywny</>
              ) : (
                <><ToggleLeft className="h-4 w-4" />Nieaktywny</>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Kod embed */}
      {form && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Kod do wstawienia</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">
                Rejestracji: {form.current_registrations}
                {form.max_registrations ? ` / ${form.max_registrations}` : ''}
              </span>
              <a
                href={embedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline flex items-center gap-1"
              >
                <Eye className="h-3.5 w-3.5" />
                Podgląd
              </a>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-100">
            {(['iframe', 'api'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  tab === t
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {t === 'iframe' ? 'Iframe (prosty)' : 'JavaScript (zaawansowany)'}
              </button>
            ))}
          </div>

          {tab === 'iframe' && (
            <div>
              <p className="text-xs text-gray-500 mb-2">
                Wklej w HTML blok w WordPress lub dowolnej stronie:
              </p>
              <div className="relative">
                <pre className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs text-gray-700 overflow-x-auto whitespace-pre-wrap font-mono">
                  {iframeCode}
                </pre>
                <button
                  onClick={() => copyToClipboard(iframeCode, 'iframe')}
                  className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 text-xs bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Copy className="h-3 w-3" />
                  {copied === 'iframe' ? 'Skopiowano!' : 'Kopiuj'}
                </button>
              </div>
            </div>
          )}

          {tab === 'api' && (
            <div>
              <p className="text-xs text-gray-500 mb-2">
                Wersja JavaScript z auto-dopasowaniem wysokości:
              </p>
              <div className="relative">
                <pre className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs text-gray-700 overflow-x-auto whitespace-pre-wrap font-mono">
                  {jsCode}
                </pre>
                <button
                  onClick={() => copyToClipboard(jsCode, 'js')}
                  className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 text-xs bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Copy className="h-3 w-3" />
                  {copied === 'js' ? 'Skopiowano!' : 'Kopiuj'}
                </button>
              </div>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
            <p className="text-xs font-medium text-blue-900 mb-1">Jak używać w WordPress?</p>
            <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
              <li>Przejdź do edycji strony/posta</li>
              <li>Dodaj blok <strong>HTML</strong> (Custom HTML)</li>
              <li>Wklej powyższy kod iframe</li>
              <li>Opublikuj — formularz automatycznie się pojawi</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
