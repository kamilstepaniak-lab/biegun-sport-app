'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import type { TripFormData } from './index';

interface StepDatesProps {
  data: TripFormData;
  onUpdate: (data: Partial<TripFormData>) => void;
  onNext: () => void;
  onPrev: () => void;
}

export function StepDates({ data, onUpdate, onNext, onPrev }: StepDatesProps) {
  const isValid =
    data.departure_datetime &&
    data.departure_location.trim().length >= 3 &&
    data.return_datetime &&
    data.return_location.trim().length >= 3 &&
    new Date(data.return_datetime) > new Date(data.departure_datetime);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Wyjazd</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="departure_datetime">Data i godzina wyjazdu *</Label>
              <Input
                id="departure_datetime"
                type="datetime-local"
                value={data.departure_datetime}
                onChange={(e) => onUpdate({ departure_datetime: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="departure_location">Miejsce wyjazdu *</Label>
              <Input
                id="departure_location"
                value={data.departure_location}
                onChange={(e) => onUpdate({ departure_location: e.target.value })}
                placeholder="np. Parking Biegun Sport, Kraków"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Powrót</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="return_datetime">Data i godzina powrotu *</Label>
              <Input
                id="return_datetime"
                type="datetime-local"
                value={data.return_datetime}
                onChange={(e) => onUpdate({ return_datetime: e.target.value })}
              />
              {data.departure_datetime && data.return_datetime &&
                new Date(data.return_datetime) <= new Date(data.departure_datetime) && (
                  <p className="text-sm text-destructive">
                    Data powrotu musi być późniejsza niż data wyjazdu
                  </p>
                )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="return_location">Miejsce powrotu *</Label>
              <Input
                id="return_location"
                value={data.return_location}
                onChange={(e) => onUpdate({ return_location: e.target.value })}
                placeholder="np. Parking Biegun Sport, Kraków"
              />
            </div>
          </div>
        </CardContent>
      </Card>

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
