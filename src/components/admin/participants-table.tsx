'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { format, differenceInYears, parseISO } from 'date-fns';
import {
  Check,
  ChevronDown,
  Copy,
  Eye,
  Loader2,
  PencilLine,
  StickyNote,
} from 'lucide-react';
import { toast } from 'sonner';

import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { getGroupColor } from '@/lib/group-colors';
import { cn } from '@/lib/utils';
import {
  assignParticipantToGroup,
  setParticipantFlag,
  updateParticipantNote,
} from '@/lib/actions/participants';
import type { Group } from '@/types';

export interface ParticipantRow {
  id: string;
  first_name: string;
  last_name: string;
  birth_date: string;
  notes: string | null;
  has_whatsapp: boolean;
  entry_fee_paid: boolean;
  contract_signed: boolean;
  group: { id: string; name: string } | null;
  parent: {
    email: string;
    phone: string;
    secondary_email: string | null;
    secondary_phone: string | null;
  };
}

type FlagKey = 'has_whatsapp' | 'entry_fee_paid' | 'contract_signed';

interface ParticipantsTableProps {
  rows: ParticipantRow[];
  allGroups: Group[];
  selectedIds: Set<string>;
  onSelectionChange: (next: Set<string>) => void;
  hideGroupColumn?: boolean;
  emptyMessage?: string;
}

export function ParticipantsTable({
  rows,
  allGroups,
  selectedIds,
  onSelectionChange,
  hideGroupColumn = false,
  emptyMessage = 'Brak uczestników',
}: ParticipantsTableProps) {
  const router = useRouter();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [pendingGroupId, setPendingGroupId] = useState<string | null>(null);
  const [pendingFlag, setPendingFlag] = useState<string | null>(null);

  const [noteDialog, setNoteDialog] = useState<{
    participantId: string;
    participantName: string;
    text: string;
  } | null>(null);
  const [isSavingNote, setIsSavingNote] = useState(false);

  const sections = useMemo(() => {
    const map = new Map<string, ParticipantRow[]>();
    [...rows]
      .sort((a, b) => a.last_name.localeCompare(b.last_name, 'pl'))
      .forEach((r) => {
        const letter = r.last_name.charAt(0).toUpperCase() || '#';
        const bucket = map.get(letter) ?? [];
        bucket.push(r);
        map.set(letter, bucket);
      });
    return Array.from(map.entries()).sort(([a], [b]) =>
      a.localeCompare(b, 'pl'),
    );
  }, [rows]);

  function toggleOne(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  }

  function toggleSection(ids: string[]) {
    const next = new Set(selectedIds);
    const allSelected = ids.every((id) => next.has(id));
    if (allSelected) ids.forEach((id) => next.delete(id));
    else ids.forEach((id) => next.add(id));
    onSelectionChange(next);
  }

  async function copy(text: string, key: string) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      toast.success('Skopiowano');
      setTimeout(() => setCopiedKey(null), 1500);
    } catch {
      toast.error('Nie udało się skopiować');
    }
  }

  async function toggleFlag(participantId: string, flag: FlagKey, value: boolean) {
    const key = `${participantId}:${flag}`;
    setPendingFlag(key);
    try {
      const result = await setParticipantFlag(participantId, flag, value);
      if (result.error) {
        toast.error(result.error);
      } else {
        router.refresh();
      }
    } finally {
      setPendingFlag(null);
    }
  }

  async function changeGroup(participantId: string, groupId: string, groupName: string) {
    setPendingGroupId(participantId);
    try {
      const result = await assignParticipantToGroup(participantId, groupId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Przeniesiono do "${groupName}"`);
        router.refresh();
      }
    } finally {
      setPendingGroupId(null);
    }
  }

  async function saveNote() {
    if (!noteDialog) return;
    setIsSavingNote(true);
    try {
      const result = await updateParticipantNote(noteDialog.participantId, noteDialog.text);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Notatka zapisana');
        setNoteDialog(null);
        router.refresh();
      }
    } finally {
      setIsSavingNote(false);
    }
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-12 text-center ring-1 ring-slate-200">
        <p className="text-sm text-slate-500">{emptyMessage}</p>
      </div>
    );
  }

  const colCount = (hideGroupColumn ? 7 : 8) + 3;

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {sections.map(([letter, sectionRows]) => {
          const allInSectionSelected = sectionRows.every((r) => selectedIds.has(r.id));
          const sectionIds = sectionRows.map((r) => r.id);

          return (
            <div key={letter} className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white shadow-sm">
                  {letter}
                </div>
                <div className="h-px flex-1 bg-slate-200" />
                <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">
                  {sectionRows.length}
                </span>
              </div>

              <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
                <div className="overflow-x-auto">
                  <table className="w-full table-fixed border-collapse text-sm">
                    <colgroup>
                      <col className="w-10" />
                      <col />
                      {!hideGroupColumn && <col className="w-44" />}
                      <col className="w-32" />
                      <col />
                      <col className="w-36" />
                      <col className="w-36" />
                      <col className="w-14" />
                      <col className="w-16" />
                      <col className="w-14" />
                      <col className="w-28" />
                    </colgroup>
                    <thead>
                      <tr className="bg-slate-50/70 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        <th className="px-3 py-2.5">
                          <Checkbox
                            checked={allInSectionSelected}
                            onCheckedChange={() => toggleSection(sectionIds)}
                            aria-label={`Zaznacz sekcję ${letter}`}
                          />
                        </th>
                        <th className="px-3 py-2.5">Nazwisko i imię</th>
                        {!hideGroupColumn && <th className="px-3 py-2.5">Grupa</th>}
                        <th className="px-3 py-2.5">Data urodzenia</th>
                        <th className="px-3 py-2.5">Email</th>
                        <th className="px-3 py-2.5">Telefon</th>
                        <th className="px-3 py-2.5">Notatka</th>
                        <th className="px-2 py-2.5 text-center">WA</th>
                        <th className="px-2 py-2.5 text-center">Wpisowe</th>
                        <th className="px-2 py-2.5 text-center">Umowa</th>
                        <th className="px-3 py-2.5 text-right">Akcje</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {sectionRows.map((p, idx) => {
                        const isSelected = selectedIds.has(p.id);
                        const colors = p.group ? getGroupColor(p.group.name) : null;
                        const age = (() => {
                          try {
                            return differenceInYears(new Date(), parseISO(p.birth_date));
                          } catch {
                            return null;
                          }
                        })();
                        const emailKey = `e-${p.id}`;
                        const phoneKey = `p-${p.id}`;

                        return (
                          <tr
                            key={p.id}
                            className={cn(
                              'transition-colors hover:bg-slate-50/70',
                              isSelected && 'bg-blue-50/40',
                              idx % 2 === 1 && !isSelected && 'bg-slate-50/30',
                            )}
                          >
                            <td className="px-3 py-2.5 align-middle">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleOne(p.id)}
                                aria-label={`Zaznacz ${p.first_name} ${p.last_name}`}
                              />
                            </td>

                            <td className="px-3 py-2.5">
                              <Link
                                href={`/admin/participants/${p.id}`}
                                className="text-sm font-semibold text-slate-900 hover:text-blue-600 hover:underline"
                              >
                                {p.last_name} {p.first_name}
                              </Link>
                            </td>

                            {!hideGroupColumn && (
                              <td className="px-3 py-2.5">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button
                                      disabled={pendingGroupId === p.id}
                                      className={cn(
                                        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold transition-colors hover:opacity-80',
                                        colors
                                          ? cn(colors.bg, colors.text, colors.border)
                                          : 'border-slate-200 bg-slate-100 text-slate-500',
                                      )}
                                    >
                                      {pendingGroupId === p.id ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <span
                                          className={cn(
                                            'h-1.5 w-1.5 rounded-full',
                                            colors?.dot ?? 'bg-slate-400',
                                          )}
                                        />
                                      )}
                                      {p.group?.name ?? 'Bez kategorii'}
                                      <ChevronDown className="h-3 w-3 opacity-60" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
                                    {allGroups.map((g) => (
                                      <DropdownMenuItem
                                        key={g.id}
                                        onClick={() => changeGroup(p.id, g.id, g.name)}
                                        disabled={p.group?.id === g.id}
                                      >
                                        {g.name}
                                        {p.group?.id === g.id && (
                                          <Check className="ml-auto h-3.5 w-3.5 text-blue-600" />
                                        )}
                                      </DropdownMenuItem>
                                    ))}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </td>
                            )}

                            <td className="px-3 py-2.5 whitespace-nowrap text-sm text-slate-600">
                              {format(parseISO(p.birth_date), 'dd.MM.yyyy')}
                              {age !== null && (
                                <span className="ml-1 text-xs text-slate-400">
                                  ({age} l.)
                                </span>
                              )}
                            </td>

                            <td className="px-3 py-2.5 max-w-0">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() => copy(p.parent.email, emailKey)}
                                    className="group flex w-full items-center gap-1 truncate text-left text-sm text-slate-600 hover:text-blue-600"
                                  >
                                    <span className="truncate">{p.parent.email || '—'}</span>
                                    {copiedKey === emailKey ? (
                                      <Check className="h-3 w-3 flex-shrink-0 text-green-500" />
                                    ) : (
                                      <Copy className="h-3 w-3 flex-shrink-0 opacity-0 group-hover:opacity-50" />
                                    )}
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>Kliknij aby skopiować</TooltipContent>
                              </Tooltip>
                              {p.parent.secondary_email && (
                                <p className="truncate text-xs text-slate-400">
                                  {p.parent.secondary_email}
                                </p>
                              )}
                            </td>

                            <td className="px-3 py-2.5">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() => copy(p.parent.phone, phoneKey)}
                                    className="group flex items-center gap-1 whitespace-nowrap text-sm text-slate-600 hover:text-blue-600"
                                  >
                                    {p.parent.phone || '—'}
                                    {copiedKey === phoneKey ? (
                                      <Check className="h-3 w-3 flex-shrink-0 text-green-500" />
                                    ) : (
                                      <Copy className="h-3 w-3 flex-shrink-0 opacity-0 group-hover:opacity-50" />
                                    )}
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>Kliknij aby skopiować</TooltipContent>
                              </Tooltip>
                              {p.parent.secondary_phone && (
                                <p className="whitespace-nowrap text-xs text-slate-400">
                                  {p.parent.secondary_phone}
                                </p>
                              )}
                            </td>

                            <td className="px-3 py-2.5">
                              {p.notes ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      onClick={() =>
                                        setNoteDialog({
                                          participantId: p.id,
                                          participantName: `${p.first_name} ${p.last_name}`,
                                          text: p.notes ?? '',
                                        })
                                      }
                                      className="group flex max-w-[140px] items-center gap-1.5 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-700 ring-1 ring-amber-200 transition-colors hover:bg-amber-100"
                                    >
                                      <StickyNote className="h-3 w-3 flex-shrink-0" />
                                      <span className="truncate">{p.notes}</span>
                                      <PencilLine className="h-3 w-3 flex-shrink-0 opacity-0 group-hover:opacity-60" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs whitespace-pre-wrap">
                                    {p.notes}
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                <button
                                  onClick={() =>
                                    setNoteDialog({
                                      participantId: p.id,
                                      participantName: `${p.first_name} ${p.last_name}`,
                                      text: '',
                                    })
                                  }
                                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600"
                                >
                                  <PencilLine className="h-3 w-3" />
                                  Dodaj
                                </button>
                              )}
                            </td>

                            <td className="px-2 py-2.5 text-center">
                              <Checkbox
                                checked={p.has_whatsapp}
                                disabled={pendingFlag === `${p.id}:has_whatsapp`}
                                onCheckedChange={(v) =>
                                  toggleFlag(p.id, 'has_whatsapp', v === true)
                                }
                                aria-label="WhatsApp"
                              />
                            </td>
                            <td className="px-2 py-2.5 text-center">
                              <Checkbox
                                checked={p.entry_fee_paid}
                                disabled={pendingFlag === `${p.id}:entry_fee_paid`}
                                onCheckedChange={(v) =>
                                  toggleFlag(p.id, 'entry_fee_paid', v === true)
                                }
                                aria-label="Wpisowe"
                              />
                            </td>
                            <td className="px-2 py-2.5 text-center">
                              <Checkbox
                                checked={p.contract_signed}
                                disabled={pendingFlag === `${p.id}:contract_signed`}
                                onCheckedChange={(v) =>
                                  toggleFlag(p.id, 'contract_signed', v === true)
                                }
                                aria-label="Umowa"
                              />
                            </td>

                            <td className="px-3 py-2.5 text-right">
                              <Link
                                href={`/admin/participants/${p.id}`}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 transition-colors hover:bg-blue-50 hover:text-blue-700 hover:ring-blue-200"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                Szczegóły
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                      {/* spacer to keep colCount consistent for empty case */}
                      {sectionRows.length === 0 && (
                        <tr>
                          <td
                            colSpan={colCount}
                            className="px-3 py-6 text-center text-sm text-slate-400"
                          >
                            Brak uczestników
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={noteDialog !== null} onOpenChange={(o) => !o && setNoteDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <StickyNote className="h-4 w-4" />
              Notatka — {noteDialog?.participantName}
            </DialogTitle>
            <DialogDescription>Notatka widoczna tylko dla adminów.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={noteDialog?.text ?? ''}
            onChange={(e) =>
              setNoteDialog((prev) => (prev ? { ...prev, text: e.target.value } : prev))
            }
            placeholder="Wpisz notatkę..."
            rows={5}
            className="resize-none"
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setNoteDialog(null)}
              disabled={isSavingNote}
            >
              Anuluj
            </Button>
            <Button onClick={saveNote} disabled={isSavingNote}>
              {isSavingNote && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Zapisz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
