'use client';

import { useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp, CreditCard, AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type { CreatePaymentTemplateInput } from '@/types';

import { emptyPayment, type SectionProps } from './types';

type DueMode = 'specific' | 'departure' | 'confirmation';

export function PaymentsSection({
  formData,
  updateFormData,
  hasErrors,
}: SectionProps & { hasErrors: boolean }) {
  const [paymentsOpen, setPaymentsOpen] = useState(true);

  const departureDate = formData.departure_datetime
    ? formData.departure_datetime.split('T')[0]
    : '';

  function addPayment() {
    updateFormData({
      payment_templates: [...formData.payment_templates, { ...emptyPayment }],
    });
  }

  function removePayment(index: number) {
    updateFormData({
      payment_templates: formData.payment_templates.filter((_, i) => i !== index),
    });
  }

  function updatePayment(index: number, updates: Partial<CreatePaymentTemplateInput>) {
    const newPayments = [...formData.payment_templates];
    newPayments[index] = { ...newPayments[index], ...updates };
    updateFormData({ payment_templates: newPayments });
  }

  function dueMode(payment: CreatePaymentTemplateInput): DueMode {
    if (departureDate && payment.due_date === departureDate) return 'departure';
    if (payment.due_days_from_confirmation) return 'confirmation';
    return 'specific';
  }

  function changeDueMode(index: number, mode: DueMode) {
    if (mode === 'departure') {
      updatePayment(index, {
        due_date: departureDate,
        due_days_from_confirmation: null,
        payment_method: 'cash',
      });
    } else if (mode === 'confirmation') {
      updatePayment(index, {
        due_date: null,
        due_days_from_confirmation: 5,
        payment_method: 'transfer',
      });
    } else {
      updatePayment(index, {
        due_date: null,
        due_days_from_confirmation: null,
        payment_method: 'transfer',
      });
    }
  }

  return (
    <Card className={hasErrors ? 'border-destructive' : ''}>
      <Collapsible open={paymentsOpen} onOpenChange={setPaymentsOpen}>
        <CardHeader>
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer">
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Płatności ({formData.payment_templates.length})
                {hasErrors && <AlertCircle className="h-4 w-4 text-destructive" />}
              </CardTitle>
              {paymentsOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </div>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            {formData.payment_templates.map((payment, index) => {
              const mode = dueMode(payment);
              return (
                <Card key={index} className="bg-muted/30">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">
                        {payment.payment_type === 'season_pass'
                          ? 'Karnet'
                          : `Rata ${payment.installment_number || index + 1}`}
                      </CardTitle>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive h-8 w-8"
                        onClick={() => removePayment(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Typ płatności */}
                    <div className="space-y-2">
                      <Label>Typ</Label>
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
                        <div className="flex items-center space-x-2 pt-6">
                          <Checkbox
                            id={`first-installment-${index}`}
                            checked={payment.is_first_installment}
                            onCheckedChange={(checked) =>
                              updatePayment(index, { is_first_installment: !!checked })
                            }
                          />
                          <Label htmlFor={`first-installment-${index}`} className="font-normal cursor-pointer">
                            To jest rata 1 (z karnetem)
                          </Label>
                        </div>
                      </div>
                    )}

                    {/* Pola dla karnetu */}
                    {payment.payment_type === 'season_pass' && (
                      <div className="grid gap-4 md:grid-cols-3">
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
                    )}

                    {/* Wspólne pola */}
                    <div className="space-y-4">
                      <div className="grid gap-4 grid-cols-3">
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
                          <Select
                            value={payment.currency}
                            onValueChange={(value) =>
                              updatePayment(index, { currency: value as 'PLN' | 'EUR' })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="PLN">PLN</SelectItem>
                              <SelectItem value="EUR">EUR</SelectItem>
                            </SelectContent>
                          </Select>
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
                              <SelectItem value="both">Gotówka/Przelew</SelectItem>
                              <SelectItem value="transfer">Przelew</SelectItem>
                              <SelectItem value="cash">Gotówka</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Termin płatności</Label>
                        <div className={mode === 'specific' ? 'grid gap-3 grid-cols-2' : ''}>
                          <Select
                            value={mode}
                            onValueChange={(value) => changeDueMode(index, value as DueMode)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="specific">Konkretna data</SelectItem>
                              <SelectItem value="departure" disabled={!departureDate}>
                                W dniu wyjazdu
                              </SelectItem>
                              <SelectItem value="confirmation">5 dni od potwierdzenia obozu</SelectItem>
                            </SelectContent>
                          </Select>
                          {mode === 'specific' && (
                            <Input
                              type="date"
                              value={payment.due_date || ''}
                              onChange={(e) =>
                                updatePayment(index, {
                                  due_date: e.target.value || null,
                                  due_days_from_confirmation: null,
                                })
                              }
                            />
                          )}
                        </div>
                        {!departureDate && (
                          <p className="text-xs text-muted-foreground">
                            Opcja &bdquo;W dniu wyjazdu&rdquo; będzie dostępna po ustawieniu daty wyjazdu.
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            <Button variant="outline" className="w-full" onClick={addPayment}>
              <Plus className="mr-2 h-4 w-4" />
              Dodaj płatność
            </Button>

            {formData.payment_templates.length === 0 && (
              <p className="text-sm text-destructive text-center">
                Dodaj przynajmniej jedną płatność
              </p>
            )}

            <Separator className="my-4" />

            <p className="text-sm text-muted-foreground">
              Numer konta do przelewu jest wspólny dla wszystkich wyjazdów —
              ustawisz go w <span className="font-medium">Ustawienia → Konta bankowe</span>.
            </p>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
