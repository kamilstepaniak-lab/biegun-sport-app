'use client';

import { Users, AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { PanelCard, SectionTitle } from '@/components/shared';
import { cn } from '@/lib/utils';
import { GroupIcon } from '@/lib/group-icons';
import { getGroupColor } from '@/lib/group-colors';
import type { Group } from '@/types';

import type { SectionProps } from './types';

export function GroupsSection({
  formData,
  updateFormData,
  groups,
  hasErrors,
}: SectionProps & { groups: Group[]; hasErrors: boolean }) {
  function toggleGroup(groupId: string) {
    const newGroupIds = formData.group_ids.includes(groupId)
      ? formData.group_ids.filter((id) => id !== groupId)
      : [...formData.group_ids, groupId];
    updateFormData({ group_ids: newGroupIds });
  }

  return (
    <PanelCard className={cn('p-5 sm:p-6 space-y-4', hasErrors && 'ring-2 ring-red-300')}>
      <SectionTitle
        icon={Users}
        title="Grupy"
        description="Wybierz grupy, dla których dostępny będzie ten wyjazd"
        action={hasErrors ? <AlertCircle className="h-5 w-5 text-red-500" /> : undefined}
      />
      <div>
        {groups.length > 0 && (
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-slate-500">
              Zaznaczono {formData.group_ids.length} z {groups.length}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => updateFormData({ group_ids: groups.map((g) => g.id) })}
                disabled={formData.group_ids.length === groups.length}
              >
                Zaznacz wszystkie
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => updateFormData({ group_ids: [] })}
                disabled={formData.group_ids.length === 0}
              >
                Odznacz wszystkie
              </Button>
            </div>
          </div>
        )}
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => {
            const selected = formData.group_ids.includes(group.id);
            const color = getGroupColor(group.name);
            return (
              <div
                key={group.id}
                className={cn(
                  'flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors',
                  selected ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'
                )}
                onClick={() => toggleGroup(group.id)}
              >
                <Checkbox
                  id={group.id}
                  checked={selected}
                  onCheckedChange={() => toggleGroup(group.id)}
                />
                <span
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white',
                    color.dot
                  )}
                >
                  <GroupIcon name={group.name} className="h-4 w-4" />
                </span>
                <Label htmlFor={group.id} className="font-medium cursor-pointer text-slate-900">
                  {group.name}
                </Label>
              </div>
            );
          })}
        </div>
        {formData.group_ids.length === 0 && (
          <p className="text-sm text-red-600 mt-2">Wybierz przynajmniej jedną grupę</p>
        )}
      </div>
    </PanelCard>
  );
}
