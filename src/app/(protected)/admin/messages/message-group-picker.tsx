'use client';

import { Users } from 'lucide-react';
import type { Group } from '@/types';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

interface MessageGroupPickerProps {
  groups: Group[];
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}

export function MessageGroupPicker({ groups, selected, onChange, disabled }: MessageGroupPickerProps) {
  const allParents = selected.length === 0;

  function toggle(groupId: string) {
    onChange(
      selected.includes(groupId)
        ? selected.filter((id) => id !== groupId)
        : [...selected, groupId]
    );
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700">Odbiorcy</label>
      <div className="rounded-lg border border-gray-200 divide-y divide-gray-50">
        <button
          type="button"
          onClick={() => onChange([])}
          disabled={disabled}
          className={cn(
            'flex w-full items-center gap-2 px-3 py-2.5 text-sm transition-colors disabled:opacity-50',
            allParents ? 'bg-amber-50 text-amber-800 font-medium' : 'hover:bg-gray-50 text-gray-600'
          )}
        >
          <Users className="h-4 w-4" />
          Wszyscy rodzice
        </button>
        {groups.length > 0 && (
          <div className="max-h-44 overflow-y-auto">
            {groups.map((g) => (
              <label
                key={g.id}
                className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                <Checkbox
                  checked={selected.includes(g.id)}
                  onCheckedChange={() => toggle(g.id)}
                  disabled={disabled}
                />
                <span>{g.name}</span>
              </label>
            ))}
          </div>
        )}
      </div>
      <p className="text-xs text-gray-400">
        {allParents
          ? 'Wiadomość trafi do wszystkich rodziców.'
          : `Wiadomość trafi tylko do rodziców dzieci z wybranych grup (${selected.length}).`}
      </p>
    </div>
  );
}
