'use client';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

import type { Group } from '@/types';
import type { TripFormData } from './index';

interface StepGroupsProps {
  data: TripFormData;
  groups: Group[];
  onUpdate: (data: Partial<TripFormData>) => void;
  onNext: () => void;
  onPrev: () => void;
}

export function StepGroups({ data, groups, onUpdate, onNext, onPrev }: StepGroupsProps) {
  const isValid = data.group_ids.length > 0;

  function toggleGroup(groupId: string) {
    const newGroupIds = data.group_ids.includes(groupId)
      ? data.group_ids.filter((id) => id !== groupId)
      : [...data.group_ids, groupId];
    onUpdate({ group_ids: newGroupIds });
  }

  function selectAll() {
    onUpdate({ group_ids: groups.map((g) => g.id) });
  }

  function deselectAll() {
    onUpdate({ group_ids: [] });
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Wybierz grupy, dla których dostępny będzie ten wyjazd
        </p>
        <div className="space-x-2">
          <Button variant="outline" size="sm" onClick={selectAll}>
            Zaznacz wszystkie
          </Button>
          <Button variant="outline" size="sm" onClick={deselectAll}>
            Odznacz wszystkie
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {groups.map((group) => (
          <div
            key={group.id}
            className={`flex items-start space-x-3 rounded-lg border p-4 cursor-pointer transition-colors ${
              data.group_ids.includes(group.id)
                ? 'border-primary bg-primary/5'
                : 'hover:bg-muted/50'
            }`}
            onClick={() => toggleGroup(group.id)}
          >
            <Checkbox
              id={group.id}
              checked={data.group_ids.includes(group.id)}
              onCheckedChange={() => toggleGroup(group.id)}
            />
            <div className="space-y-1">
              <Label htmlFor={group.id} className="font-medium cursor-pointer">
                {group.name}
              </Label>
              {group.description && (
                <p className="text-sm text-muted-foreground">{group.description}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {!isValid && (
        <p className="text-sm text-destructive">Wybierz przynajmniej jedną grupę</p>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onPrev}>
          Wstecz
        </Button>
        <Button onClick={onNext} disabled={!isValid}>
          Dalej
        </Button>
      </div>
    </div>
  );
}
