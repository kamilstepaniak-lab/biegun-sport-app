'use client';

import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import {
  Check,
  X,
  HelpCircle,
  Clock,
  Copy,
  MessageSquare,
  Users,
  Search,
  Download,
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { EmptyState } from '@/components/shared';

import { updateParticipationStatus, type TripParticipant, type ParticipantPayment } from '@/lib/actions/trips';
import type { Group } from '@/types';

interface RegistrationsListProps {
  tripId: string;
  participants: TripParticipant[];
  groups: Group[];
  tripTitle?: string;
  stop1Name?: string | null;
  stop2Name?: string | null;
}

type StatusFilter = 'all' | 'confirmed' | 'not_going' | 'unconfirmed' | 'other';

const statusConfig = {
  confirmed: { label: 'Jedzie', color: 'bg-green-100 text-green-700 border-green-300', icon: Check, order: 1 },
  not_going: { label: 'Nie jedzie', color: 'bg-red-100 text-red-700 border-red-300', icon: X, order: 2 },
  other: { label: 'Inne', color: 'bg-amber-100 text-amber-700 border-amber-300', icon: HelpCircle, order: 3 },
  unconfirmed: { label: 'Niepotwierdzony', color: 'bg-gray-100 text-gray-700 border-gray-300', icon: Clock, order: 4 },
};

// Wyciągnij przystanek z notatki uczestnictwa
function parseStopFromNote(note: string | null | undefined, stop1Name?: string | null, stop2Name?: string | null): string | null {
  if (!note) return null;
  if (note.startsWith('[STOP1]')) return stop1Name || 'Przystanek 1';
  if (note.startsWith('[STOP2]')) return stop2Name || 'Przystanek 2';
  if (note.startsWith('[OWN]')) return 'Dojazd własny';
  return null;
}

// Pobierz unikalne kwoty płatności dla wyjazdu (do nagłówków kolumn)
function getPaymentColumns(participants: TripParticipant[]): { key: string; label: string; currency: string; amount: number; sortOrder: number }[] {
  const paymentMap = new Map<string, { label: string; currency: string; amount: number; sortOrder: number }>();

  participants.forEach(p => {
    p.payments.forEach(payment => {
      const key = `${payment.payment_type}-${payment.installment_number || 0}-${payment.currency}`;
      if (!paymentMap.has(key)) {
        const label = payment.payment_type === 'installment'
          ? `Rata ${payment.installment_number}`
          : payment.payment_type === 'season_pass'
          ? 'Karnet'
          : payment.payment_type === 'full'
          ? 'Pełna opłata'
          : payment.payment_type;

        // Sortowanie: raty wg numeru, reszta na końcu
        const sortOrder = payment.payment_type === 'installment'
          ? (payment.installment_number || 0)
          : payment.payment_type === 'full'
          ? 100
          : payment.payment_type === 'season_pass'
          ? 200
          : 300;

        paymentMap.set(key, {
          label: `${label} (${payment.amount} ${payment.currency})`,
          currency: payment.currency,
          amount: payment.amount,
          sortOrder,
        });
      }
    });
  });

  return Array.from(paymentMap.entries())
    .map(([key, value]) => ({ key, ...value }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

// Sprawdź czy płatność pasuje do kolumny
function getPaymentForColumn(payments: ParticipantPayment[], columnKey: string): ParticipantPayment | undefined {
  return payments.find(p => {
    const key = `${p.payment_type}-${p.installment_number || 0}-${p.currency}`;
    return key === columnKey;
  });
}

// Eksport do Excel (CSV z BOM dla polskich znaków)
function exportToExcel(
  participants: TripParticipant[],
  paymentColumns: { key: string; label: string }[],
  tripTitle: string,
  stop1Name?: string | null,
  stop2Name?: string | null,
) {
  const statusLabels: Record<string, string> = {
    confirmed: 'Jedzie',
    not_going: 'Nie jedzie',
    other: 'Inne',
    unconfirmed: 'Niepotwierdzony',
  };

  const paymentStatusLabels: Record<string, string> = {
    paid: 'Opłacona',
    partially_paid: 'Częściowo',
    pending: 'Nieopłacona',
    overdue: 'Zaległa',
  };

  // Nagłówki
  const headers = [
    'Nazwisko',
    'Imię',
    'Data urodzenia',
    'Grupa',
    'Email rodzica',
    'Telefon rodzica',
    'Status',
    'Przystanek',
    'Notatka',
    ...paymentColumns.map(c => c.label),
  ];

  const rows = participants.map(p => {
    const paymentCells = paymentColumns.map(col => {
      const payment = getPaymentForColumn(p.payments, col.key);
      if (!payment) return '-';
      const statusLabel = paymentStatusLabels[payment.status] || payment.status;
      return `${payment.amount} ${payment.currency} (${statusLabel})`;
    });

    const stopLabel = parseStopFromNote(p.participation_note, stop1Name, stop2Name) || '-';
    const noteWithoutStop = p.participation_note
      ? p.participation_note.replace(/^\[(STOP1|STOP2)\]/, '').trim()
      : '';

    return [
      p.last_name,
      p.first_name,
      p.birth_date ? format(new Date(p.birth_date), 'dd.MM.yyyy') : '-',
      p.group_name,
      p.parent_email,
      p.parent_phone,
      statusLabels[p.participation_status] || p.participation_status,
      stopLabel,
      noteWithoutStop,
      ...paymentCells,
    ];
  });

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
    .join('\n');

  // BOM dla polskich znaków w Excelu
  const bom = '\uFEFF';
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeTitle = tripTitle.replace(/[^a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ\s-]/g, '').trim();
  link.href = url;
  link.download = `Zapisani - ${safeTitle}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  toast.success('Lista wyeksportowana do pliku Excel');
}

export function RegistrationsList({ tripId, participants, groups, tripTitle = 'Wyjazd', stop1Name, stop2Name }: RegistrationsListProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<TripParticipant | null>(null);
  const [noteText, setNoteText] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Kolumny płatności
  const paymentColumns = useMemo(() => getPaymentColumns(participants), [participants]);

  // Filtruj i sortuj uczestników
  const filteredParticipants = useMemo(() => {
    let result = participants.filter((p) => {
      const matchesStatus = statusFilter === 'all' || p.participation_status === statusFilter;
      const matchesGroup = groupFilter === 'all' || p.group_name === groupFilter;
      const matchesSearch = !searchQuery.trim() ||
        p.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.first_name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesGroup && matchesSearch;
    });

    // Sortuj wg statusu: Jadą, Nie jadą, Inne, Niepotwierdzeni
    result.sort((a, b) => {
      const orderA = statusConfig[a.participation_status].order;
      const orderB = statusConfig[b.participation_status].order;
      if (orderA !== orderB) return orderA - orderB;
      return a.last_name.localeCompare(b.last_name, 'pl');
    });

    return result;
  }, [participants, statusFilter, groupFilter, searchQuery]);

  async function copyToClipboard(text: string, field: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast.success('Skopiowano');
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast.error('Nie udało się skopiować');
    }
  }

  async function handleStatusChange(participantId: string, newStatus: string) {
    const result = await updateParticipationStatus(
      tripId,
      participantId,
      newStatus as 'unconfirmed' | 'confirmed' | 'not_going' | 'other'
    );
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success('Status zaktualizowany');
    }
  }

  function openNoteDialog(participant: TripParticipant) {
    setSelectedParticipant(participant);
    setNoteText(participant.participation_note || '');
    setNoteDialogOpen(true);
  }

  async function handleSaveNote() {
    if (!selectedParticipant) return;

    setIsSaving(true);
    try {
      const result = await updateParticipationStatus(
        tripId,
        selectedParticipant.participant_id,
        selectedParticipant.participation_status,
        noteText
      );
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Notatka zapisana');
        setNoteDialogOpen(false);
      }
    } catch {
      toast.error('Wystąpił nieoczekiwany błąd');
    } finally {
      setIsSaving(false);
    }
  }

  // Pobierz unikalne nazwy grup
  const uniqueGroups = [...new Set(participants.map(p => p.group_name))];

  if (participants.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Brak uczestników"
        description="Żadne dziecko nie jest przypisane do grup powiązanych z tym wyjazdem."
      />
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Filtry */}
        <div className="flex flex-wrap gap-4">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Szukaj po nazwisku..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtruj po statusie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszyscy</SelectItem>
              <SelectItem value="confirmed">
                <span className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  Jadą
                </span>
              </SelectItem>
              <SelectItem value="not_going">
                <span className="flex items-center gap-2">
                  <X className="h-4 w-4 text-red-600" />
                  Nie jadą
                </span>
              </SelectItem>
              <SelectItem value="other">
                <span className="flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-amber-600" />
                  Inne
                </span>
              </SelectItem>
              <SelectItem value="unconfirmed">
                <span className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gray-600" />
                  Niepotwierdzeni
                </span>
              </SelectItem>
            </SelectContent>
          </Select>

          <Select value={groupFilter} onValueChange={setGroupFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtruj po grupie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszystkie grupy</SelectItem>
              {uniqueGroups.map((group) => (
                <SelectItem key={group} value={group}>
                  {group}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-3 ml-auto">
            <span className="text-sm text-muted-foreground">
              Wyświetlono: {filteredParticipants.length} z {participants.length}
            </span>
            {/* Eksport do Excel */}
            <button
              onClick={() => exportToExcel(filteredParticipants, paymentColumns, tripTitle, stop1Name, stop2Name)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl transition-colors"
            >
              <Download className="h-4 w-4" />
              Eksportuj Excel
            </button>
          </div>
        </div>

        {/* Tabela */}
        <div className="rounded-2xl border border-gray-100 overflow-x-auto bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50/80">
              <tr>
                <th className="text-left p-3 font-medium text-gray-600">Nazwisko i imię</th>
                <th className="text-left p-3 font-medium text-gray-600">Data ur.</th>
                <th className="text-left p-3 font-medium text-gray-600">Grupa</th>
                <th className="text-left p-3 font-medium text-gray-600">Email</th>
                <th className="text-left p-3 font-medium text-gray-600">Telefon</th>
                <th className="text-left p-3 font-medium text-gray-600">Status</th>
                {/* Kolumny płatności */}
                {paymentColumns.map(col => (
                  <th key={col.key} className="text-center p-3 font-medium text-gray-600 whitespace-nowrap">
                    {col.label}
                  </th>
                ))}
                <th className="text-center p-3 font-medium text-gray-600 w-[50px]">Notatka</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredParticipants.length === 0 ? (
                <tr>
                  <td colSpan={7 + paymentColumns.length} className="text-center py-8 text-muted-foreground">
                    Brak uczestników spełniających kryteria
                  </td>
                </tr>
              ) : (
                filteredParticipants.map((participant) => {
                  const birthDate = participant.birth_date
                    ? format(new Date(participant.birth_date), 'dd.MM.yyyy', { locale: pl })
                    : '—';
                  const emailId = `email-${participant.id}`;
                  const phoneId = `phone-${participant.id}`;
                  const status = statusConfig[participant.participation_status];
                  const StatusIcon = status.icon;

                  const stopLabel = parseStopFromNote(participant.participation_note, stop1Name, stop2Name);

                  return (
                    <tr key={participant.id} className="hover:bg-gray-50/50">
                      <td className="p-3 font-medium text-gray-900">
                        {participant.last_name} {participant.first_name}
                      </td>
                      <td className="p-3 text-gray-600 whitespace-nowrap">{birthDate}</td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-xs">{participant.group_name}</Badge>
                      </td>
                      <td className="p-3">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => copyToClipboard(participant.parent_email, emailId)}
                              className="text-sm hover:text-primary cursor-pointer flex items-center gap-1 group"
                            >
                              {participant.parent_email}
                              {copiedField === emailId ? (
                                <Check className="h-3 w-3 text-green-500" />
                              ) : (
                                <Copy className="h-3 w-3 opacity-0 group-hover:opacity-50" />
                              )}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Kliknij aby skopiować</TooltipContent>
                        </Tooltip>
                      </td>
                      <td className="p-3">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => copyToClipboard(participant.parent_phone, phoneId)}
                              className="text-sm hover:text-primary cursor-pointer flex items-center gap-1 group"
                            >
                              {participant.parent_phone}
                              {copiedField === phoneId ? (
                                <Check className="h-3 w-3 text-green-500" />
                              ) : (
                                <Copy className="h-3 w-3 opacity-0 group-hover:opacity-50" />
                              )}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Kliknij aby skopiować</TooltipContent>
                        </Tooltip>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-col gap-1">
                          <Select
                            value={participant.participation_status}
                            onValueChange={(value) => handleStatusChange(participant.participant_id, value)}
                          >
                            <SelectTrigger className="w-[150px] h-8">
                              <SelectValue>
                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${status.color}`}>
                                  <StatusIcon className="h-3 w-3" />
                                  {status.label}
                                </span>
                              </SelectValue>
                            </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="confirmed">
                              <span className="flex items-center gap-2">
                                <Check className="h-4 w-4 text-green-600" />
                                Jedzie
                              </span>
                            </SelectItem>
                            <SelectItem value="not_going">
                              <span className="flex items-center gap-2">
                                <X className="h-4 w-4 text-red-600" />
                                Nie jedzie
                              </span>
                            </SelectItem>
                            <SelectItem value="other">
                              <span className="flex items-center gap-2">
                                <HelpCircle className="h-4 w-4 text-amber-600" />
                                Inne
                              </span>
                            </SelectItem>
                            <SelectItem value="unconfirmed">
                              <span className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-gray-600" />
                                Niepotwierdzony
                              </span>
                            </SelectItem>
                          </SelectContent>
                          </Select>
                          {stopLabel && (
                            <span className="text-xs text-gray-500 truncate max-w-[150px]" title={stopLabel}>
                              📍 {stopLabel}
                            </span>
                          )}
                        </div>
                      </td>
                      {/* Komórki płatności */}
                      {paymentColumns.map(col => {
                        const payment = getPaymentForColumn(participant.payments, col.key);
                        const isPaid = payment && payment.status === 'paid';
                        const isPartiallyPaid = payment && payment.amount_paid > 0 && payment.status !== 'paid';

                        return (
                          <td key={col.key} className="p-3 text-center">
                            {payment ? (
                              <span
                                className={`inline-flex items-center justify-center px-2 py-1 rounded text-xs font-medium ${
                                  isPaid
                                    ? 'bg-green-100 text-green-700'
                                    : isPartiallyPaid
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-gray-100 text-gray-600'
                                }`}
                              >
                                {isPaid ? (
                                  <Check className="h-3 w-3 mr-1" />
                                ) : null}
                                {payment.amount} {payment.currency}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="p-3 text-center">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={`h-8 w-8 ${participant.participation_note ? 'text-amber-500' : 'text-muted-foreground'}`}
                              onClick={() => openNoteDialog(participant)}
                            >
                              <MessageSquare className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {participant.participation_note ? (
                              <div className="max-w-[200px]">
                                <p className="font-medium mb-1">Notatka:</p>
                                <p className="text-xs">{participant.participation_note}</p>
                              </div>
                            ) : 'Dodaj notatkę'}
                          </TooltipContent>
                        </Tooltip>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Dialog notatki */}
        <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
          <DialogContent className="rounded-2xl">
            <DialogHeader>
              <DialogTitle>
                Notatka - {selectedParticipant?.first_name} {selectedParticipant?.last_name}
              </DialogTitle>
              <DialogDescription>
                Dodaj notatkę do uczestnictwa (np. powód nieobecności)
              </DialogDescription>
            </DialogHeader>
            <Textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Wpisz notatkę..."
              rows={4}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setNoteDialogOpen(false)}>
                Anuluj
              </Button>
              <Button onClick={handleSaveNote} disabled={isSaving}>
                {isSaving ? 'Zapisywanie...' : 'Zapisz'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
