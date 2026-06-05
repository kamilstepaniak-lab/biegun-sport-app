'use client';

import { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock,
  Copy,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Upload,
  XCircle,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import {
  ParticipantsTable,
  type ParticipantRow,
} from '@/components/admin/participants-table';
import {
  createGroup,
  deleteGroup,
  deleteParticipants,
  renameGroup,
  type GroupWithParticipants,
  type ParticipantInGroup,
} from '@/lib/actions/groups';
import {
  fixContactData,
  getImportBufferData,
  resetImportStatus,
  runImport,
  type ImportStats,
} from '@/lib/actions/import';
import { getGroupColor } from '@/lib/group-colors';
import { GroupIcon } from '@/lib/group-icons';
import { cn } from '@/lib/utils';
import type { Group } from '@/types';

interface GroupsListProps {
  groups: GroupWithParticipants[];
  importStats: { total: number; oczekuje: number; zaimportowano: number; blad: number };
}

function toRow(group: GroupWithParticipants, p: ParticipantInGroup): ParticipantRow {
  return {
    id: p.id,
    first_name: p.first_name,
    last_name: p.last_name,
    birth_date: p.birth_date,
    notes: p.notes,
    has_whatsapp: p.has_whatsapp,
    entry_fee_paid: p.entry_fee_paid,
    contract_signed: p.contract_signed,
    group: { id: group.id, name: group.name },
    parent: {
      email: p.parent.email,
      phone: p.parent.phone,
      secondary_email: p.parent.secondary_email,
      secondary_phone: p.parent.secondary_phone,
    },
  };
}

function getBirthYearsLabel(participants: ParticipantInGroup[]) {
  const years = participants
    .map((p) => {
      const year = new Date(p.birth_date).getFullYear();
      return Number.isNaN(year) ? null : year;
    })
    .filter((year): year is number => year !== null);

  if (years.length === 0) return null;
  const min = Math.min(...years);
  const max = Math.max(...years);
  return min === max ? `${min}` : `${min}-${max}`;
}

export function GroupsList({ groups, importStats }: GroupsListProps) {
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Import
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [importResult, setImportResult] = useState<ImportStats | null>(null);
  const [importData, setImportData] = useState<Array<{
    id: number;
    nazwisko_dziecka: string | null;
    imie_dziecka: string | null;
    data_urodzenia: string | null;
    mail_1: string | null;
    telefon_1: string | null;
    sekcja: string | null;
    status_importu: string | null;
    blad_opis: string | null;
  }>>([]);

  // Group CRUD
  const [showAddGroupDialog, setShowAddGroupDialog] = useState(false);
  const [showDeleteGroupDialog, setShowDeleteGroupDialog] = useState(false);
  const [showRenameGroupDialog, setShowRenameGroupDialog] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<GroupWithParticipants | null>(null);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);
  const [isRenamingGroup, setIsRenamingGroup] = useState(false);

  // Flat list of groups for ParticipantsTable (used for inline group dropdown)
  const flatGroups: Group[] = useMemo(
    () =>
      groups.map((g) => ({
        id: g.id,
        name: g.name,
        description: g.description,
        display_order: g.display_order,
        is_selectable_by_parent: g.is_selectable_by_parent,
        created_at: g.created_at,
      })),
    [groups],
  );

  // Filtruj uczestników po wyszukiwarce
  const filteredGroups = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return groups.map((group) => {
      let participants = group.participants;
      if (q) {
        participants = participants.filter(
          (p) =>
            p.last_name.toLowerCase().includes(q) ||
            p.first_name.toLowerCase().includes(q) ||
            `${p.last_name} ${p.first_name}`.toLowerCase().includes(q) ||
            `${p.first_name} ${p.last_name}`.toLowerCase().includes(q),
        );
      }
      return { ...group, participants, originalCount: group.participantCount };
    });
  }, [groups, searchQuery]);

  const groupsToShow = useMemo(() => {
    if (searchQuery.trim()) {
      return filteredGroups.filter((g) => g.participants.length > 0);
    }
    return filteredGroups;
  }, [filteredGroups, searchQuery]);

  function toggleGroup(groupId: string) {
    setOpenGroupId((current) => (current === groupId ? null : groupId));
  }

  async function handleDeleteSelected() {
    if (selectedIds.size === 0) return;
    setIsDeleting(true);
    try {
      const result = await deleteParticipants(Array.from(selectedIds));
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Usunięto ${result.deleted} uczestników`);
        setSelectedIds(new Set());
        window.location.reload();
      }
    } catch {
      toast.error('Wystąpił błąd podczas usuwania');
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  }

  async function handleOpenImport() {
    setShowImportDialog(true);
    setImportResult(null);
    const data = await getImportBufferData();
    setImportData(data);
  }

  async function handleImport() {
    setIsImporting(true);
    try {
      const result = await runImport();
      setImportResult(result);
      if (result.imported > 0) toast.success(`Zaimportowano ${result.imported} z ${result.total} rekordów`);
      if (result.errors > 0) toast.error(`${result.errors} rekordów z błędami`);
      if (result.total === 0) toast.info('Brak rekordów do importu');
      setTimeout(() => window.location.reload(), 1500);
    } catch {
      toast.error('Wystąpił błąd podczas importu');
    } finally {
      setIsImporting(false);
    }
  }

  async function handleFixContacts() {
    setIsImporting(true);
    try {
      const result = await fixContactData();
      if (result.fixed > 0) toast.success(`Zaktualizowano dane kontaktowe ${result.fixed} rodziców`);
      if (result.errors > 0) toast.error(`${result.errors} błędów przy aktualizacji`);
      setTimeout(() => window.location.reload(), 1500);
    } catch {
      toast.error('Wystąpił błąd');
    } finally {
      setIsImporting(false);
    }
  }

  async function handleResetErrors() {
    setIsResetting(true);
    try {
      const result = await resetImportStatus();
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Zresetowano statusy błędnych rekordów');
        setTimeout(() => window.location.reload(), 1000);
      }
    } catch {
      toast.error('Wystąpił błąd');
    } finally {
      setIsResetting(false);
    }
  }

  async function handleCreateGroup() {
    if (!newGroupName.trim()) {
      toast.error('Podaj nazwę grupy');
      return;
    }
    setIsCreatingGroup(true);
    try {
      const result = await createGroup(newGroupName);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Grupa utworzona');
        setNewGroupName('');
        setShowAddGroupDialog(false);
        window.location.reload();
      }
    } catch {
      toast.error('Wystąpił błąd');
    } finally {
      setIsCreatingGroup(false);
    }
  }

  async function handleDeleteGroup() {
    if (!selectedGroup) return;
    setIsDeletingGroup(true);
    try {
      const result = await deleteGroup(selectedGroup.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Grupa usunięta');
        setShowDeleteGroupDialog(false);
        setSelectedGroup(null);
        window.location.reload();
      }
    } catch {
      toast.error('Wystąpił błąd');
    } finally {
      setIsDeletingGroup(false);
    }
  }

  async function handleRenameGroup() {
    if (!selectedGroup || !newGroupName.trim()) {
      toast.error('Podaj nową nazwę grupy');
      return;
    }
    setIsRenamingGroup(true);
    try {
      const result = await renameGroup(selectedGroup.id, newGroupName);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Nazwa grupy zmieniona');
        setNewGroupName('');
        setShowRenameGroupDialog(false);
        setSelectedGroup(null);
        window.location.reload();
      }
    } catch {
      toast.error('Wystąpił błąd');
    } finally {
      setIsRenamingGroup(false);
    }
  }

  function openRenameDialog(group: GroupWithParticipants, e: React.MouseEvent) {
    e.stopPropagation();
    setSelectedGroup(group);
    setNewGroupName(group.name);
    setShowRenameGroupDialog(true);
  }

  function openDeleteDialog(group: GroupWithParticipants, e: React.MouseEvent) {
    e.stopPropagation();
    setSelectedGroup(group);
    setShowDeleteGroupDialog(true);
  }

  function copySelectedEmails() {
    const emails = new Set<string>();
    groups.forEach((group) => {
      group.participants.forEach((p) => {
        if (selectedIds.has(p.id)) {
          if (p.parent.email) emails.add(p.parent.email);
          if (p.parent.secondary_email) emails.add(p.parent.secondary_email);
        }
      });
    });
    const list = Array.from(emails).join(', ');
    navigator.clipboard.writeText(list).then(() => {
      toast.success(`Skopiowano ${emails.size} adresów email`);
    });
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Pasek akcji */}
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Szukaj po nazwisku..."
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

            <button
              onClick={handleOpenImport}
              className={cn(
                'inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors',
                importStats.oczekuje > 0
                  ? 'bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50'
                  : 'text-gray-500 hover:bg-gray-100',
              )}
            >
              <Upload className="h-4 w-4" />
              Import{importStats.oczekuje > 0 ? ` (${importStats.oczekuje})` : ''}
            </button>

            <button
              onClick={() => setShowAddGroupDialog(true)}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Dodaj grupę
            </button>
          </div>

          {selectedIds.size > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-xl bg-white px-3 py-1.5 text-sm text-gray-500 ring-1 ring-gray-100">
                Zaznaczono: {selectedIds.size}
              </span>
              <button
                onClick={copySelectedEmails}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                <Copy className="h-4 w-4" />
                Kopiuj emaile
              </button>
              <button
                onClick={() => setShowDeleteDialog(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
              >
                <Trash2 className="h-4 w-4" />
                Usuń zaznaczone
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-gray-600 ring-1 ring-gray-200 transition-colors hover:bg-gray-50"
              >
                Odznacz wszystko
              </button>
            </div>
          )}
        </div>

        {searchQuery && (
          <p className="text-sm text-gray-500">
            Znaleziono {groupsToShow.reduce((acc, g) => acc + g.participants.length, 0)} uczestników
          </p>
        )}

        {/* Statystyki */}
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <p className="text-2xl font-bold text-slate-900">{groups.length}</p>
            <p className="mt-1 text-xs font-medium text-slate-500">Grupy</p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <p className="text-2xl font-bold text-slate-900">
              {groups.reduce((sum, group) => sum + group.participantCount, 0)}
            </p>
            <p className="mt-1 text-xs font-medium text-slate-500">Uczestnicy</p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <p className="text-2xl font-bold text-amber-600">{importStats.oczekuje}</p>
            <p className="mt-1 text-xs font-medium text-slate-500">Oczekuje w imporcie</p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <p className="text-2xl font-bold text-red-600">{importStats.blad}</p>
            <p className="mt-1 text-xs font-medium text-slate-500">Błędy w imporcie</p>
          </div>
        </div>

        {/* Lista grup */}
        {groupsToShow.map((group) => {
          const colors = getGroupColor(group.name);
          const isOpen = openGroupId === group.id || (!!searchQuery && group.participants.length > 0);
          const rows = group.participants.map((p) => toRow(group, p));
          const selectedInGroup = group.participants.filter((p) => selectedIds.has(p.id)).length;
          const birthYearsLabel = getBirthYearsLabel(group.participants);

          return (
            <Collapsible key={group.id} open={isOpen} onOpenChange={() => toggleGroup(group.id)}>
              <div
                className={cn(
                  'overflow-hidden rounded-2xl border-2 bg-white transition-all duration-200',
                  isOpen
                    ? 'border-blue-600 shadow-lg shadow-blue-600/15'
                    : 'border-slate-200 shadow-sm hover:border-blue-300 hover:shadow-md',
                )}
              >
                <CollapsibleTrigger asChild>
                  <div className="grid cursor-pointer gap-4 p-4 lg:grid-cols-[1fr_auto_auto] lg:items-center">
                    <div className="flex items-center gap-3">
                      <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl', colors.bg)}>
                        <GroupIcon name={group.name} className={cn('h-5 w-5', colors.text)} />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-slate-900">
                          {group.name}
                          {birthYearsLabel && (
                            <span className="ml-2 text-sm font-medium text-slate-500">
                              {birthYearsLabel}
                            </span>
                          )}
                        </h3>
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2 lg:w-[260px]">
                      <div className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Uczestnicy</p>
                        <p className="mt-0.5 text-sm font-bold text-slate-900">
                          {searchQuery && group.participants.length !== group.originalCount
                            ? `${group.participants.length}/${group.originalCount}`
                            : group.participantCount}
                        </p>
                      </div>
                      <div className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Zaznacz.</p>
                        <p className="mt-0.5 text-sm font-bold text-slate-900">{selectedInGroup}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 lg:justify-end">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                            onClick={(e) => openRenameDialog(group, e)}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="rounded-lg">Zmień nazwę</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                            onClick={(e) => openDeleteDialog(group, e)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="rounded-lg">Usuń grupę</TooltipContent>
                      </Tooltip>
                      <div
                        className={cn(
                          'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
                          isOpen ? 'bg-blue-600' : 'bg-gray-50',
                        )}
                      >
                        {isOpen ? (
                          <ChevronUp className="h-4 w-4 text-white" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-gray-500" />
                        )}
                      </div>
                    </div>
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="border-t border-gray-100 bg-slate-50/40 p-4">
                    {rows.length === 0 ? (
                      <div className="p-8 text-center text-sm text-gray-500">
                        {searchQuery ? 'Brak pasujących uczestników' : 'Brak uczestników w tej grupie'}
                      </div>
                    ) : (
                      <ParticipantsTable
                        rows={rows}
                        allGroups={flatGroups}
                        selectedIds={selectedIds}
                        onSelectionChange={setSelectedIds}
                        hideGroupColumn
                      />
                    )}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}

        {/* Brak wyników */}
        {groupsToShow.length === 0 && searchQuery && (
          <div className="py-12 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">
              <Search className="h-7 w-7 text-gray-400" />
            </div>
            <p className="text-sm text-gray-500">
              Nie znaleziono uczestników pasujących do &quot;{searchQuery}&quot;
            </p>
          </div>
        )}
      </div>

      {/* Dialog masowego usuwania */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Usuń zaznaczonych uczestników</AlertDialogTitle>
            <AlertDialogDescription>
              Czy na pewno chcesz usunąć {selectedIds.size} zaznaczonych uczestników? Tej operacji nie
              można cofnąć.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSelected}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? 'Usuwanie...' : 'Usuń'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog dodawania grupy */}
      <Dialog open={showAddGroupDialog} onOpenChange={setShowAddGroupDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dodaj nową grupę</DialogTitle>
            <DialogDescription>Podaj nazwę nowej grupy treningowej.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              placeholder="Nazwa grupy (np. ProKids)"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateGroup();
              }}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowAddGroupDialog(false)}>
              Anuluj
            </Button>
            <Button onClick={handleCreateGroup} disabled={isCreatingGroup || !newGroupName.trim()}>
              {isCreatingGroup ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Tworzenie...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Dodaj grupę
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog usuwania grupy */}
      <AlertDialog open={showDeleteGroupDialog} onOpenChange={setShowDeleteGroupDialog}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Usuń grupę &quot;{selectedGroup?.name}&quot;</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedGroup?.participantCount === 0
                ? 'Czy na pewno chcesz usunąć tę grupę? Tej operacji nie można cofnąć.'
                : `Ta grupa ma ${selectedGroup?.participantCount} uczestników. Usunięcie grupy spowoduje usunięcie przypisań uczestników i wyjazdów do tej grupy. Tej operacji nie można cofnąć.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingGroup}>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteGroup}
              disabled={isDeletingGroup}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeletingGroup ? 'Usuwanie...' : 'Usuń grupę'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog zmiany nazwy grupy */}
      <Dialog open={showRenameGroupDialog} onOpenChange={setShowRenameGroupDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Zmień nazwę grupy</DialogTitle>
            <DialogDescription>
              Podaj nową nazwę dla grupy &quot;{selectedGroup?.name}&quot;.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              placeholder="Nowa nazwa grupy"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameGroup();
              }}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowRenameGroupDialog(false)}>
              Anuluj
            </Button>
            <Button onClick={handleRenameGroup} disabled={isRenamingGroup || !newGroupName.trim()}>
              {isRenamingGroup ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Zapisywanie...
                </>
              ) : (
                'Zapisz'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog importu */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-h-[80vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import bazy klientów</DialogTitle>
            <DialogDescription>
              Zaimportuj dane z tabeli import_buffer. Zostaną utworzone konta rodziców, uczestnicy i
              grupy.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-4 gap-3">
            <div className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-bold">{importStats.total}</p>
              <p className="text-xs text-muted-foreground">Łącznie</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-bold text-yellow-600">{importStats.oczekuje}</p>
              <p className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" /> Oczekujące
              </p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-bold text-emerald-600">{importStats.zaimportowano}</p>
              <p className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3 w-3" /> Zaimportowane
              </p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-bold text-red-600">{importStats.blad}</p>
              <p className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                <XCircle className="h-3 w-3" /> Błędy
              </p>
            </div>
          </div>

          {importResult && (
            <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm font-medium">Wynik importu</p>
              <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
                <div>
                  Przetworzono: <strong>{importResult.total}</strong>
                </div>
                <div className="text-emerald-700">
                  OK: <strong>{importResult.imported}</strong>
                </div>
                <div className="text-red-700">
                  Błędy: <strong>{importResult.errors}</strong>
                </div>
                <div>
                  Nowi rodzice: <strong>{importResult.newParents}</strong>
                </div>
              </div>
              {importResult.details.filter((d) => d.status === 'error').length > 0 && (
                <div className="mt-2 space-y-1">
                  {importResult.details
                    .filter((d) => d.status === 'error')
                    .map((d) => (
                      <p key={d.id} className="text-xs text-red-600">
                        #{d.id} {d.name}: {d.error}
                      </p>
                    ))}
                </div>
              )}
            </div>
          )}

          {importData.length > 0 && (
            <div className="max-h-[300px] overflow-y-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">#</th>
                    <th className="px-3 py-2 text-left font-medium">Nazwisko</th>
                    <th className="px-3 py-2 text-left font-medium">Imię</th>
                    <th className="px-3 py-2 text-left font-medium">Data ur.</th>
                    <th className="px-3 py-2 text-left font-medium">Email</th>
                    <th className="px-3 py-2 text-left font-medium">Sekcja</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {importData.map((row) => (
                    <tr
                      key={row.id}
                      className={
                        row.status_importu === 'zaimportowano'
                          ? 'bg-emerald-50'
                          : row.status_importu === 'blad'
                            ? 'bg-red-50'
                            : ''
                      }
                    >
                      <td className="px-3 py-1.5 text-muted-foreground">{row.id}</td>
                      <td className="px-3 py-1.5 font-medium">{row.nazwisko_dziecka}</td>
                      <td className="px-3 py-1.5">{row.imie_dziecka}</td>
                      <td className="px-3 py-1.5">{row.data_urodzenia}</td>
                      <td className="px-3 py-1.5 text-xs">{row.mail_1}</td>
                      <td className="px-3 py-1.5">
                        <Badge variant="outline" className="text-xs">
                          {row.sekcja}
                        </Badge>
                      </td>
                      <td className="px-3 py-1.5">
                        {row.status_importu === 'oczekuje' && (
                          <Badge variant="secondary" className="gap-1 text-xs">
                            <Clock className="h-3 w-3" /> Czeka
                          </Badge>
                        )}
                        {row.status_importu === 'zaimportowano' && (
                          <Badge className="gap-1 bg-emerald-100 text-xs text-emerald-800">
                            <CheckCircle2 className="h-3 w-3" /> OK
                          </Badge>
                        )}
                        {row.status_importu === 'blad' && (
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="destructive" className="gap-1 text-xs">
                                <XCircle className="h-3 w-3" /> Błąd
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>{row.blad_opis}</TooltipContent>
                          </Tooltip>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <div className="flex gap-2">
              {importStats.blad > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetErrors}
                  disabled={isResetting}
                  className="gap-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  {isResetting ? 'Resetowanie...' : `Reset błędów (${importStats.blad})`}
                </Button>
              )}
              {importStats.zaimportowano > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleFixContacts}
                  disabled={isImporting}
                  className="gap-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  Napraw telefony/maile
                </Button>
              )}
            </div>
            <Button onClick={handleImport} disabled={isImporting || importStats.oczekuje === 0} className="gap-2">
              <Upload className="h-4 w-4" />
              {isImporting ? 'Importowanie...' : `Importuj (${importStats.oczekuje})`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
