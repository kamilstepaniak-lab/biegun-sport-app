'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Users } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { assignParticipantToGroup } from '@/lib/actions/participants';
import type { Group } from '@/types';

interface ChangeGroupCardProps {
  participantId: string;
  currentGroupId: string | null;
  groups: Group[];
}

export function ChangeGroupCard({ participantId, currentGroupId, groups }: ChangeGroupCardProps) {
  const router = useRouter();
  const [selectedGroupId, setSelectedGroupId] = useState<string>(currentGroupId ?? 'none');
  const [isLoading, setIsLoading] = useState(false);

  const hasChanged = selectedGroupId !== (currentGroupId ?? 'none');

  async function handleSave() {
    setIsLoading(true);
    try {
      const result = await assignParticipantToGroup(
        participantId,
        selectedGroupId === 'none' ? null : selectedGroupId
      );
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Grupa została zmieniona');
        router.refresh();
      }
    } catch {
      toast.error('Wystąpił nieoczekiwany błąd');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Zmiana grupy
        </CardTitle>
        <CardDescription>Przypisz uczestnika do innej grupy</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
          <SelectTrigger>
            <SelectValue placeholder="Wybierz grupę" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Brak grupy</SelectItem>
            {groups.map((group) => (
              <SelectItem key={group.id} value={group.id}>
                {group.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          onClick={handleSave}
          disabled={!hasChanged || isLoading}
          className="w-full"
        >
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Zapisz grupę
        </Button>
      </CardContent>
    </Card>
  );
}
