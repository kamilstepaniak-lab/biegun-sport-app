'use client';

import { Info, AlertCircle } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import type { TripStatus, AttendanceType } from '@/types';

import { EmailContentFields } from './email-content-section';
import type { SectionProps } from './types';

export function BasicInfoSection({
  formData,
  updateFormData,
  hasErrors,
}: SectionProps & { hasErrors: boolean }) {
  return (
    <Card className={hasErrors ? 'border-destructive' : ''}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Info className="h-5 w-5" />
          Podstawowe informacje
          {hasErrors && <AlertCircle className="h-4 w-4 text-destructive ml-auto" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Opis wyjazdu */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Tytuł wyjazdu *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => updateFormData({ title: e.target.value })}
              placeholder="np. Wyjazd narciarski Zakopane 2026"
            />
          </div>
          <div className="space-y-2">
            <Label>Opis</Label>
            <RichTextEditor
              value={formData.description}
              onChange={(html) => updateFormData({ description: html })}
              placeholder="Opcjonalny opis wyjazdu..."
            />
          </div>
          <EmailContentFields formData={formData} updateFormData={updateFormData} />
          <div className="space-y-2">
            <Label htmlFor="location">Miejsce (hotel / miejscowość)</Label>
            <Input
              id="location"
              value={formData.location}
              onChange={(e) => updateFormData({ location: e.target.value })}
              placeholder="np. Hotel Śnieżka, Zakopane"
            />
            <p className="text-xs text-muted-foreground">Pojawi się w umowie uczestnictwa</p>
          </div>
        </div>

        <Separator />

        {/* Konfiguracja */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">Konfiguracja</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label>Status</Label>
              <RadioGroup
                value={formData.status}
                onValueChange={(value) => updateFormData({ status: value as TripStatus })}
                className="flex gap-4 pt-1"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="draft" id="draft" />
                  <Label htmlFor="draft" className="font-normal cursor-pointer">Szkic</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="published" id="published" />
                  <Label htmlFor="published" className="font-normal cursor-pointer">Opublikowany</Label>
                </div>
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <Label>Typ wyjazdu</Label>
              <RadioGroup
                value={formData.attendance_type}
                onValueChange={(value) => updateFormData({ attendance_type: value as AttendanceType })}
                className="flex gap-4 pt-1"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="mandatory" id="mandatory" />
                  <Label htmlFor="mandatory" className="font-normal cursor-pointer">Obowiązkowy</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="optional" id="optional" />
                  <Label htmlFor="optional" className="font-normal cursor-pointer">Dla chętnych</Label>
                </div>
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <Label htmlFor="declaration_deadline">Deklaracja do</Label>
              <Input
                id="declaration_deadline"
                type="date"
                value={formData.declaration_deadline}
                onChange={(e) => updateFormData({ declaration_deadline: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Termin potwierdzenia udziału przez rodzica</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
