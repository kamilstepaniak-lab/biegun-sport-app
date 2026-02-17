'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, ChevronDown, ChevronUp, MapPin, Calendar, CreditCard, Users, Info } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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

import { createTrip, updateTrip } from '@/lib/actions/trips';
import type { Group, TripWithPaymentTemplates, CreatePaymentTemplateInput, TripStatus } from '@/types';

export interface TripFormData {
  title: string;
  description: string;
  declaration_deadline: string;
  status: TripStatus;
  departure_datetime: string;
  departure_location: string;
  departure_stop2_datetime: string;
  departure_stop2_location: string;
  return_datetime: string;
  return_location: string;
  return_stop2_datetime: string;
  return_stop2_location: string;
  group_ids: string[];
  payment_templates: CreatePaymentTemplateInput[];
  bank_account_pln: string;
  bank_account_eur: string;
}

interface TripFormProps {
  groups: Group[];
  trip?: TripWithPaymentTemplates;
  mode: 'create' | 'edit';
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
  payment_method: 'transfer',
};

// Predefiniowane przystanki
const PREDEFINED_STOPS = [
  'BP Pasternik',
  'Orlen Opatkowice',
  'BP Opatkowice',
  'Ikea',
];

// Konwertuj datę ISO na format datetime-local (YYYY-MM-DDTHH:mm)
function formatDateTimeLocal(isoDate: string | null | undefined): string {
  if (!isoDate) return '';
  try {
    const date = new Date(isoDate);
    if (isNaN(date.getTime())) return '';
    // Format: YYYY-MM-DDTHH:mm
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch {
    return '';
  }
}

function LocationSelect({
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

export function TripForm({ groups, trip, mode }: TripFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showStop2Departure, setShowStop2Departure] = useState(!!trip?.departure_stop2_location);
  const [showStop2Return, setShowStop2Return] = useState(!!trip?.return_stop2_location);
  const [paymentsOpen, setPaymentsOpen] = useState(true);

  const [formData, setFormData] = useState<TripFormData>({
    title: trip?.title || '',
    description: trip?.description || '',
    declaration_deadline: (trip as TripWithPaymentTemplates & { declaration_deadline?: string | null })?.declaration_deadline || '',
    status: trip?.status || 'draft',
    departure_datetime: formatDateTimeLocal(trip?.departure_datetime),
    departure_location: trip?.departure_location || '',
    departure_stop2_datetime: formatDateTimeLocal(trip?.departure_stop2_datetime),
    departure_stop2_location: trip?.departure_stop2_location || '',
    return_datetime: formatDateTimeLocal(trip?.return_datetime),
    return_location: trip?.return_location || '',
    return_stop2_datetime: formatDateTimeLocal(trip?.return_stop2_datetime),
    return_stop2_location: trip?.return_stop2_location || '',
    group_ids: trip?.groups?.map((g) => g.id) || [],
    payment_templates: trip?.payment_templates?.map(pt => ({
      ...pt,
      due_date: pt.due_date ? pt.due_date.split('T')[0] : null,
    })) || [],
    bank_account_pln: trip?.bank_account_pln || '39 1240 1444 1111 0010 7170 4855',
    bank_account_eur: trip?.bank_account_eur || 'PL21 1240 1444 1978 0010 7136 2778',
  });

  function updateFormData(data: Partial<TripFormData>) {
    setFormData((prev) => ({ ...prev, ...data }));
  }

  function toggleGroup(groupId: string) {
    const newGroupIds = formData.group_ids.includes(groupId)
      ? formData.group_ids.filter((id) => id !== groupId)
      : [...formData.group_ids, groupId];
    updateFormData({ group_ids: newGroupIds });
  }

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

  // Sprawdź co blokuje walidację
  const validationErrors: string[] = [];
  if (formData.title.trim().length < 3) validationErrors.push('Tytuł za krótki (min 3 znaki)');
  if (!formData.departure_datetime) validationErrors.push('Brak daty wyjazdu');
  if (formData.departure_location.trim().length < 3) validationErrors.push('Miejsce wyjazdu za krótkie');
  if (!formData.return_datetime) validationErrors.push('Brak daty powrotu');
  if (formData.return_location.trim().length < 3) validationErrors.push('Miejsce powrotu za krótkie');
  if (formData.departure_datetime && formData.return_datetime &&
      new Date(formData.return_datetime) <= new Date(formData.departure_datetime)) {
    validationErrors.push('Data powrotu musi być po dacie wyjazdu');
  }
  if (formData.group_ids.length === 0) validationErrors.push('Wybierz przynajmniej jedną grupę');
  if (formData.payment_templates.length === 0) validationErrors.push('Dodaj przynajmniej jedną płatność');
  formData.payment_templates.forEach((p, i) => {
    if (p.amount <= 0) validationErrors.push(`Płatność ${i + 1}: kwota musi być > 0`);
    if (p.payment_type === 'installment' && !p.installment_number) {
      validationErrors.push(`Płatność ${i + 1}: podaj numer raty`);
    }
  });

  const isValid = validationErrors.length === 0;

  // Debug - pokaż w konsoli co blokuje
  if (!isValid && validationErrors.length > 0) {
    console.log('Walidacja formularza - błędy:', validationErrors);
  }

  async function handleSubmit(saveAsDraft: boolean = false) {
    setIsSubmitting(true);

    try {
      const data = {
        ...formData,
        status: saveAsDraft ? 'draft' as TripStatus : formData.status,
        departure_stop2_datetime: formData.departure_stop2_datetime || null,
        departure_stop2_location: formData.departure_stop2_location || null,
        return_stop2_datetime: formData.return_stop2_datetime || null,
        return_stop2_location: formData.return_stop2_location || null,
      };

      const result = mode === 'create'
        ? await createTrip(data)
        : await updateTrip(trip!.id, data);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(
          mode === 'create'
            ? saveAsDraft
              ? 'Wyjazd zapisany jako szkic'
              : 'Wyjazd został utworzony'
            : 'Wyjazd został zaktualizowany'
        );
        router.push('/admin/trips');
        router.refresh();
      }
    } catch {
      toast.error('Wystąpił nieoczekiwany błąd');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Podstawowe informacje */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Podstawowe informacje
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="title">Tytuł wyjazdu *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => updateFormData({ title: e.target.value })}
                placeholder="np. Wyjazd narciarski Zakopane 2026"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description">Opis</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => updateFormData({ description: e.target.value })}
                placeholder="Opcjonalny opis wyjazdu..."
                rows={3}
              />
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
            <div className="space-y-2">
              <Label>Status</Label>
              <RadioGroup
                value={formData.status}
                onValueChange={(value) => updateFormData({ status: value as TripStatus })}
                className="flex gap-4"
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
          </div>
        </CardContent>
      </Card>

      {/* Terminy i lokalizacje */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Terminy i lokalizacje
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* WYJAZD */}
          <div className="space-y-4">
            <h4 className="font-semibold text-green-700 flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Wyjazd - Przystanek 1 (główny)
            </h4>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Data i godzina *</Label>
                <Input
                  type="datetime-local"
                  value={formData.departure_datetime}
                  onChange={(e) => updateFormData({ departure_datetime: e.target.value })}
                />
              </div>
              <LocationSelect
                label="Miejsce *"
                value={formData.departure_location}
                onChange={(val) => updateFormData({ departure_location: val })}
              />
            </div>

            {!showStop2Departure ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowStop2Departure(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Dodaj drugi przystanek wyjazdu
              </Button>
            ) : (
              <div className="space-y-4 pl-4 border-l-2 border-green-200">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-green-600">Wyjazd - Przystanek 2</h4>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowStop2Departure(false);
                      updateFormData({ departure_stop2_datetime: '', departure_stop2_location: '' });
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Data i godzina</Label>
                    <Input
                      type="datetime-local"
                      value={formData.departure_stop2_datetime}
                      onChange={(e) => updateFormData({ departure_stop2_datetime: e.target.value })}
                    />
                  </div>
                  <LocationSelect
                    label="Miejsce"
                    value={formData.departure_stop2_location}
                    onChange={(val) => updateFormData({ departure_stop2_location: val })}
                  />
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* POWRÓT */}
          <div className="space-y-4">
            <h4 className="font-semibold text-blue-700 flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Powrót - Przystanek 1 (główny)
            </h4>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Data i godzina *</Label>
                <Input
                  type="datetime-local"
                  value={formData.return_datetime}
                  onChange={(e) => updateFormData({ return_datetime: e.target.value })}
                />
                {formData.departure_datetime && formData.return_datetime &&
                  new Date(formData.return_datetime) <= new Date(formData.departure_datetime) && (
                    <p className="text-sm text-destructive">
                      Data powrotu musi być późniejsza niż data wyjazdu
                    </p>
                  )}
              </div>
              <LocationSelect
                label="Miejsce *"
                value={formData.return_location}
                onChange={(val) => updateFormData({ return_location: val })}
              />
            </div>

            {!showStop2Return ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowStop2Return(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Dodaj drugi przystanek powrotu
              </Button>
            ) : (
              <div className="space-y-4 pl-4 border-l-2 border-blue-200">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-blue-600">Powrót - Przystanek 2</h4>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowStop2Return(false);
                      updateFormData({ return_stop2_datetime: '', return_stop2_location: '' });
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Data i godzina</Label>
                    <Input
                      type="datetime-local"
                      value={formData.return_stop2_datetime}
                      onChange={(e) => updateFormData({ return_stop2_datetime: e.target.value })}
                    />
                  </div>
                  <LocationSelect
                    label="Miejsce"
                    value={formData.return_stop2_location}
                    onChange={(val) => updateFormData({ return_stop2_location: val })}
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Grupy */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Grupy
          </CardTitle>
          <CardDescription>
            Wybierz grupy, dla których dostępny będzie ten wyjazd
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {groups.map((group) => (
              <div
                key={group.id}
                className={`flex items-start space-x-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                  formData.group_ids.includes(group.id)
                    ? 'border-primary bg-primary/5'
                    : 'hover:bg-muted/50'
                }`}
                onClick={() => toggleGroup(group.id)}
              >
                <Checkbox
                  id={group.id}
                  checked={formData.group_ids.includes(group.id)}
                  onCheckedChange={() => toggleGroup(group.id)}
                />
                <div>
                  <Label htmlFor={group.id} className="font-medium cursor-pointer">
                    {group.name}
                  </Label>
                </div>
              </div>
            ))}
          </div>
          {formData.group_ids.length === 0 && (
            <p className="text-sm text-destructive mt-2">Wybierz przynajmniej jedną grupę</p>
          )}
        </CardContent>
      </Card>

      {/* Płatności */}
      <Card>
        <Collapsible open={paymentsOpen} onOpenChange={setPaymentsOpen}>
          <CardHeader>
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between cursor-pointer">
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Płatności ({formData.payment_templates.length})
                </CardTitle>
                {paymentsOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </div>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              {formData.payment_templates.map((payment, index) => (
                <Card key={index} className="bg-muted/30">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">
                        Płatność {index + 1}
                        {payment.payment_type === 'installment' && payment.installment_number &&
                          ` - Rata ${payment.installment_number}`
                        }
                        {payment.payment_type === 'season_pass' && ' - Karnet'}
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
                        <div className="space-y-4 pt-6">
                          <div className="flex items-center space-x-2">
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
                    <div className="grid gap-4 md:grid-cols-4">
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
                        <Label>Termin płatności</Label>
                        <Input
                          type="date"
                          value={payment.due_date || ''}
                          onChange={(e) =>
                            updatePayment(index, { due_date: e.target.value || null })
                          }
                        />
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`due-departure-${index}`}
                            checked={!!formData.departure_datetime && !!payment.due_date && payment.due_date === formData.departure_datetime.split('T')[0]}
                            onChange={(e) => {
                              if (e.target.checked && formData.departure_datetime) {
                                updatePayment(index, { due_date: formData.departure_datetime.split('T')[0], payment_method: 'cash' });
                              } else {
                                updatePayment(index, { due_date: null, payment_method: 'transfer' });
                              }
                            }}
                            className="w-4 h-4 rounded accent-gray-900 cursor-pointer"
                          />
                          <label htmlFor={`due-departure-${index}`} className="text-xs text-gray-500 cursor-pointer select-none">
                            W dniu wyjazdu
                          </label>
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
                            <SelectItem value="both">Gotówka/Przelew</SelectItem>
                            <SelectItem value="transfer">Tylko przelew</SelectItem>
                            <SelectItem value="cash">Tylko gotówka</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

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

              {/* Dane do przelewu */}
              <div className="space-y-4">
                <h4 className="font-medium">Dane do przelewu</h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Konto PLN</Label>
                    <Input
                      value={formData.bank_account_pln}
                      onChange={(e) => updateFormData({ bank_account_pln: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Konto EUR</Label>
                    <Input
                      value={formData.bank_account_eur}
                      onChange={(e) => updateFormData({ bank_account_eur: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Przyciski akcji */}
      <div className="flex justify-between gap-4 sticky bottom-4 bg-background p-4 rounded-lg border shadow-lg">
        <Button
          variant="outline"
          onClick={() => router.back()}
          disabled={isSubmitting}
        >
          Anuluj
        </Button>
        <div className="flex gap-2">
          {mode === 'create' && (
            <Button
              variant="secondary"
              onClick={() => handleSubmit(true)}
              disabled={isSubmitting || !formData.title.trim()}
            >
              Zapisz jako szkic
            </Button>
          )}
          <Button
            onClick={() => handleSubmit(false)}
            disabled={isSubmitting || !isValid}
          >
            {isSubmitting ? 'Zapisywanie...' : mode === 'create' ? 'Utwórz wyjazd' : 'Zapisz zmiany'}
          </Button>
        </div>
      </div>
    </div>
  );
}
