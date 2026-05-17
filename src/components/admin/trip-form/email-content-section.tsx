'use client';

import { useState } from 'react';
import { Info } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import type { SectionProps } from './types';

export function EmailContentSection({ formData, updateFormData }: SectionProps) {
  const [showPackingList, setShowPackingList] = useState(!!formData.packing_list);
  const [showAdditionalInfo, setShowAdditionalInfo] = useState(!!formData.additional_info);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Info className="h-5 w-5" />
          Treść maila do rodziców
        </CardTitle>
        <CardDescription>
          Zaznacz sekcje, które mają pojawić się w mailu wysyłanym do grupy.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Co zabrać */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Checkbox
              id="toggle_packing_list"
              checked={showPackingList}
              onCheckedChange={(checked) => {
                setShowPackingList(!!checked);
                if (!checked) updateFormData({ packing_list: '' });
              }}
            />
            <Label htmlFor="toggle_packing_list" className="cursor-pointer font-medium">
              Co zabrać
            </Label>
          </div>
          {showPackingList && (
            <div className="space-y-2 pl-7">
              <Textarea
                id="packing_list"
                value={formData.packing_list}
                onChange={(e) => updateFormData({ packing_list: e.target.value })}
                placeholder={"- Kask narciarski (obowiązkowy)\n- Gogle narciarskie\n- Rękawice narciarskie\n- Kurtka i spodnie narciarskie\n- Buty narciarskie (jeśli własne)\n- Narty i kijki (jeśli własne)\n- Ubrania na zmianę / bielizna termiczna\n- Środki higieniczne\n- Legitymacja szkolna / dowód tożsamości\n- Karta EKUZ lub ubezpieczenie"}
                rows={8}
              />
              <p className="text-xs text-muted-foreground">Każda pozycja w nowej linii (ze znakiem - lub bez)</p>
            </div>
          )}
        </div>

        {/* Dodatkowe informacje */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Checkbox
              id="toggle_additional_info"
              checked={showAdditionalInfo}
              onCheckedChange={(checked) => {
                setShowAdditionalInfo(!!checked);
                if (!checked) updateFormData({ additional_info: '' });
              }}
            />
            <Label htmlFor="toggle_additional_info" className="cursor-pointer font-medium">
              Dodatkowe informacje
            </Label>
          </div>
          {showAdditionalInfo && (
            <div className="pl-7">
              <Textarea
                id="additional_info"
                value={formData.additional_info}
                onChange={(e) => updateFormData({ additional_info: e.target.value })}
                placeholder="Wyjazd odbywa się pod opieką wykwalifikowanych instruktorów BiegunSport. Prosimy o punktualne stawienie się na miejscu zbiórki."
                rows={4}
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
