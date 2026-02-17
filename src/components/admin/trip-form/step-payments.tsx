'use client';

import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import type { CreatePaymentTemplateInput } from '@/types';
import type { TripFormData } from './index';

interface StepPaymentsProps {
  data: TripFormData;
  onUpdate: (data: Partial<TripFormData>) => void;
  onNext: () => void;
  onPrev: () => void;
}

const emptyPayment: CreatePaymentTemplateInput = {
  payment_type: 'installment',
  installment_number: 1,
  is_first_installment: false,
  includes_season_pass: false,
  category_name: null,
  birth_year_from: null,
  birth_year_to: null,
  amount: 0,
  currency: 'PLN',
  due_date: null,
  payment_method: 'both',
};

export function StepPayments({ data, onUpdate, onNext, onPrev }: StepPaymentsProps) {
  const payments = data.payment_templates;

  const isValid = payments.length > 0 && payments.every((p) => {
    if (p.amount <= 0) return false;
    if (p.payment_type === 'installment' && !p.installment_number) return false;
    if (p.payment_type === 'season_pass' && (!p.birth_year_from || !p.birth_year_to)) return false;
    return true;
  });

  function addPayment() {
    onUpdate({
      payment_templates: [...payments, { ...emptyPayment }],
    });
  }

  function removePayment(index: number) {
    onUpdate({
      payment_templates: payments.filter((_, i) => i !== index),
    });
  }

  function updatePayment(index: number, updates: Partial<CreatePaymentTemplateInput>) {
    const newPayments = [...payments];
    newPayments[index] = { ...newPayments[index], ...updates };
    onUpdate({ payment_templates: newPayments });
  }

  return (
    <div className="space-y-6">
      {/* Payment Templates */}
      <div className="space-y-4">
        {payments.map((payment, index) => (
          <Card key={index}>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  Płatność {index + 1}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  onClick={() => removePayment(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Typ płatności */}
              <div className="space-y-2">
                <Label>Typ płatności</Label>
                <RadioGroup
                  value={payment.payment_type}
                  onValueChange={(value) =>
                    updatePayment(index, {
                      payment_type: value as 'installment' | 'season_pass',
                      installment_number: value === 'installment' ? 1 : null,
                      is_first_installment: false,
                      includes_season_pass: false,
                      category_name: null,
                      birth_year_from: null,
                      birth_year_to: null,
                    })
                  }
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="installment" id={`type-installment-${index}`} />
                    <Label htmlFor={`type-installment-${index}`} className="font-normal cursor-pointer">
                      Rata
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="season_pass" id={`type-season-${index}`} />
                    <Label htmlFor={`type-season-${index}`} className="font-normal cursor-pointer">
                      Karnet
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Pola dla raty */}
              {payment.payment_type === 'installment' && (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Numer raty *</Label>
                      <Input
                        type="number"
                        min="1"
                        value={payment.installment_number || ''}
                        onChange={(e) =>
                          updatePayment(index, {
                            installment_number: parseInt(e.target.value) || null,
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`first-installment-${index}`}
                        checked={payment.is_first_installment}
                        onCheckedChange={(checked) =>
                          updatePayment(index, { is_first_installment: !!checked })
                        }
                      />
                      <Label htmlFor={`first-installment-${index}`} className="font-normal cursor-pointer">
                        To jest rata 1
                      </Label>
                    </div>
                    {payment.is_first_installment && (
                      <div className="flex items-center space-x-2 ml-6">
                        <Checkbox
                          id={`includes-season-${index}`}
                          checked={payment.includes_season_pass}
                          onCheckedChange={(checked) =>
                            updatePayment(index, { includes_season_pass: !!checked })
                          }
                        />
                        <Label htmlFor={`includes-season-${index}`} className="font-normal cursor-pointer">
                          Dołącz ceny karnetów do tej raty
                        </Label>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Pola dla karnetu */}
              {payment.payment_type === 'season_pass' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nazwa kategorii</Label>
                    <Input
                      value={payment.category_name || ''}
                      onChange={(e) =>
                        updatePayment(index, { category_name: e.target.value || null })
                      }
                      placeholder="np. Rocznik 2015-2016"
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Rocznik od *</Label>
                      <Input
                        type="number"
                        min="1990"
                        max={new Date().getFullYear()}
                        value={payment.birth_year_from || ''}
                        onChange={(e) =>
                          updatePayment(index, {
                            birth_year_from: parseInt(e.target.value) || null,
                          })
                        }
                        placeholder="2015"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Rocznik do *</Label>
                      <Input
                        type="number"
                        min="1990"
                        max={new Date().getFullYear()}
                        value={payment.birth_year_to || ''}
                        onChange={(e) =>
                          updatePayment(index, {
                            birth_year_to: parseInt(e.target.value) || null,
                          })
                        }
                        placeholder="2016"
                      />
                    </div>
                  </div>
                </div>
              )}

              <Separator />

              {/* Wspólne pola */}
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Kwota *</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={payment.amount || ''}
                    onChange={(e) =>
                      updatePayment(index, { amount: parseFloat(e.target.value) || 0 })
                    }
                    placeholder="500"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Waluta</Label>
                  <RadioGroup
                    value={payment.currency}
                    onValueChange={(value) =>
                      updatePayment(index, { currency: value as 'PLN' | 'EUR' })
                    }
                    className="flex gap-4 pt-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="PLN" id={`currency-pln-${index}`} />
                      <Label htmlFor={`currency-pln-${index}`} className="font-normal cursor-pointer">
                        PLN
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="EUR" id={`currency-eur-${index}`} />
                      <Label htmlFor={`currency-eur-${index}`} className="font-normal cursor-pointer">
                        EUR
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
                <div className="space-y-2">
                  <Label>Termin płatności</Label>
                  <Input
                    type="date"
                    value={payment.due_date || ''}
                    onChange={(e) =>
                      updatePayment(index, { due_date: e.target.value || null })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Forma płatności</Label>
                <Select
                  value={payment.payment_method || 'both'}
                  onValueChange={(value) =>
                    updatePayment(index, { payment_method: value as 'cash' | 'transfer' | 'both' })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both">Gotówka lub przelew</SelectItem>
                    <SelectItem value="transfer">Tylko przelew</SelectItem>
                    <SelectItem value="cash">Tylko gotówka</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        ))}

        <Button variant="outline" className="w-full" onClick={addPayment}>
          <Plus className="mr-2 h-4 w-4" />
          Dodaj płatność
        </Button>
      </div>

      {payments.length === 0 && (
        <p className="text-sm text-destructive text-center">
          Dodaj przynajmniej jedną płatność
        </p>
      )}

      <Separator />

      {/* Dane do przelewu */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Dane do przelewu</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Konto PLN</Label>
              <Input
                value={data.bank_account_pln}
                onChange={(e) => onUpdate({ bank_account_pln: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Konto EUR</Label>
              <Input
                value={data.bank_account_eur}
                onChange={(e) => onUpdate({ bank_account_eur: e.target.value })}
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
