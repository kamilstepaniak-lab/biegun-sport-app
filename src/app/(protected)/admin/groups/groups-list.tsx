'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  ChevronDown,
  ChevronUp,
  Users,
  Copy,
  Check,
  Edit,
  Trash2,
  Search,
  X,
  Upload,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  Plus,
  Pencil,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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

import { deleteParticipants, createGroup, deleteGroup, renameGroup, type GroupWithParticipants, type ParticipantInGroup } from '@/lib/actions/groups';
import { runImport, resetImportStatus, fixContactData, getImportBufferData, type ImportStats } from '@/lib/actions/import';
import { getGroupColor } from '@/lib/group-colors';
import { cn } from '@/lib/utils';

interface GroupsListProps {
  groups: GroupWithParticipants[];
  importStats: { total: number; oczekuje: number; zaimportowano: number; blad: number };
}

export function GroupsList({ groups, importStats }: GroupsListProps) {
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Import state
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [importResult, setImportResult] = useState<ImportStats | null>(null);
  const [importData, setImportData] = useState<Array<{
    id: number; nazwisko_dziecka: string | null; imie_dziecka: string | null;
    data_urodzenia: string | null; mail_1: string | null; telefon_1: string | null;
    sekcja: string | null; status_importu: string | null; blad_opis: string | null;
  }>>([]);

  // Groups management state
  const [showAddGroupDialog, setShowAddGroupDialog] = useState(false);
  const [showDeleteGroupDialog, setShowDeleteGroupDialog] = useState(false);
  const [showRenameGroupDialog, setShowRenameGroupDialog] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<GroupWithParticipants | null>(null);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);
  const [isRenamingGroup, setIsRenamingGroup] = useState(false);

  // Filtruj i sortuj uczestników po nazwisku
  const filteredGroups = useMemo(() => {
    return groups.map(group => {
      let participants = [...group.participants];

      // Filtruj po wyszukiwarce
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        participants = participants.filter(p =>
          p.last_name.toLowerCase().includes(query) ||
          p.first_name.toLowerCase().includes(query) ||
          `${p.last_name} ${p.first_name}`.toLowerCase().includes(query) ||
          `${p.first_name} ${p.last_name}`.toLowerCase().includes(query)
        );
      }

      // Sortuj po nazwisku
      participants.sort((a, b) => a.last_name.localeCompare(b.last_name, 'pl'));

      return {
        ...group,
        participants,
        originalCount: group.participantCount,
      };
    });
  }, [groups, searchQuery]);

  // Automatycznie otwórz grupy które mają pasujących uczestników przy wyszukiwaniu
  const groupsToShow = useMemo(() => {
    if (searchQuery.trim()) {
      return filteredGroups.filter(g => g.participants.length > 0);
    }
    return filteredGroups;
  }, [filteredGroups, searchQuery]);

  function toggleGroup(groupId: string) {
    const newOpen = new Set(openGroups);
    if (newOpen.has(groupId)) {
      newOpen.delete(groupId);
    } else {
      newOpen.add(groupId);
    }
    setOpenGroups(newOpen);
  }

  function toggleParticipant(participantId: string) {
    const newSelected = new Set(selectedParticipants);
    if (newSelected.has(participantId)) {
      newSelected.delete(participantId);
    } else {
      newSelected.add(participantId);
    }
    setSelectedParticipants(newSelected);
  }

  function toggleAllInGroup(groupId: string, participants: ParticipantInGroup[]) {
    const newSelected = new Set(selectedParticipants);
    const allSelected = participants.every(p => newSelected.has(p.id));

    if (allSelected) {
      participants.forEach(p => newSelected.delete(p.id));
    } else {
      participants.forEach(p => newSelected.add(p.id));
    }
    setSelectedParticipants(newSelected);
  }

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

  async function handleDeleteSelected() {
    if (selectedParticipants.size === 0) return;

    setIsDeleting(true);
    try {
      const result = await deleteParticipants(Array.from(selectedParticipants));
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Usunięto ${result.deleted} uczestników`);
        setSelectedParticipants(new Set());
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
      if (result.imported > 0) {
        toast.success(`Zaimportowano ${result.imported} z ${result.total} rekordów`);
      }
      if (result.errors > 0) {
        toast.error(`${result.errors} rekordów z błędami`);
      }
      if (result.total === 0) {
        toast.info('Brak rekordów do importu');
      }
      // Odśwież stronę po imporcie
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
      if (result.fixed > 0) {
        toast.success(`Zaktualizowano dane kontaktowe ${result.fixed} rodziców`);
      }
      if (result.errors > 0) {
        toast.error(`${result.errors} błędów przy aktualizacji`);
      }
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

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Wyszukiwarka i akcje */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                placeholder="Szukaj po nazwisku..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-10 pr-10 rounded-xl bg-white ring-1 ring-gray-200 border-0 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-all"
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
                'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-colors shrink-0',
                importStats.oczekuje > 0
                  ? 'bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50'
                  : 'text-gray-500 hover:bg-gray-100'
              )}
            >
              <Upload className="h-4 w-4" />
              Import{importStats.oczekuje > 0 ? ` (${importStats.oczekuje})` : ''}
            </button>

            <button
              onClick={() => setShowAddGroupDialog(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-xl transition-colors shrink-0"
            >
              <Plus className="h-4 w-4" />
              Dodaj grupę
            </button>
          </div>

          {selectedParticipants.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 bg-white rounded-xl px-3 py-1.5 ring-1 ring-gray-100">
                Zaznaczono: {selectedParticipants.size}
              </span>
              <button
                onClick={() => setShowDeleteDialog(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-xl transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                Usuń zaznaczone
              </button>
              <button
                onClick={() => setSelectedParticipants(new Set())}
                className="px-4 py-2 bg-white hover:bg-gray-50 text-gray-600 text-sm font-medium rounded-xl ring-1 ring-gray-200 transition-colors"
              >
                Odznacz wszystko
              </button>
            </div>
          )}
        </div>

        {/* Wyniki wyszukiwania */}
        {searchQuery && (
          <p className="text-sm text-gray-500">
            Znaleziono {groupsToShow.reduce((acc, g) => acc + g.participants.length, 0)} uczestników
          </p>
        )}

        {/* Lista grup */}
        {groupsToShow.map((group) => {
          const colors = getGroupColor(group.name);
          const isOpen = openGroups.has(group.id) || (!!searchQuery && group.participants.length > 0);
          return (
          <Collapsible
            key={group.id}
            open={isOpen}
            onOpenChange={() => toggleGroup(group.id)}
          >
            <div className={cn(
              'bg-white rounded-2xl transition-all duration-200',
              isOpen
                ? 'shadow-lg ring-1 ring-gray-200'
                : 'shadow-sm ring-1 ring-gray-100 hover:shadow-md'
            )}>
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between p-4 cursor-pointer">
                  <div className="flex items-center gap-3">
                    {/* Kolorowa ikona grupy */}
                    <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', colors.bg)}>
                      <Users className={cn('h-4 w-4', colors.text)} />
                    </div>
                    <h3 className="font-semibold text-gray-900">{group.name}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-500 bg-gray-100 rounded-lg px-2.5 py-1">
                      {searchQuery && group.participants.length !== group.originalCount
                        ? `${group.participants.length} / ${group.originalCount}`
                        : `${group.participantCount}`
                      } uczestników
                    </span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
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
                          className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                          onClick={(e) => openDeleteDialog(group, e)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="rounded-lg">Usuń grupę</TooltipContent>
                    </Tooltip>
                    <div className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
                      isOpen ? 'bg-gray-100' : 'bg-gray-50'
                    )}>
                      {isOpen ? (
                        <ChevronUp className="h-4 w-4 text-gray-500" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-gray-500" />
                      )}
                    </div>
                  </div>
                </div>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="border-t border-gray-100">
                  {group.participants.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 text-sm">
                      {searchQuery ? 'Brak pasujących uczestników' : 'Brak uczestników w tej grupie'}
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {/* Nagłówek z checkbox zaznacz wszystko */}
                      <div className="px-4 py-2 bg-gray-50/50 flex items-center gap-4">
                        <Checkbox
                          checked={group.participants.every(p => selectedParticipants.has(p.id))}
                          onCheckedChange={() => toggleAllInGroup(group.id, group.participants)}
                        />
                        <span className="text-xs text-gray-400 font-medium">
                          Zaznacz wszystkich w grupie
                        </span>
                      </div>

                      {/* Nagłówek tabeli */}
                      <div className="hidden md:grid grid-cols-[auto_2fr_1fr_1fr_2fr_1.5fr_auto] gap-4 px-4 py-2 bg-gray-50/30 text-xs font-medium text-gray-400 uppercase tracking-wider">
                        <div className="w-5"></div>
                        <div>Nazwisko i imię</div>
                        <div>Data urodzenia</div>
                        <div>Grupa</div>
                        <div>Email</div>
                        <div>Telefon</div>
                        <div className="w-20"></div>
                      </div>

                      {group.participants.map((participant) => {
                        const birthDate = new Date(participant.birth_date);
                        const emailId = `email-${group.id}-${participant.id}`;
                        const phoneId = `phone-${group.id}-${participant.id}`;
                        const isSelected = selectedParticipants.has(participant.id);

                        return (
                          <div
                            key={participant.id}
                            className={`grid grid-cols-1 md:grid-cols-[auto_2fr_1fr_1fr_2fr_1.5fr_auto] gap-2 md:gap-4 px-4 py-3 items-center hover:bg-gray-50/50 transition-colors ${isSelected ? 'bg-blue-50/50' : ''}`}
                          >
                            {/* Checkbox */}
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleParticipant(participant.id)}
                            />

                            {/* Nazwisko i imię */}
                            <div className="font-medium text-gray-900 text-sm">
                              {participant.last_name} {participant.first_name}
                            </div>

                            {/* Data urodzenia */}
                            <div className="text-sm text-gray-500">
                              {format(birthDate, 'dd.MM.yyyy')}
                            </div>

                            {/* Grupa */}
                            <div>
                              <span className={cn(
                                'inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium border',
                                colors.bg, colors.text, colors.border
                              )}>
                                {group.name}
                              </span>
                            </div>

                            {/* Email */}
                            <div>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() => copyToClipboard(participant.parent.email, emailId)}
                                    className="text-sm hover:text-primary cursor-pointer flex items-center gap-1 group truncate"
                                  >
                                    {participant.parent.email}
                                    {copiedField === emailId ? (
                                      <Check className="h-3 w-3 text-green-500 flex-shrink-0" />
                                    ) : (
                                      <Copy className="h-3 w-3 opacity-0 group-hover:opacity-50 flex-shrink-0" />
                                    )}
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>Kliknij aby skopiować</TooltipContent>
                              </Tooltip>
                              {participant.parent.secondary_email && (
                                <p className="text-xs text-muted-foreground truncate">
                                  {participant.parent.secondary_email}
                                </p>
                              )}
                            </div>

                            {/* Telefon */}
                            <div>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() => copyToClipboard(participant.parent.phone, phoneId)}
                                    className="text-sm hover:text-primary cursor-pointer flex items-center gap-1 group"
                                  >
                                    {participant.parent.phone}
                                    {copiedField === phoneId ? (
                                      <Check className="h-3 w-3 text-green-500 flex-shrink-0" />
                                    ) : (
                                      <Copy className="h-3 w-3 opacity-0 group-hover:opacity-50 flex-shrink-0" />
                                    )}
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>Kliknij aby skopiować</TooltipContent>
                              </Tooltip>
                              {participant.parent.secondary_phone && (
                                <p className="text-xs text-muted-foreground">
                                  {participant.parent.secondary_phone}
                                </p>
                              )}
                            </div>

                            {/* Przycisk Edytuj */}
                            <Link
                              href={`/admin/participants/${participant.id}`}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 text-xs font-medium rounded-lg ring-1 ring-gray-200 transition-colors"
                            >
                              <Edit className="h-3.5 w-3.5" />
                              Edytuj
                            </Link>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        );
        })}

        {/* Brak wyników */}
        {groupsToShow.length === 0 && searchQuery && (
          <div className="text-center py-12">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 mx-auto mb-4">
              <Search className="h-7 w-7 text-gray-400" />
            </div>
            <p className="text-gray-500 text-sm">Nie znaleziono uczestników pasujących do &quot;{searchQuery}&quot;</p>
          </div>
        )}
      </div>

      {/* Dialog potwierdzenia usunięcia */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Usuń zaznaczonych uczestników</AlertDialogTitle>
            <AlertDialogDescription>
              Czy na pewno chcesz usunąć {selectedParticipants.size} zaznaczonych uczestników?
              Tej operacji nie można cofnąć.
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
            <DialogDescription>
              Podaj nazwę nowej grupy treningowej.
            </DialogDescription>
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
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Tworzenie...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
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
                : `Ta grupa ma ${selectedGroup?.participantCount} uczestników. Usunięcie grupy spowoduje usunięcie przypisań uczestników i wyjazdów do tej grupy. Tej operacji nie można cofnąć.`
              }
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
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
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
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import bazy klientów</DialogTitle>
            <DialogDescription>
              Zaimportuj dane z tabeli import_buffer. Zostaną utworzone konta rodziców, uczestnicy i grupy.
            </DialogDescription>
          </DialogHeader>

          {/* Statystyki */}
          <div className="grid gap-3 grid-cols-4">
            <div className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-bold">{importStats.total}</p>
              <p className="text-xs text-muted-foreground">Łącznie</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-bold text-yellow-600">{importStats.oczekuje}</p>
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <Clock className="h-3 w-3" /> Oczekujące
              </p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-bold text-green-600">{importStats.zaimportowano}</p>
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Zaimportowane
              </p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-bold text-red-600">{importStats.blad}</p>
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <XCircle className="h-3 w-3" /> Błędy
              </p>
            </div>
          </div>

          {/* Wynik importu */}
          {importResult && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-2">
              <p className="font-medium text-sm">Wynik importu</p>
              <div className="grid gap-2 grid-cols-2 md:grid-cols-4 text-sm">
                <div>Przetworzono: <strong>{importResult.total}</strong></div>
                <div className="text-green-700">OK: <strong>{importResult.imported}</strong></div>
                <div className="text-red-700">Błędy: <strong>{importResult.errors}</strong></div>
                <div>Nowi rodzice: <strong>{importResult.newParents}</strong></div>
              </div>
              {importResult.details.filter(d => d.status === 'error').length > 0 && (
                <div className="mt-2 space-y-1">
                  {importResult.details.filter(d => d.status === 'error').map((d) => (
                    <p key={d.id} className="text-xs text-red-600">
                      #{d.id} {d.name}: {d.error}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Podgląd danych */}
          {importData.length > 0 && (
            <div className="rounded-md border max-h-[300px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
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
                    <tr key={row.id} className={
                      row.status_importu === 'zaimportowano' ? 'bg-green-50' :
                      row.status_importu === 'blad' ? 'bg-red-50' : ''
                    }>
                      <td className="px-3 py-1.5 text-muted-foreground">{row.id}</td>
                      <td className="px-3 py-1.5 font-medium">{row.nazwisko_dziecka}</td>
                      <td className="px-3 py-1.5">{row.imie_dziecka}</td>
                      <td className="px-3 py-1.5">{row.data_urodzenia}</td>
                      <td className="px-3 py-1.5 text-xs">{row.mail_1}</td>
                      <td className="px-3 py-1.5">
                        <Badge variant="outline" className="text-xs">{row.sekcja}</Badge>
                      </td>
                      <td className="px-3 py-1.5">
                        {row.status_importu === 'oczekuje' && (
                          <Badge variant="secondary" className="text-xs gap-1">
                            <Clock className="h-3 w-3" /> Czeka
                          </Badge>
                        )}
                        {row.status_importu === 'zaimportowano' && (
                          <Badge className="bg-green-100 text-green-800 text-xs gap-1">
                            <CheckCircle2 className="h-3 w-3" /> OK
                          </Badge>
                        )}
                        {row.status_importu === 'blad' && (
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="destructive" className="text-xs gap-1">
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

          {/* Przyciski */}
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
            <Button
              onClick={handleImport}
              disabled={isImporting || importStats.oczekuje === 0}
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              {isImporting ? 'Importowanie...' : `Importuj (${importStats.oczekuje})`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
