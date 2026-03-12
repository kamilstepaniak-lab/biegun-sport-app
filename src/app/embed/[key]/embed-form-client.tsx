'use client';

import { useState, useEffect } from 'react';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';

interface FormConfig {
  formId: string;
  title: string;
  description?: string;
  buttonText: string;
  successMessage: string;
  fields: {
    requirePhone: boolean;
    requireBirthDate: boolean;
    requireSchool: boolean;
    customFields: Array<{ label: string; type: string; required: boolean }>;
  };
  trip: {
    name: string;
    date: string;
    location?: string;
  } | null;
  isFull: boolean;
  spotsLeft: number | null;
}

export function EmbedFormClient({ formKey }: { formKey: string }) {
  const [config, setConfig] = useState<FormConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');

  const [form, setForm] = useState({
    parentFirstName: '',
    parentLastName: '',
    parentEmail: '',
    parentPhone: '',
    childFirstName: '',
    childLastName: '',
    childBirthDate: '',
    childSchool: '',
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadConfig();
  }, [formKey]);

  async function loadConfig() {
    try {
      const res = await fetch(`/api/public/embed?key=${formKey}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Błąd ładowania formularza');
        return;
      }

      setConfig(data);
    } catch {
      setError('Nie udało się załadować formularza');
    } finally {
      setLoading(false);
    }
  }

  function validate() {
    if (!config) return false;
    const errors: Record<string, string> = {};

    if (!form.parentFirstName.trim()) errors.parentFirstName = 'Wymagane';
    if (!form.parentLastName.trim()) errors.parentLastName = 'Wymagane';
    if (!form.parentEmail.trim()) errors.parentEmail = 'Wymagane';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.parentEmail)) {
      errors.parentEmail = 'Nieprawidłowy email';
    }
    if (config.fields.requirePhone && !form.parentPhone.trim()) {
      errors.parentPhone = 'Wymagane';
    }
    if (!form.childFirstName.trim()) errors.childFirstName = 'Wymagane';
    if (!form.childLastName.trim()) errors.childLastName = 'Wymagane';
    if (config.fields.requireBirthDate && !form.childBirthDate) {
      errors.childBirthDate = 'Wymagane';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!config || !validate()) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/public/embed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formId: config.formId,
          parentEmail: form.parentEmail,
          parentFirstName: form.parentFirstName,
          parentLastName: form.parentLastName,
          parentPhone: form.parentPhone || undefined,
          childFirstName: form.childFirstName,
          childLastName: form.childLastName,
          childBirthDate: form.childBirthDate || undefined,
          childSchool: form.childSchool || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setFieldErrors({ _form: data.error || 'Wystąpił błąd' });
        return;
      }

      setSubmitMessage(
        data.duplicate
          ? data.message
          : config.successMessage
      );
      setSubmitted(true);
    } catch {
      setFieldErrors({ _form: 'Błąd połączenia. Spróbuj ponownie.' });
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass = (field: string) =>
    `w-full px-3 py-2.5 text-sm border rounded-lg outline-none transition-colors ${
      fieldErrors[field]
        ? 'border-red-400 bg-red-50 focus:border-red-500'
        : 'border-gray-200 bg-white focus:border-blue-500'
    }`;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-32 p-8">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
        <p className="text-sm text-gray-500">{error}</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="p-8 text-center">
        <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
        <p className="text-base font-medium text-gray-900">{submitMessage}</p>
      </div>
    );
  }

  if (!config) return null;

  if (config.isFull) {
    return (
      <div className="p-8 text-center">
        <AlertCircle className="h-8 w-8 text-orange-400 mx-auto mb-3" />
        <p className="text-sm font-medium text-gray-700">Brak wolnych miejsc</p>
        <p className="text-xs text-gray-400 mt-1">Wszystkie miejsca zostały zajęte</p>
      </div>
    );
  }

  return (
    <div className="p-4 font-sans">
      {/* Nagłówek */}
      <div className="mb-5">
        <h2 className="text-lg font-bold text-gray-900">{config.title}</h2>
        {config.trip && (
          <p className="text-xs text-gray-400 mt-0.5">
            {new Date(config.trip.date).toLocaleDateString('pl-PL', {
              day: 'numeric', month: 'long', year: 'numeric',
            })}
            {config.trip.location && ` · ${config.trip.location}`}
          </p>
        )}
        {config.description && (
          <p className="text-sm text-gray-600 mt-2">{config.description}</p>
        )}
        {config.spotsLeft !== null && config.spotsLeft <= 5 && (
          <p className="text-xs text-orange-600 mt-1 font-medium">
            Pozostało tylko {config.spotsLeft} {config.spotsLeft === 1 ? 'miejsce' : 'miejsc'}!
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {fieldErrors._form && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
            {fieldErrors._form}
          </div>
        )}

        {/* Dane rodzica */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Dane rodzica / opiekuna
          </p>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <input
                className={inputClass('parentFirstName')}
                placeholder="Imię *"
                value={form.parentFirstName}
                onChange={(e) => setForm(f => ({ ...f, parentFirstName: e.target.value }))}
              />
              {fieldErrors.parentFirstName && (
                <p className="text-xs text-red-500 mt-0.5">{fieldErrors.parentFirstName}</p>
              )}
            </div>
            <div>
              <input
                className={inputClass('parentLastName')}
                placeholder="Nazwisko *"
                value={form.parentLastName}
                onChange={(e) => setForm(f => ({ ...f, parentLastName: e.target.value }))}
              />
              {fieldErrors.parentLastName && (
                <p className="text-xs text-red-500 mt-0.5">{fieldErrors.parentLastName}</p>
              )}
            </div>
          </div>
          <div className="mb-2">
            <input
              type="email"
              className={inputClass('parentEmail')}
              placeholder="Email *"
              value={form.parentEmail}
              onChange={(e) => setForm(f => ({ ...f, parentEmail: e.target.value }))}
            />
            {fieldErrors.parentEmail && (
              <p className="text-xs text-red-500 mt-0.5">{fieldErrors.parentEmail}</p>
            )}
          </div>
          {(config.fields.requirePhone || form.parentPhone) && (
            <div>
              <input
                type="tel"
                className={inputClass('parentPhone')}
                placeholder={`Telefon${config.fields.requirePhone ? ' *' : ''}`}
                value={form.parentPhone}
                onChange={(e) => setForm(f => ({ ...f, parentPhone: e.target.value }))}
              />
              {fieldErrors.parentPhone && (
                <p className="text-xs text-red-500 mt-0.5">{fieldErrors.parentPhone}</p>
              )}
            </div>
          )}
        </div>

        {/* Dane dziecka */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Dane dziecka
          </p>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <input
                className={inputClass('childFirstName')}
                placeholder="Imię *"
                value={form.childFirstName}
                onChange={(e) => setForm(f => ({ ...f, childFirstName: e.target.value }))}
              />
              {fieldErrors.childFirstName && (
                <p className="text-xs text-red-500 mt-0.5">{fieldErrors.childFirstName}</p>
              )}
            </div>
            <div>
              <input
                className={inputClass('childLastName')}
                placeholder="Nazwisko *"
                value={form.childLastName}
                onChange={(e) => setForm(f => ({ ...f, childLastName: e.target.value }))}
              />
              {fieldErrors.childLastName && (
                <p className="text-xs text-red-500 mt-0.5">{fieldErrors.childLastName}</p>
              )}
            </div>
          </div>
          {config.fields.requireBirthDate && (
            <div className="mb-2">
              <label className="text-xs text-gray-500 mb-1 block">
                Data urodzenia {config.fields.requireBirthDate ? '*' : ''}
              </label>
              <input
                type="date"
                className={inputClass('childBirthDate')}
                value={form.childBirthDate}
                onChange={(e) => setForm(f => ({ ...f, childBirthDate: e.target.value }))}
              />
              {fieldErrors.childBirthDate && (
                <p className="text-xs text-red-500 mt-0.5">{fieldErrors.childBirthDate}</p>
              )}
            </div>
          )}
          {config.fields.requireSchool && (
            <input
              className={inputClass('childSchool')}
              placeholder="Szkoła"
              value={form.childSchool}
              onChange={(e) => setForm(f => ({ ...f, childSchool: e.target.value }))}
            />
          )}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {submitting ? (
            <><Loader2 className="h-4 w-4 animate-spin" />Wysyłanie...</>
          ) : config.buttonText}
        </button>
      </form>
    </div>
  );
}
