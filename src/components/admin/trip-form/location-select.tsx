'use client';

import { useState } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { PREDEFINED_STOPS } from './types';

export function LocationSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
}) {
  const isCustom = value !== '' && !PREDEFINED_STOPS.includes(value);
  const [showCustom, setShowCustom] = useState(isCustom);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select
        value={showCustom ? '__custom__' : value}
        onValueChange={(val) => {
          if (val === '__custom__') {
            setShowCustom(true);
            onChange('');
          } else {
            setShowCustom(false);
            onChange(val);
          }
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="Wybierz przystanek" />
        </SelectTrigger>
        <SelectContent>
          {PREDEFINED_STOPS.map((stop) => (
            <SelectItem key={stop} value={stop}>{stop}</SelectItem>
          ))}
          <SelectItem value="__custom__">Inne (wpisz własne)</SelectItem>
        </SelectContent>
      </Select>
      {showCustom && (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Wpisz nazwę przystanku..."
          autoFocus
        />
      )}
    </div>
  );
}
