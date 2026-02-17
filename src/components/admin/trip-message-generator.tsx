'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Mail, MessageCircle, Copy, Check, Printer, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { TripWithPaymentTemplates } from '@/types';

interface TripMessageGeneratorProps {
  trip: TripWithPaymentTemplates;
  compact?: boolean;
}

function formatDate(iso: string, withTime = true) {
  try {
    return format(
      new Date(iso),
      withTime ? "EEEE, d MMMM yyyy, HH:mm" : "d MMMM yyyy",
      { locale: pl }
    );
  } catch {
    return iso;
  }
}

function formatAmount(amount: number, currency: string) {
  return `${amount.toLocaleString('pl-PL')} ${currency}`;
}

function formatPaymentMethod(method: string | null) {
  if (method === 'cash') return 'gotówka';
  if (method === 'transfer') return 'przelew';
  if (method === 'both') return 'gotówka lub przelew';
  return '';
}

function buildEmailText(trip: TripWithPaymentTemplates): string {
  const lines: string[] = [];

  lines.push(`Temat: ${trip.title} – informacja o wyjeździe`);
  lines.push('');
  lines.push('Szanowni Rodzice,');
  lines.push('');
  lines.push(`Zapraszamy na wyjazd: ${trip.title}`);

  if (trip.description) {
    lines.push('');
    lines.push(trip.description);
  }

  lines.push('');
  lines.push('─────────────────────────────');
  lines.push('📅 TERMINY');
  lines.push('─────────────────────────────');
  lines.push('');

  lines.push(`📅 Wyjazd: ${format(new Date(trip.departure_datetime), 'EEEE, d MMMM yyyy', { locale: pl })}`);
  lines.push(`📍 ${format(new Date(trip.departure_datetime), 'HH:mm')} – ${trip.departure_location}`);

  if (trip.departure_stop2_datetime && trip.departure_stop2_location) {
    lines.push(`📍 ${format(new Date(trip.departure_stop2_datetime), 'HH:mm')} – ${trip.departure_stop2_location}`);
  }

  lines.push('');
  lines.push(`📅 Powrót: ${format(new Date(trip.return_datetime), 'EEEE, d MMMM yyyy', { locale: pl })}`);
  lines.push(`📍 ${format(new Date(trip.return_datetime), 'HH:mm')} – ${trip.return_location}`);

  if (trip.return_stop2_datetime && trip.return_stop2_location) {
    lines.push(`📍 ${format(new Date(trip.return_stop2_datetime), 'HH:mm')} – ${trip.return_stop2_location}`);
  }

  if (trip.payment_templates && trip.payment_templates.length > 0) {
    lines.push('');
    lines.push('─────────────────────────────');
    lines.push('💰 PŁATNOŚCI');
    lines.push('─────────────────────────────');
    lines.push('');

    const departureDateStr = trip.departure_datetime.split('T')[0];

    trip.payment_templates.forEach((pt) => {
      const isDepartureDay = pt.due_date && pt.due_date === departureDateStr;
      const duePart = pt.due_date
        ? isDepartureDay
          ? 'w dniu wyjazdu'
          : `do ${format(new Date(pt.due_date), 'd MMMM yyyy', { locale: pl })}`
        : '';

      const methodPart = pt.payment_method ? ` (${formatPaymentMethod(pt.payment_method)})` : '';

      if (pt.payment_type === 'installment') {
        const rataNr = pt.installment_number ? `Rata ${pt.installment_number}` : 'Rata';
        const categoryPart = pt.category_name ? ` [${pt.category_name}]` : '';
        const birthPart = pt.birth_year_from && pt.birth_year_to
          ? ` (roczniki ${pt.birth_year_from}–${pt.birth_year_to})`
          : pt.birth_year_from
          ? ` (rocznik ${pt.birth_year_from}+)`
          : '';
        lines.push(`• ${rataNr}${categoryPart}${birthPart}: ${formatAmount(pt.amount, pt.currency)}${methodPart}${duePart ? ` — płatność ${duePart}` : ''}`);
      } else {
        // season_pass
        const categoryPart = pt.category_name ? ` ${pt.category_name}` : '';
        lines.push(`• Karnet${categoryPart}: ${formatAmount(pt.amount, pt.currency)}${methodPart}${duePart ? ` — płatność ${duePart}` : ''}`);
      }
    });

    lines.push('');
    if (trip.bank_account_pln) {
      lines.push(`🏦 Konto PLN: ${trip.bank_account_pln}`);
    }
    if (trip.bank_account_eur) {
      lines.push(`🏦 Konto EUR: ${trip.bank_account_eur}`);
    }
    lines.push('W tytule przelewu proszę podać: imię i nazwisko dziecka + nazwa wyjazdu');
  }

  const dl = (trip as TripWithPaymentTemplates & { declaration_deadline?: string | null }).declaration_deadline;
  if (dl) {
    lines.push('');
    lines.push('─────────────────────────────');
    lines.push(`⏰ Prosimy o potwierdzenie udziału do: ${format(new Date(dl), 'd MMMM yyyy', { locale: pl })}`);
    lines.push('─────────────────────────────');
  }

  lines.push('');
  lines.push('W razie pytań prosimy o kontakt.');
  lines.push('');
  lines.push('Pozdrawiamy,');
  lines.push('Zespół BiegunSport');

  return lines.join('\n');
}

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

  if (trip.payment_templates && trip.payment_templates.length > 0) {
    lines.push('');
    lines.push('💰 *Płatności:*');

    const departureDateStr = trip.departure_datetime.split('T')[0];

    trip.payment_templates.forEach((pt) => {
      const isDepartureDay = pt.due_date && pt.due_date === departureDateStr;
      const duePart = pt.due_date
        ? isDepartureDay
          ? 'w dniu wyjazdu'
          : `do ${format(new Date(pt.due_date), 'd.MM.yyyy')}`
        : '';

      const methodPart = pt.payment_method ? ` (${formatPaymentMethod(pt.payment_method)})` : '';

      if (pt.payment_type === 'installment') {
        const rataNr = pt.installment_number ? `Rata ${pt.installment_number}` : 'Rata';
        const categoryPart = pt.category_name ? ` [${pt.category_name}]` : '';
        lines.push(`• ${rataNr}${categoryPart}: *${formatAmount(pt.amount, pt.currency)}*${methodPart}${duePart ? ` – ${duePart}` : ''}`);
      } else {
        const categoryPart = pt.category_name ? ` ${pt.category_name}` : '';
        lines.push(`• Karnet${categoryPart}: *${formatAmount(pt.amount, pt.currency)}*${methodPart}${duePart ? ` – ${duePart}` : ''}`);
      }
    });

    lines.push('');
    if (trip.bank_account_pln) {
      lines.push(`🏦 Konto PLN: ${trip.bank_account_pln}`);
    }
    if (trip.bank_account_eur) {
      lines.push(`🏦 Konto EUR: ${trip.bank_account_eur}`);
    }
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

  const emailText = buildEmailText(trip);
  const whatsappText = buildWhatsAppText(trip);

  const activeText = activeTab === 'email' ? emailText : whatsappText;

  function handleCopy() {
    navigator.clipboard.writeText(activeText).then(() => {
      setCopied(true);
      toast.success('Skopiowano do schowka!');
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handlePrint() {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html lang="pl">
      <head>
        <meta charset="UTF-8">
        <title>${trip.title} – wiadomość</title>
        <style>
          body { font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; padding: 40px; max-width: 700px; margin: 0 auto; color: #222; }
          pre { white-space: pre-wrap; font-family: Arial, sans-serif; font-size: 14px; }
          h2 { color: #1a56db; margin-bottom: 4px; }
          .label { color: #888; font-size: 12px; margin-bottom: 16px; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <h2>${trip.title}</h2>
        <div class="label">${activeTab === 'email' ? 'Wiadomość e-mail' : 'Wiadomość WhatsApp'}</div>
        <pre>${activeText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
      </body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
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
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-blue-600" />
              Wiadomość dla rodziców
            </DialogTitle>
          </DialogHeader>

          {/* Zakładki */}
          <div className="flex gap-2 border-b pb-2">
            <button
              onClick={() => setActiveTab('email')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'email'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              <Mail className="h-4 w-4" />
              Email
            </button>
            <button
              onClick={() => setActiveTab('whatsapp')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'whatsapp'
                  ? 'bg-green-100 text-green-700'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </button>
          </div>

          {/* Treść wiadomości */}
          <div className="flex-1 overflow-auto min-h-0">
            <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed bg-gray-50 rounded-lg p-4 border">
              {activeText}
            </pre>
          </div>

          {/* Przyciski akcji */}
          <div className="flex items-center gap-2 pt-2 border-t">
            <Button onClick={handleCopy} className="flex-1">
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
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" />
              Drukuj / PDF
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
