'use client';

import { useState } from 'react';
import Link from 'next/link';
import { format, differenceInYears } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Edit, Trash2, Calendar, Ruler, Users, FileText, Save, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';

import { updateParticipantNote } from '@/lib/actions/participants';
import type { ParticipantWithGroup } from '@/types';

interface ChildCardProps {
  child: ParticipantWithGroup;
  onDelete?: (id: string) => void;
}

export function ChildCard({ child, onDelete }: ChildCardProps) {
  const birthDate = new Date(child.birth_date);
  const age = differenceInYears(new Date(), birthDate);
  const birthYear = birthDate.getFullYear();

  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState(child.notes || '');
  const [isSaving, setIsSaving] = useState(false);
  const [currentNotes, setCurrentNotes] = useState(child.notes || '');

  async function handleSaveNotes() {
    setIsSaving(true);
    try {
      const result = await updateParticipantNote(child.id, notesValue);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Notatka zapisana');
        setCurrentNotes(notesValue);
        setIsEditingNotes(false);
      }
    } catch {
      toast.error('Nie udało się zapisać notatki');
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancelNotes() {
    setNotesValue(currentNotes);
    setIsEditingNotes(false);
  }

  return (
    <div className="rounded-lg border bg-card hover:shadow-sm transition-shadow">
      {/* Główny wiersz z danymi */}
      <div className="p-4">
        <div className="flex items-center justify-between gap-4">
          {/* Imię i nazwisko + dane */}
          <div className="min-w-0">
            <h3 className="font-semibold text-lg">
              {child.first_name} {child.last_name}
            </h3>
            <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {format(birthDate, 'd.MM.yyyy', { locale: pl })} · {age} lat · rocznik {birthYear}
              </span>
              {child.height_cm && (
                <span className="flex items-center gap-1">
                  <Ruler className="h-3.5 w-3.5" />
                  {child.height_cm} cm
                </span>
              )}
              {child.group && (
                <Badge variant="secondary" className="text-xs">
                  <Users className="h-3 w-3 mr-1" />
                  {child.group.name}
                </Badge>
              )}
            </div>
          </div>

          {/* Przyciski */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/parent/children/${child.id}`}>
                <Edit className="mr-1 h-4 w-4" />
                Edytuj
              </Link>
            </Button>
            {onDelete && (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => onDelete(child.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Notatki */}
      <div className="border-t px-4 py-3 bg-muted/20">
        <div className="flex items-start gap-2">
          <FileText className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          {isEditingNotes ? (
            <div className="flex-1 space-y-2">
              <Textarea
                value={notesValue}
                onChange={(e) => setNotesValue(e.target.value)}
                placeholder="Notatki: zdrowie, leki, zakwaterowanie, zachowanie..."
                className="min-h-[80px] text-sm"
                disabled={isSaving}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleSaveNotes}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Save className="h-4 w-4 mr-1" />
                  )}
                  Zapisz
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCancelNotes}
                  disabled={isSaving}
                >
                  <X className="h-4 w-4 mr-1" />
                  Anuluj
                </Button>
              </div>
            </div>
          ) : (
            <div
              className="flex-1 cursor-pointer group"
              onClick={() => setIsEditingNotes(true)}
            >
              {currentNotes ? (
                <p className="text-sm whitespace-pre-wrap group-hover:text-primary transition-colors">
                  {currentNotes}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground/60 italic group-hover:text-primary transition-colors">
                  Kliknij, aby dodać notatkę (zdrowie, leki, zakwaterowanie, zachowanie...)
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
