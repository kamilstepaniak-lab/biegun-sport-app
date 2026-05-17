'use client';

import { useState } from 'react';
import { Plus, Trash2, MapPin, Calendar, AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

import { LocationSelect } from './location-select';
import type { SectionProps } from './types';

const ACCENT = {
  green: { heading: 'text-green-700', sub: 'text-green-600', border: 'border-green-200' },
  blue: { heading: 'text-blue-700', sub: 'text-blue-600', border: 'border-blue-200' },
} as const;

interface DirectionBlockProps {
  accent: keyof typeof ACCENT;
  title: string;
  idPrefix: string;
  optional: boolean;
  date: string;
  time: string;
  onDateChange: (date: string) => void;
  onTimeChange: (time: string) => void;
  location: string;
  onLocationChange: (val: string) => void;
  dateError?: React.ReactNode;
  showStop2: boolean;
  setShowStop2: (v: boolean) => void;
  stop2Date: string;
  stop2Time: string;
  onStop2DateChange: (date: string) => void;
  onStop2TimeChange: (time: string) => void;
  stop2Location: string;
  onStop2LocationChange: (val: string) => void;
}

function DirectionBlock({
  accent,
  title,
  idPrefix,
  optional,
  date,
  time,
  onDateChange,
  onTimeChange,
  location,
  onLocationChange,
  dateError,
  showStop2,
  setShowStop2,
  stop2Date,
  stop2Time,
  onStop2DateChange,
  onStop2TimeChange,
  stop2Location,
  onStop2LocationChange,
}: DirectionBlockProps) {
  const a = ACCENT[accent];
  return (
    <div className="space-y-4">
      <h4 className={`font-semibold flex items-center gap-2 ${a.heading}`}>
        <MapPin className="h-4 w-4" />
        {title} — Przystanek 1
        {optional && <span className="text-xs font-normal text-gray-400">(opcjonalne)</span>}
      </h4>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}_date`}>Data {optional ? '' : '*'}</Label>
          <Input
            id={`${idPrefix}_date`}
            type="date"
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
          />
          {dateError}
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}_time`}>Godzina</Label>
          <Input
            id={`${idPrefix}_time`}
            type="time"
            value={time}
            placeholder="nieznana"
            onChange={(e) => onTimeChange(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Opcjonalna — jeśli nieznana, nie będzie wyświetlana</p>
        </div>
      </div>
      <LocationSelect
        label={optional ? 'Miejsce (opcjonalne)' : 'Miejsce *'}
        value={location}
        onChange={onLocationChange}
      />

      {!showStop2 ? (
        <Button type="button" variant="outline" size="sm" onClick={() => setShowStop2(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Dodaj drugi przystanek
        </Button>
      ) : (
        <div className={`space-y-4 pl-4 border-l-2 ${a.border}`}>
          <div className="flex items-center justify-between">
            <h4 className={`font-medium ${a.sub}`}>{title} — Przystanek 2</h4>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowStop2(false);
                onStop2DateChange('');
                onStop2LocationChange('');
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}_stop2_date`}>Data</Label>
              <Input
                id={`${idPrefix}_stop2_date`}
                type="date"
                value={stop2Date}
                onChange={(e) => onStop2DateChange(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}_stop2_time`}>Godzina</Label>
              <Input
                id={`${idPrefix}_stop2_time`}
                type="time"
                value={stop2Time}
                onChange={(e) => onStop2TimeChange(e.target.value)}
              />
            </div>
          </div>
          <LocationSelect
            label="Miejsce"
            value={stop2Location}
            onChange={onStop2LocationChange}
          />
        </div>
      )}
    </div>
  );
}

export function ScheduleSection({
  formData,
  updateFormData,
  hasErrors,
}: SectionProps & { hasErrors: boolean }) {
  const [showStop2Departure, setShowStop2Departure] = useState(!!formData.departure_stop2_location);
  const [showStop2Return, setShowStop2Return] = useState(!!formData.return_stop2_location);

  const [departureTime, setDepartureTime] = useState(
    formData.departure_time_known && formData.departure_datetime
      ? formData.departure_datetime.split('T')[1] ?? ''
      : ''
  );
  const [returnTime, setReturnTime] = useState(
    formData.return_time_known && formData.return_datetime
      ? formData.return_datetime.split('T')[1] ?? ''
      : ''
  );
  const [departureStop2Time, setDepartureStop2Time] = useState(
    formData.departure_stop2_datetime ? formData.departure_stop2_datetime.split('T')[1] ?? '' : ''
  );
  const [returnStop2Time, setReturnStop2Time] = useState(
    formData.return_stop2_datetime ? formData.return_stop2_datetime.split('T')[1] ?? '' : ''
  );

  const optional = formData.allow_own_transport;

  const returnBeforeDeparture =
    !!formData.departure_datetime &&
    !!formData.return_datetime &&
    new Date(formData.return_datetime) <= new Date(formData.departure_datetime);

  return (
    <Card className={hasErrors ? 'border-destructive' : ''}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Terminy i lokalizacje
          {hasErrors && <AlertCircle className="h-4 w-4 text-destructive ml-auto" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3">
          <Checkbox
            id="allow_own_transport"
            checked={formData.allow_own_transport}
            onCheckedChange={(checked) => updateFormData({ allow_own_transport: !!checked })}
          />
          <Label htmlFor="allow_own_transport" className="font-normal cursor-pointer text-sm text-gray-600">
            Zezwól na dojazd własny — miejsca wyjazdu i powrotu stają się opcjonalne, u rodzica pojawi się przycisk
          </Label>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <DirectionBlock
            accent="green"
            title="Wyjazd"
            idPrefix="departure"
            optional={optional}
            date={formData.departure_datetime ? formData.departure_datetime.split('T')[0] : ''}
            time={departureTime}
            onDateChange={(dateVal) => {
              const tm = departureTime || '00:00';
              updateFormData({
                departure_datetime: dateVal ? `${dateVal}T${tm}` : '',
                departure_time_known: !!departureTime,
              });
            }}
            onTimeChange={(timeVal) => {
              setDepartureTime(timeVal);
              if (formData.departure_datetime) {
                const datePart = formData.departure_datetime.split('T')[0];
                updateFormData({
                  departure_datetime: `${datePart}T${timeVal || '00:00'}`,
                  departure_time_known: !!timeVal,
                });
              }
            }}
            location={formData.departure_location}
            onLocationChange={(val) => updateFormData({ departure_location: val })}
            showStop2={showStop2Departure}
            setShowStop2={setShowStop2Departure}
            stop2Date={formData.departure_stop2_datetime ? formData.departure_stop2_datetime.split('T')[0] : ''}
            stop2Time={departureStop2Time}
            onStop2DateChange={(dateVal) => {
              const tm = departureStop2Time || '00:00';
              updateFormData({ departure_stop2_datetime: dateVal ? `${dateVal}T${tm}` : '' });
            }}
            onStop2TimeChange={(timeVal) => {
              setDepartureStop2Time(timeVal);
              if (formData.departure_stop2_datetime) {
                const datePart = formData.departure_stop2_datetime.split('T')[0];
                updateFormData({ departure_stop2_datetime: `${datePart}T${timeVal || '00:00'}` });
              }
            }}
            stop2Location={formData.departure_stop2_location}
            onStop2LocationChange={(val) => updateFormData({ departure_stop2_location: val })}
          />

          <DirectionBlock
            accent="blue"
            title="Powrót"
            idPrefix="return"
            optional={optional}
            date={formData.return_datetime ? formData.return_datetime.split('T')[0] : ''}
            time={returnTime}
            dateError={
              returnBeforeDeparture ? (
                <p className="text-sm text-destructive">
                  Data powrotu musi być późniejsza niż data wyjazdu
                </p>
              ) : undefined
            }
            onDateChange={(dateVal) => {
              const tm = returnTime || '00:00';
              updateFormData({
                return_datetime: dateVal ? `${dateVal}T${tm}` : '',
                return_time_known: !!returnTime,
              });
            }}
            onTimeChange={(timeVal) => {
              setReturnTime(timeVal);
              if (formData.return_datetime) {
                const datePart = formData.return_datetime.split('T')[0];
                updateFormData({
                  return_datetime: `${datePart}T${timeVal || '00:00'}`,
                  return_time_known: !!timeVal,
                });
              }
            }}
            location={formData.return_location}
            onLocationChange={(val) => updateFormData({ return_location: val })}
            showStop2={showStop2Return}
            setShowStop2={setShowStop2Return}
            stop2Date={formData.return_stop2_datetime ? formData.return_stop2_datetime.split('T')[0] : ''}
            stop2Time={returnStop2Time}
            onStop2DateChange={(dateVal) => {
              const tm = returnStop2Time || '00:00';
              updateFormData({ return_stop2_datetime: dateVal ? `${dateVal}T${tm}` : '' });
            }}
            onStop2TimeChange={(timeVal) => {
              setReturnStop2Time(timeVal);
              if (formData.return_stop2_datetime) {
                const datePart = formData.return_stop2_datetime.split('T')[0];
                updateFormData({ return_stop2_datetime: `${datePart}T${timeVal || '00:00'}` });
              }
            }}
            stop2Location={formData.return_stop2_location}
            onStop2LocationChange={(val) => updateFormData({ return_stop2_location: val })}
          />
        </div>
      </CardContent>
    </Card>
  );
}
