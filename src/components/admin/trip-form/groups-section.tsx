'use client';

import { Users, AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
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
    <Card className={hasErrors ? 'border-destructive' : ''}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Grupy
          {hasErrors && <AlertCircle className="h-4 w-4 text-destructive ml-auto" />}
        </CardTitle>
        <CardDescription>
          Wybierz grupy, dla których dostępny będzie ten wyjazd
        </CardDescription>
      </CardHeader>
      <CardContent>
        {groups.length > 0 && (
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-muted-foreground">
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
          {groups.map((group) => (
            <div
              key={group.id}
              className={`flex items-start space-x-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                formData.group_ids.includes(group.id)
                  ? 'border-primary bg-primary/5'
                  : 'hover:bg-muted/50'
              }`}
              onClick={() => toggleGroup(group.id)}
            >
              <Checkbox
                id={group.id}
                checked={formData.group_ids.includes(group.id)}
                onCheckedChange={() => toggleGroup(group.id)}
              />
              <div>
                <Label htmlFor={group.id} className="font-medium cursor-pointer">
                  {group.name}
                </Label>
              </div>
            </div>
          ))}
        </div>
        {formData.group_ids.length === 0 && (
          <p className="text-sm text-destructive mt-2">Wybierz przynajmniej jedną grupę</p>
        )}
      </CardContent>
    </Card>
  );
}
