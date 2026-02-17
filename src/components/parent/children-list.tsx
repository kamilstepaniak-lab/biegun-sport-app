'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { format, differenceInYears } from 'date-fns';
import { pl } from 'date-fns/locale';
import {
  UserPlus,
  Check,
  Edit,
  Trash2,
  Calendar,
  Ruler,
  Users,
  ChevronRight,
  MapPin,
  CreditCard,
  CalendarDays,
} from 'lucide-react';
import { toast } from 'sonner';

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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { EmptyState } from '@/components/shared';
import { saveChildToStorage, clearChildFromStorage } from './child-url-sync';

const STORAGE_KEY = 'biegun_selected_child';

import { deleteParticipant, getParticipantRegistrations } from '@/lib/actions/participants';
import type { ParticipantWithGroup } from '@/types';
import { cn } from '@/lib/utils';

interface ChildrenListProps {
  children: ParticipantWithGroup[];
}

interface DeleteDialogState {
  isOpen: boolean;
  childId: string | null;
  childName: string;
  registrations: Array<{
    id: string;
    trip: { title: string } | { title: string }[] | null;
    payments: Array<{ status: string; amount: number; currency: string }>;
  }>;
  isLoading: boolean;
}

// Kolory dla avatarów dzieci
const avatarColors = [
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-violet-100 text-violet-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
];

export function ChildrenList({ children }: ChildrenListProps) {
  const router = useRouter();
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);

  // Wczytaj z localStorage po zamontowaniu
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.id) setSelectedChildId(parsed.id);
      }
    } catch { /* ignore */ }
  }, []);

  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>({
    isOpen: false,
    childId: null,
    childName: '',
    registrations: [],
    isLoading: false,
  });

  async function handleDeleteClick(e: React.MouseEvent, childId: string) {
    e.stopPropagation();
    const child = children.find((c) => c.id === childId);
    if (!child) return;

    const registrations = await getParticipantRegistrations(childId);

    setDeleteDialog({
      isOpen: true,
      childId,
      childName: `${child.first_name} ${child.last_name}`,
      registrations: registrations as DeleteDialogState['registrations'],
      isLoading: false,
    });
  }

  async function handleDeleteConfirm() {
    if (!deleteDialog.childId) return;

    setDeleteDialog((prev) => ({ ...prev, isLoading: true }));

    try {
      const result = await deleteParticipant(deleteDialog.childId);
      if (result.error) {
        toast.error(result.error);
      } else {
        if (selectedChildId === deleteDialog.childId) {
          setSelectedChildId(null);
          clearChildFromStorage();
        }
        toast.success('Dziecko zostało usunięte');
        router.refresh();
      }
    } catch {
      toast.error('Wystąpił nieoczekiwany błąd');
    } finally {
      setDeleteDialog({
        isOpen: false,
        childId: null,
        childName: '',
        registrations: [],
        isLoading: false,
      });
    }
  }

  function handleSelectChild(child: ParticipantWithGroup) {
    const childName = `${child.first_name} ${child.last_name}`;
    if (selectedChildId === child.id) {
      setSelectedChildId(null);
      clearChildFromStorage();
    } else {
      setSelectedChildId(child.id);
      saveChildToStorage(child.id, childName);
    }
  }

  if (children.length === 0) {
    return (
      <EmptyState
        icon={UserPlus}
        title="Brak dzieci"
        description="Nie dodałeś jeszcze żadnego dziecka. Dodaj pierwsze dziecko, aby móc zapisywać je na wyjazdy."
      />
    );
  }

  const hasUnpaidPayments = deleteDialog.registrations.some((r) =>
    r.payments.some((p) => p.status !== 'paid' && p.status !== 'cancelled')
  );

  const selectedChild = children.find(c => c.id === selectedChildId);

  return (
    <>
      {/* Instrukcja */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-sm text-blue-700 flex items-start gap-3">
        <div className="w-5 h-5 rounded-full bg-blue-200 flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-blue-700 text-xs font-bold">i</span>
        </div>
        <p>
          Kliknij na dziecko, aby je wybrać i zobaczyć jego wyjazdy, płatności oraz kalendarz.
          {selectedChild && (
            <> Aktualnie wybrane: <strong>{selectedChild.first_name} {selectedChild.last_name}</strong></>
          )}
        </p>
      </div>

      {/* Lista dzieci */}
      <div className="space-y-3">
        {children.map((child, index) => {
          const birthDate = new Date(child.birth_date);
          const age = differenceInYears(new Date(), birthDate);
          const isSelected = selectedChildId === child.id;
          const avatarColor = avatarColors[index % avatarColors.length];

          return (
            <div
              key={child.id}
              onClick={() => handleSelectChild(child)}
              className={cn(
                'bg-white rounded-2xl shadow-sm ring-1 transition-all duration-200 cursor-pointer overflow-hidden',
                isSelected
                  ? 'ring-2 ring-gray-900 shadow-md'
                  : 'ring-gray-100 hover:shadow-md hover:ring-gray-200'
              )}
            >
              <div className="p-5">
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className={cn(
                    'w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold flex-shrink-0',
                    avatarColor
                  )}>
                    {child.first_name.charAt(0)}{child.last_name.charAt(0)}
                  </div>

                  {/* Dane */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-lg text-gray-900">
                        {child.first_name} {child.last_name}
                      </h3>
                      {isSelected && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-medium bg-gray-900 text-white">
                          <Check className="h-3 w-3" />
                          Wybrane
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        {format(birthDate, 'd.MM.yyyy', { locale: pl })} · {age} lat
                      </span>
                      {child.height_cm && (
                        <span className="flex items-center gap-1.5">
                          <Ruler className="h-3.5 w-3.5" />
                          {child.height_cm} cm
                        </span>
                      )}
                      {child.group && (
                        <span className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5" />
                          {child.group.name}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Akcje */}
                  <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Link
                      href={`/parent/children/${child.id}`}
                      className="w-9 h-9 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center justify-center transition-colors ring-1 ring-gray-200"
                    >
                      <Edit className="h-4 w-4 text-gray-500" />
                    </Link>
                    <button
                      onClick={(e) => handleDeleteClick(e, child.id)}
                      className="w-9 h-9 rounded-xl bg-gray-50 hover:bg-red-50 flex items-center justify-center transition-colors ring-1 ring-gray-200 hover:ring-red-200"
                    >
                      <Trash2 className="h-4 w-4 text-gray-400 hover:text-red-500" />
                    </button>
                  </div>

                  {/* Chevron */}
                  <ChevronRight className={cn(
                    'h-5 w-5 transition-transform flex-shrink-0',
                    isSelected ? 'text-gray-900 rotate-90' : 'text-gray-300'
                  )} />
                </div>

                {/* Sekcja aktywna - skróty nawigacyjne */}
                {isSelected && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-xs text-gray-400 mb-3 font-medium uppercase tracking-wide">Przejdź do</p>
                    <div className="grid grid-cols-3 gap-2">
                      <Link
                        href={`/parent/trips?child=${child.id}&childName=${encodeURIComponent(`${child.first_name} ${child.last_name}`)}`}
                        onClick={(e) => e.stopPropagation()}
                        className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-blue-50 hover:bg-blue-100 transition-colors"
                      >
                        <MapPin className="h-5 w-5 text-blue-600" />
                        <span className="text-xs font-medium text-blue-700">Wyjazdy</span>
                      </Link>
                      <Link
                        href={`/parent/payments?child=${child.id}&childName=${encodeURIComponent(`${child.first_name} ${child.last_name}`)}`}
                        onClick={(e) => e.stopPropagation()}
                        className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 transition-colors"
                      >
                        <CreditCard className="h-5 w-5 text-emerald-600" />
                        <span className="text-xs font-medium text-emerald-700">Płatności</span>
                      </Link>
                      <Link
                        href={`/parent/calendar?child=${child.id}&childName=${encodeURIComponent(`${child.first_name} ${child.last_name}`)}`}
                        onClick={(e) => e.stopPropagation()}
                        className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-violet-50 hover:bg-violet-100 transition-colors"
                      >
                        <CalendarDays className="h-5 w-5 text-violet-600" />
                        <span className="text-xs font-medium text-violet-700">Kalendarz</span>
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Dialog usunięcia */}
      <AlertDialog
        open={deleteDialog.isOpen}
        onOpenChange={(open) =>
          !deleteDialog.isLoading &&
          setDeleteDialog((prev) => ({ ...prev, isOpen: open }))
        }
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Czy na pewno chcesz usunąć {deleteDialog.childName}?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                {deleteDialog.registrations.length > 0 && (
                  <Alert variant="destructive">
                    <AlertTitle>UWAGA</AlertTitle>
                    <AlertDescription>
                      <p className="mb-2">
                        Dziecko jest zapisane na {deleteDialog.registrations.length} wyjazdy:
                      </p>
                      <ul className="list-disc list-inside space-y-1">
                        {deleteDialog.registrations.map((r) => (
                          <li key={r.id}>
                            {Array.isArray(r.trip) ? r.trip[0]?.title : r.trip?.title || 'Nieznany wyjazd'}
                            {r.payments.length > 0 && (
                              <span className="text-muted-foreground">
                                {' '}
                                ({r.payments.length} płatności
                                {hasUnpaidPayments && ', zaległe płatności'})
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                <div className="text-sm">
                  <p className="font-medium mb-2">Usunięcie dziecka:</p>
                  <ul className="list-none space-y-1 text-muted-foreground">
                    <li>• Usunie wszystkie zapisy na wyjazdy</li>
                    <li>• Usunie historię płatności</li>
                    <li>• Tej operacji nie można cofnąć</li>
                  </ul>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteDialog.isLoading} className="rounded-xl">
              Anuluj
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleteDialog.isLoading}
              className="bg-red-600 hover:bg-red-700 rounded-xl"
            >
              {deleteDialog.isLoading ? 'Usuwanie...' : 'Usuń dziecko'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
