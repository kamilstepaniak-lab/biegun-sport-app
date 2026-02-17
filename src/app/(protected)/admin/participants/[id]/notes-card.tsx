'use client';

import { useState } from 'react';
import { StickyNote, Edit, Save, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

import { updateParticipantNote } from '@/lib/actions/participants';

interface ParticipantNotesCardProps {
  participantId: string;
  participantName: string;
  initialNotes: string;
}

export function ParticipantNotesCard({ participantId, participantName, initialNotes }: ParticipantNotesCardProps) {
  const [notes, setNotes] = useState(initialNotes);
  const [isEditing, setIsEditing] = useState(false);
  const [editedNotes, setEditedNotes] = useState(initialNotes);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    setIsSaving(true);
    try {
      const result = await updateParticipantNote(participantId, editedNotes);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Notatka została zapisana');
        setNotes(editedNotes);
        setIsEditing(false);
      }
    } catch {
      toast.error('Wystąpił nieoczekiwany błąd');
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancel() {
    setEditedNotes(notes);
    setIsEditing(false);
  }

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StickyNote className={`h-5 w-5 ${notes ? 'text-amber-500' : 'text-muted-foreground'}`} />
            <div>
              <CardTitle>Notatki</CardTitle>
              <CardDescription>
                Informacje o uczestniku (np. zdrowie, alergie, uwagi)
              </CardDescription>
            </div>
          </div>
          {!isEditing && (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              <Edit className="h-4 w-4 mr-2" />
              {notes ? 'Edytuj' : 'Dodaj notatkę'}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <div className="space-y-4">
            <Textarea
              value={editedNotes}
              onChange={(e) => setEditedNotes(e.target.value)}
              placeholder="Wpisz notatki o uczestniku..."
              rows={6}
              className="resize-none"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
                <X className="h-4 w-4 mr-2" />
                Anuluj
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? 'Zapisywanie...' : 'Zapisz'}
              </Button>
            </div>
          </div>
        ) : (
          <div>
            {notes ? (
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <p className="whitespace-pre-wrap text-sm">{notes}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">
                Brak notatek. Kliknij &quot;Dodaj notatkę&quot; aby dodać informacje o uczestniku.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
