'use client';

import { useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Mail, MessageCircle, Copy, Check, X, Send, Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { TripWithPaymentTemplates } from '@/types';
import { sendTripInfoEmailToGroup } from '@/lib/actions/trip-emails';

interface TripMessageGeneratorProps {
  trip: TripWithPaymentTemplates;
  compact?: boolean;
}

function fmtDate(iso: string) {
  try { return format(new Date(iso), 'EEEE, d MMMM yyyy', { locale: pl }); }
  catch { return iso; }
}

function fmtTime(iso: string) {
  try { return format(new Date(iso), 'HH:mm'); }
  catch { return ''; }
}

function formatPaymentMethod(method: string | null) {
  if (method === 'cash') return 'gotówka';
  if (method === 'transfer') return 'przelew';
  return 'gotówka lub przelew';
}

/** Buduje HTML treści e-maila po stronie klienta (bez wrappera BiegunSport) */
function buildEmailBodyHtml(trip: TripWithPaymentTemplates): string {
  let html = '';

  html += `<p>Szanowni Rodzice,</p>`;
  html += `<p>Zapraszamy na wyjazd <strong>${trip.title}</strong>.`;
  if (trip.description) html += ` ${trip.description}`;
  html += `</p>`;

  html += `<hr>`;
  html += `<h3>📅 Terminy</h3>`;

  html += `<p><strong>Wyjazd:</strong> ${fmtDate(trip.departure_datetime)}<br>`;
  html += `📍 godz. ${fmtTime(trip.departure_datetime)} – ${trip.departure_location}</p>`;

  if (trip.departure_stop2_datetime && trip.departure_stop2_location) {
    html += `<p>📍 godz. ${fmtTime(trip.departure_stop2_datetime)} – ${trip.departure_stop2_location}</p>`;
  }

  html += `<p><strong>Powrót:</strong> ${fmtDate(trip.return_datetime)}<br>`;
  html += `📍 godz. ${fmtTime(trip.return_datetime)} – ${trip.return_location}</p>`;

  if (trip.return_stop2_datetime && trip.return_stop2_location) {
    html += `<p>📍 godz. ${fmtTime(trip.return_stop2_datetime)} – ${trip.return_stop2_location}</p>`;
  }

  if (trip.payment_templates && trip.payment_templates.length > 0) {
    html += `<hr>`;
    html += `<h3>💰 Płatności</h3>`;

    trip.payment_templates.forEach((pt) => {
      const label = pt.payment_type === 'installment'
        ? `Rata ${pt.installment_number}`
        : `Karnet${pt.category_name ? ` ${pt.category_name}` : ''}`;
      const method = formatPaymentMethod(pt.payment_method);
      const departureDateStr = trip.departure_datetime.split('T')[0];
      const isDepartureDay = pt.due_date && pt.due_date === departureDateStr;
      const due = pt.due_date
        ? isDepartureDay
          ? ' – płatność w dniu wyjazdu'
          : ` – termin do ${format(new Date(pt.due_date), 'd MMMM yyyy', { locale: pl })}`
        : '';
      html += `<p>• <strong>${label}:</strong> ${pt.amount.toLocaleString('pl-PL')} ${pt.currency} (${method})${due}</p>`;
    });

    if (trip.bank_account_pln) {
      html += `<p>🏦 <strong>Konto PLN:</strong> ${trip.bank_account_pln}</p>`;
    }
    if (trip.bank_account_eur) {
      html += `<p>🏦 <strong>Konto EUR:</strong> ${trip.bank_account_eur}</p>`;
    }
    html += `<p><em>W tytule przelewu proszę podać imię i nazwisko dziecka oraz nazwę wyjazdu.</em></p>`;
  }

  const dl = (trip as TripWithPaymentTemplates & { declaration_deadline?: string | null }).declaration_deadline;
  if (dl) {
    html += `<hr>`;
    html += `<p>⏰ <strong>Prosimy o potwierdzenie udziału do: ${format(new Date(dl), 'd MMMM yyyy', { locale: pl })}</strong></p>`;
  }

  html += `<hr>`;
  html += `<p>W razie pytań prosimy o kontakt.</p>`;
  html += `<p>Pozdrawiamy,<br><strong>Zespół BiegunSport</strong></p>`;

  return html;
}

/** Buduje tekst WhatsApp */
function buildWhatsAppText(trip: TripWithPaymentTemplates): string {
  const lines: string[] = [];

  lines.push(`*${trip.title}* 🏔️`);
  lines.push('');

  if (trip.description) {
    lines.push(trip.description);
    lines.push('');
  }

  lines.push(`📅 *Wyjazd:* ${format(new Date(trip.departure_datetime), 'EEEE, d MMMM yyyy', { locale: pl })}`);
  lines.push(`📍 ${format(new Date(trip.departure_datetime), 'HH:mm')} – ${trip.departure_location}`);

  if (trip.departure_stop2_datetime && trip.departure_stop2_location) {
    lines.push(`📍 ${format(new Date(trip.departure_stop2_datetime), 'HH:mm')} – ${trip.departure_stop2_location}`);
  }

  lines.push('');
  lines.push(`📅 *Powrót:* ${format(new Date(trip.return_datetime), 'EEEE, d MMMM yyyy', { locale: pl })}`);
  lines.push(`📍 ${format(new Date(trip.return_datetime), 'HH:mm')} – ${trip.return_location}`);

  if (trip.return_stop2_datetime && trip.return_stop2_location) {
    lines.push(`📍 ${format(new Date(trip.return_stop2_datetime), 'HH:mm')} – ${trip.return_stop2_location}`);
  }

  if (trip.payment_templates && trip.payment_templates.length > 0) {
    lines.push('');
    lines.push('💰 *Płatności:*');

    const departureDateStr = trip.departure_datetime.split('T')[0];

    trip.payment_templates.forEach((pt) => {
      const isDepartureDay = pt.due_date && pt.due_date === departureDateStr;
      const duePart = pt.due_date
        ? isDepartureDay ? 'w dniu wyjazdu' : `do ${format(new Date(pt.due_date), 'd.MM.yyyy')}`
        : '';
      const methodPart = pt.payment_method ? ` (${formatPaymentMethod(pt.payment_method)})` : '';

      if (pt.payment_type === 'installment') {
        const rataNr = pt.installment_number ? `Rata ${pt.installment_number}` : 'Rata';
        const categoryPart = pt.category_name ? ` [${pt.category_name}]` : '';
        lines.push(`• ${rataNr}${categoryPart}: *${pt.amount.toLocaleString('pl-PL')} ${pt.currency}*${methodPart}${duePart ? ` – ${duePart}` : ''}`);
      } else {
        const categoryPart = pt.category_name ? ` ${pt.category_name}` : '';
        lines.push(`• Karnet${categoryPart}: *${pt.amount.toLocaleString('pl-PL')} ${pt.currency}*${methodPart}${duePart ? ` – ${duePart}` : ''}`);
      }
    });

    lines.push('');
    if (trip.bank_account_pln) lines.push(`🏦 Konto PLN: ${trip.bank_account_pln}`);
    if (trip.bank_account_eur) lines.push(`🏦 Konto EUR: ${trip.bank_account_eur}`);
    lines.push('_W tytule: imię, nazwisko dziecka + wyjazd_');
  }

  const dl = (trip as TripWithPaymentTemplates & { declaration_deadline?: string | null }).declaration_deadline;
  if (dl) {
    lines.push('');
    lines.push(`⏰ *Potwierdzenie do: ${format(new Date(dl), 'd MMMM yyyy', { locale: pl })}*`);
  }

  lines.push('');
  lines.push('W razie pytań piszcie! 🙂');

  return lines.join('\n');
}

export function TripMessageGenerator({ trip, compact = false }: TripMessageGeneratorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'email' | 'whatsapp'>('email');
  const [copied, setCopied] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [emailSubject, setEmailSubject] = useState(`${trip.title} – informacja o wyjeździe`);

  // Ref do edytowalnej treści e-maila (contenteditable)
  const editorRef = useRef<HTMLDivElement>(null);

  const whatsappText = buildWhatsAppText(trip);

  // Inicjalizuj treść edytora gdy dialog się otwiera
  useEffect(() => {
    if (isOpen && editorRef.current) {
      editorRef.current.innerHTML = buildEmailBodyHtml(trip);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  function handleReset() {
    if (editorRef.current) {
      editorRef.current.innerHTML = buildEmailBodyHtml(trip);
    }
    setEmailSubject(`${trip.title} – informacja o wyjeździe`);
    toast.info('Przywrócono treść domyślną');
  }

  async function handleSendToGroup() {
    const bodyHtml = editorRef.current?.innerHTML || buildEmailBodyHtml(trip);
    setIsSending(true);
    try {
      const result = await sendTripInfoEmailToGroup(trip.id, emailSubject, bodyHtml);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(
          `Wysłano ${result.sent} e-mail${result.sent === 1 ? '' : 'e'} do rodziców${result.skipped ? ` (błędy: ${result.skipped})` : ''}`,
          { duration: 6000 }
        );
      }
    } catch {
      toast.error('Wystąpił błąd podczas wysyłania');
    } finally {
      setIsSending(false);
    }
  }

  function handleCopyWhatsApp() {
    navigator.clipboard.writeText(whatsappText).then(() => {
      setCopied(true);
      toast.success('Skopiowano do schowka!');
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <>
      {compact ? (
        <button
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-blue-50 text-blue-700 text-sm font-medium rounded-xl ring-1 ring-blue-200 transition-colors"
        >
          <Mail className="h-4 w-4" />
          Wiadomość
        </button>
      ) : (
        <Button variant="outline" onClick={() => setIsOpen(true)}>
          <Mail className="mr-2 h-4 w-4" />
          Generuj wiadomość
        </Button>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-3">
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-blue-600" />
              Wiadomość dla rodziców
            </DialogTitle>
          </DialogHeader>

          {/* Zakładki */}
          <div className="flex gap-2 px-5 border-b pb-0">
            <button
              onClick={() => setActiveTab('email')}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'email'
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Mail className="h-4 w-4" />
              E-mail
            </button>
            <button
              onClick={() => setActiveTab('whatsapp')}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'whatsapp'
                  ? 'border-green-600 text-green-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </button>
          </div>

          {/* E-mail — edytowalny podgląd */}
          {activeTab === 'email' && (
            <div className="flex flex-col gap-3 flex-1 min-h-0 px-5 py-4">
              {/* Temat */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Temat wiadomości</label>
                <input
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl bg-gray-50 ring-1 ring-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-300 transition-all"
                />
              </div>

              {/* Edytowalna treść */}
              <div className="flex flex-col flex-1 min-h-0">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-gray-500">Treść (kliknij aby edytować)</label>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Przywróć domyślną
                  </button>
                </div>
                <div
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  className="flex-1 overflow-auto border border-gray-200 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-blue-300 prose prose-sm max-w-none bg-white min-h-[280px]"
                />
              </div>

              {/* Akcje */}
              <div className="flex items-center gap-2 pt-1 border-t">
                <Button
                  onClick={handleSendToGroup}
                  disabled={isSending}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  {isSending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Wysyłanie…
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Wyślij do grupy
                    </>
                  )}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* WhatsApp */}
          {activeTab === 'whatsapp' && (
            <div className="flex flex-col gap-3 flex-1 min-h-0 px-5 py-4">
              <div className="flex-1 overflow-auto">
                <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed bg-gray-50 rounded-xl p-4 border min-h-[280px]">
                  {whatsappText}
                </pre>
              </div>
              <div className="flex items-center gap-2 pt-1 border-t">
                <Button onClick={handleCopyWhatsApp} className="flex-1">
                  {copied ? (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Skopiowano!
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 h-4 w-4" />
                      Kopiuj tekst
                    </>
                  )}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
