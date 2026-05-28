'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Download,
  Loader2,
  Plus,
  Search,
  Trash2,
  Users as UsersIcon,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ParticipantsTable,
  type ParticipantRow,
} from '@/components/admin/participants-table';
import { AddExternalChildDialog } from './add-external-child-dialog';
import { deleteParticipants } from '@/lib/actions/groups';
import { bulkUpdateParticipantGroup } from '@/lib/actions/participants';
import type { ParticipantFull, Group } from '@/types';

interface ParticipantsListProps {
  participants: ParticipantFull[];
  groups: Group[];
}

const ALL = 'all';

function toRow(p: ParticipantFull): ParticipantRow {
  return {
    id: p.id,
    first_name: p.first_name,
    last_name: p.last_name,
    birth_date: p.birth_date,
    notes: p.notes ?? null,
    group: p.group ? { id: p.group.id, name: p.group.name } : null,
    parent: {
      email: p.parent?.email ?? '',
      phone: p.parent?.phone ?? '',
      secondary_email: p.parent?.secondary_email ?? null,
      secondary_phone: p.parent?.secondary_phone ?? null,
    },
  };
}

export function ParticipantsList({ participants, groups }: ParticipantsListProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState<string>(ALL);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [showBulkGroupDialog, setShowBulkGroupDialog] = useState(false);
  const [bulkGroupId, setBulkGroupId] = useState<string>('');
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const rows = useMemo(() => {
    let list = participants;

    if (groupFilter !== ALL) {
      list = list.filter((p) => p.group?.id === groupFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((p) => {
        const fullName = `${p.last_name} ${p.first_name}`.toLowerCase();
        const reverse = `${p.first_name} ${p.last_name}`.toLowerCase();
        const parentName = `${p.parent?.last_name ?? ''} ${p.parent?.first_name ?? ''}`.toLowerCase();
        const email = (p.parent?.email ?? '').toLowerCase();
        return (
          fullName.includes(q) ||
          reverse.includes(q) ||
          parentName.includes(q) ||
          email.includes(q)
        );
      });
    }

    return list.map(toRow);
  }, [participants, searchQuery, groupFilter]);

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function handleBulkGroupChange() {
    if (!bulkGroupId || selectedIds.size === 0) return;
    setIsBulkUpdating(true);
    try {
      const result = await bulkUpdateParticipantGroup(Array.from(selectedIds), bulkGroupId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Zmieniono grupę u ${result.updated} uczestników`);
        setShowBulkGroupDialog(false);
        setBulkGroupId('');
        clearSelection();
        router.refresh();
      }
    } finally {
      setIsBulkUpdating(false);
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    setIsDeleting(true);
    try {
      const result = await deleteParticipants(Array.from(selectedIds));
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Usunięto ${result.deleted} uczestników`);
        clearSelection();
        setShowDeleteDialog(false);
        router.refresh();
      }
    } finally {
      setIsDeleting(false);
    }
  }

  function exportCsv() {
    const ids = selectedIds.size > 0 ? selectedIds : new Set(rows.map((r) => r.id));
    const exportRows = rows.filter((r) => ids.has(r.id));
    if (exportRows.length === 0) {
      toast.info('Brak danych do eksportu');
      return;
    }

    const headers = ['Nazwisko', 'Imię', 'Data urodzenia', 'Grupa', 'Email', 'Telefon', 'Notatka'];
    const escape = (v: string) => {
      const safe = v.replace(/"/g, '""');
      return /[",;\n]/.test(safe) ? `"${safe}"` : safe;
    };
    const lines = [headers.join(';')];
    for (const r of exportRows) {
      lines.push(
        [
          r.last_name,
          r.first_name,
          r.birth_date,
          r.group?.name ?? 'Bez kategorii',
          r.parent.email,
          r.parent.phone,
          r.notes ?? '',
        ]
          .map(escape)
          .join(';'),
      );
    }

    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `uczestnicy-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      {/* Pasek filtrów */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:w-auto">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              placeholder="Szukaj po nazwisku, imieniu, rodzicu lub emailu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-11 w-full rounded-xl border-0 bg-white pl-10 pr-10 text-base text-gray-700 ring-1 ring-gray-200 transition-all placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 md:text-sm"
            />
            {searchQuery && (
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                onClick={() => setSearchQuery('')}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            className="h-11 rounded-xl border-0 bg-white px-3 text-base text-gray-700 ring-1 ring-gray-200 transition-all focus:outline-none focus:ring-2 focus:ring-gray-300 md:text-sm"
          >
            <option value={ALL}>Wszystkie grupy</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={() => setShowAddDialog(true)}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Dodaj dziecko z zewnątrz
        </button>
      </div>

      {/* Licznik + pasek akcji masowych */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-500">
          {rows.length === participants.length
            ? `${participants.length} ${pluralize(participants.length, 'uczestnik', 'uczestników', 'uczestników')}`
            : `Znaleziono ${rows.length} z ${participants.length}`}
        </p>

        {selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 ring-1 ring-blue-200">
            <span className="text-sm font-medium text-blue-900">
              Zaznaczono: {selectedIds.size}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowBulkGroupDialog(true)}
              className="h-8 gap-1.5"
            >
              <UsersIcon className="h-3.5 w-3.5" />
              Zmień grupę
            </Button>
            <Button size="sm" variant="outline" onClick={exportCsv} className="h-8 gap-1.5">
              <Download className="h-3.5 w-3.5" />
              Eksport CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowDeleteDialog(true)}
              className="h-8 gap-1.5 text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Usuń
            </Button>
            <Button size="sm" variant="ghost" onClick={clearSelection} className="h-8">
              Wyczyść
            </Button>
          </div>
        )}
      </div>

      <ParticipantsTable
        rows={rows}
        allGroups={groups}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        emptyMessage={
          searchQuery || groupFilter !== ALL
            ? 'Brak uczestników pasujących do filtrów'
            : 'Brak uczestników w systemie'
        }
      />

      <AddExternalChildDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        groups={groups}
      />

      {/* Dialog masowej zmiany grupy */}
      <Dialog open={showBulkGroupDialog} onOpenChange={setShowBulkGroupDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Zmień grupę zaznaczonych</DialogTitle>
            <DialogDescription>
              Wybierz grupę dla {selectedIds.size}{' '}
              {pluralize(selectedIds.size, 'uczestnika', 'uczestników', 'uczestników')}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Select value={bulkGroupId} onValueChange={setBulkGroupId}>
              <SelectTrigger>
                <SelectValue placeholder="Wybierz grupę" />
              </SelectTrigger>
              <SelectContent>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowBulkGroupDialog(false)}
              disabled={isBulkUpdating}
            >
              Anuluj
            </Button>
            <Button
              onClick={handleBulkGroupChange}
              disabled={!bulkGroupId || isBulkUpdating}
            >
              {isBulkUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Zmień grupę
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog masowego usuwania */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Usuń zaznaczonych uczestników</AlertDialogTitle>
            <AlertDialogDescription>
              Czy na pewno usunąć {selectedIds.size}{' '}
              {pluralize(selectedIds.size, 'uczestnika', 'uczestników', 'uczestników')}? Tej
              operacji nie można cofnąć.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? 'Usuwanie...' : 'Usuń'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function pluralize(n: number, one: string, few: string, many: string) {
  if (n === 1) return one;
  const lastTwo = n % 100;
  const last = n % 10;
  if (lastTwo >= 12 && lastTwo <= 14) return many;
  if (last >= 2 && last <= 4) return few;
  return many;
}
