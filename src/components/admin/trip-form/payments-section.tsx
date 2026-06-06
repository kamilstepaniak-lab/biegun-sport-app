'use client';

import { useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp, CreditCard, AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
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
import { PanelCard, PanelIcon } from '@/components/shared';
import { cn } from '@/lib/utils';
import type { CreatePaymentTemplateInput } from '@/types';

import { emptyPayment, type SectionProps } from './types';

type DueMode = 'specific' | 'departure' | 'confirmation' | 'installment1';

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

  // Czy w cenniku istnieje rata 1 (cel dla trybu „w terminie raty 1")
  const hasFirstInstallment = formData.payment_templates.some(
    (p) => p.payment_type === 'installment' && p.installment_number === 1,
  );

  function dueMode(payment: CreatePaymentTemplateInput): DueMode {
    if (payment.due_with_first_installment) return 'installment1';
    if (departureDate && payment.due_date === departureDate) return 'departure';
    if (payment.due_days_from_confirmation) return 'confirmation';
    return 'specific';
  }

  function changeDueMode(index: number, mode: DueMode) {
    if (mode === 'installment1') {
      updatePayment(index, {
        due_date: null,
        due_days_from_confirmation: null,
        due_with_first_installment: true,
      });
    } else if (mode === 'departure') {
      updatePayment(index, {
        due_date: departureDate,
        due_days_from_confirmation: null,
        due_with_first_installment: false,
        payment_method: 'cash',
      });
    } else if (mode === 'confirmation') {
      updatePayment(index, {
        due_date: null,
        due_days_from_confirmation: 5,
        due_with_first_installment: false,
        payment_method: 'transfer',
      });
    } else {
      updatePayment(index, {
        due_date: null,
        due_days_from_confirmation: null,
        due_with_first_installment: false,
        payment_method: 'transfer',
      });
    }
  }

  return (
    <PanelCard className={cn('p-5 sm:p-6', hasErrors && 'ring-2 ring-red-300')}>
      <Collapsible open={paymentsOpen} onOpenChange={setPaymentsOpen}>
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between gap-4 cursor-pointer">
            <div className="flex items-start gap-3">
              <PanelIcon icon={CreditCard} tone="blue" />
              <div>
                <h2 className="text-base font-semibold leading-tight text-slate-900">
                  Płatności ({formData.payment_templates.length})
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  Raty i karnety naliczane uczestnikom tego wyjazdu
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {hasErrors && <AlertCircle className="h-5 w-5 text-red-500" />}
              {paymentsOpen ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-4 pt-5">
            {formData.payment_templates.map((payment, index) => {
              const mode = dueMode(payment);
              return (
                <div key={index} className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-900">
                      {payment.payment_type === 'season_pass'
                        ? 'Karnet'
                        : `Rata ${payment.installment_number || index + 1}`}
                    </h3>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-600 hover:text-red-600 h-8 w-8"
                      onClick={() => removePayment(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
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
                            // Karnet domyślnie płatny w terminie raty 1 (zaliczka).
                            // Ratę zostawiamy z dotychczasowym trybem terminu.
                            ...(value === 'season_pass'
                              ? { due_with_first_installment: true, due_date: null, due_days_from_confirmation: null }
                              : { due_with_first_installment: false }),
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
                              {payment.payment_type === 'season_pass' && (
                                <SelectItem value="installment1" disabled={!hasFirstInstallment}>
                                  W terminie raty 1
                                </SelectItem>
                              )}
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
                </div>
              );
            })}

            <Button variant="outline" className="w-full" onClick={addPayment}>
              <Plus className="mr-2 h-4 w-4" />
              Dodaj płatność
            </Button>

            {formData.payment_templates.length === 0 && (
              <p className="text-sm text-red-600 text-center">
                Dodaj przynajmniej jedną płatność
              </p>
            )}

            <Separator className="my-4" />

            <p className="text-sm text-slate-500">
              Numer konta do przelewu jest wspólny dla wszystkich wyjazdów —
              ustawisz go w <span className="font-medium">Ustawienia → Konta bankowe</span>.
            </p>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </PanelCard>
  );
}
