'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

import type { TripFormData } from './index';

interface StepBasicInfoProps {
  data: TripFormData;
  onUpdate: (data: Partial<TripFormData>) => void;
  onNext: () => void;
}

export function StepBasicInfo({ data, onUpdate, onNext }: StepBasicInfoProps) {
  const isValid = data.title.trim().length >= 3;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="title">Tytuł wyjazdu *</Label>
        <Input
          id="title"
          value={data.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          placeholder="np. Wyjazd narciarski Zakopane 2026"
        />
        {data.title && data.title.length < 3 && (
          <p className="text-sm text-destructive">Tytuł musi mieć minimum 3 znaki</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Opis</Label>
        <Textarea
          id="description"
          value={data.description}
          onChange={(e) => onUpdate({ description: e.target.value })}
          placeholder="Opcjonalny opis wyjazdu..."
          rows={4}
        />
      </div>

      <div className="space-y-2">
        <Label>Status</Label>
        <RadioGroup
          value={data.status}
          onValueChange={(value) => onUpdate({ status: value as 'draft' | 'published' })}
          className="flex gap-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="draft" id="draft" />
            <Label htmlFor="draft" className="font-normal cursor-pointer">
              Szkic (draft)
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="published" id="published" />
            <Label htmlFor="published" className="font-normal cursor-pointer">
              Opublikowany
            </Label>
          </div>
        </RadioGroup>
        <p className="text-sm text-muted-foreground">
          Szkic nie będzie widoczny dla rodziców. Możesz opublikować później.
        </p>
      </div>

      <div className="flex justify-end">
        <Button onClick={onNext} disabled={!isValid}>
          Dalej
        </Button>
      </div>
    </div>
  );
}
