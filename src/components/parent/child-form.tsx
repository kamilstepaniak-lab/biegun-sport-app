'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { createParticipant, updateParticipant } from '@/lib/actions/participants';
import { participantSchema, type ParticipantInput } from '@/lib/validations/participant';
import type { Group, ParticipantWithGroup, CustomFieldDefinition } from '@/types';

interface ChildFormProps {
  groups: Group[];
  customFields?: CustomFieldDefinition[];
  child?: ParticipantWithGroup & { custom_fields?: Array<{ field_name: string; field_value: string | null }> };
  mode: 'create' | 'edit';
}

export function ChildForm({ groups, customFields = [], child, mode }: ChildFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(
    child?.group || null
  );

  const defaultCustomFields: Record<string, string> = {};
  child?.custom_fields?.forEach((cf) => {
    defaultCustomFields[cf.field_name] = cf.field_value || '';
  });

  const form = useForm<ParticipantInput & { custom_fields?: Record<string, string> }>({
    resolver: zodResolver(participantSchema),
    defaultValues: {
      first_name: child?.first_name || '',
      last_name: child?.last_name || '',
      birth_date: child?.birth_date || '',
      height_cm: child?.height_cm || undefined,
      group_id: child?.group?.id || undefined,
      custom_fields: defaultCustomFields,
    },
  });

  async function onSubmit(data: ParticipantInput & { custom_fields?: Record<string, string> }) {
    setIsLoading(true);

    try {
      const result = mode === 'create'
        ? await createParticipant(data)
        : await updateParticipant(child!.id, data);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(
          mode === 'create'
            ? 'Dziecko zostało dodane'
            : 'Dane dziecka zostały zaktualizowane'
        );
        router.push('/parent/children');
        router.refresh();
      }
    } catch {
      toast.error('Wystąpił nieoczekiwany błąd');
    } finally {
      setIsLoading(false);
    }
  }

  function handleGroupChange(groupId: string) {
    const group = groups.find((g) => g.id === groupId) || null;
    setSelectedGroup(group);
    form.setValue('group_id', groupId || undefined);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Dane dziecka</CardTitle>
            <CardDescription>
              Podstawowe informacje o dziecku
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="first_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Imię *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Jan"
                        disabled={isLoading}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="last_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nazwisko *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Kowalski"
                        disabled={isLoading}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="birth_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data urodzenia *</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        disabled={isLoading}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="height_cm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Wzrost (cm)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="120"
                        disabled={isLoading}
                        {...field}
                        value={field.value || ''}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value ? parseInt(e.target.value) : undefined
                          )
                        }
                      />
                    </FormControl>
                    <FormDescription>
                      Opcjonalne - przydatne przy doborze sprzętu
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="group_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Grupa</FormLabel>
                  <Select
                    onValueChange={handleGroupChange}
                    defaultValue={field.value || undefined}
                    disabled={isLoading}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Wybierz grupę (opcjonalnie)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {groups.map((group) => (
                        <SelectItem key={group.id} value={group.id}>
                          {group.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {selectedGroup?.description || 'Wybierz grupę, aby zobaczyć opis'}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {customFields.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Dodatkowe informacje</CardTitle>
              <CardDescription>
                Opcjonalne pola uzupełniające
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {customFields.map((field) => (
                <FormField
                  key={field.id}
                  control={form.control}
                  name={`custom_fields.${field.field_name}`}
                  render={({ field: formField }) => (
                    <FormItem>
                      <FormLabel>
                        {field.field_label}
                        {field.is_required && ' *'}
                      </FormLabel>
                      <FormControl>
                        {field.field_type === 'boolean' ? (
                          <Select
                            onValueChange={formField.onChange}
                            defaultValue={formField.value}
                            disabled={isLoading}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Wybierz" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="true">Tak</SelectItem>
                              <SelectItem value="false">Nie</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : field.field_type === 'select' && field.options ? (
                          <Select
                            onValueChange={formField.onChange}
                            defaultValue={formField.value}
                            disabled={isLoading}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Wybierz" />
                            </SelectTrigger>
                            <SelectContent>
                              {(field.options as { values?: string[] })?.values?.map((option: string) => (
                                <SelectItem key={option} value={option}>
                                  {option}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            type={
                              field.field_type === 'number'
                                ? 'number'
                                : field.field_type === 'date'
                                ? 'date'
                                : 'text'
                            }
                            disabled={isLoading}
                            {...formField}
                            value={formField.value || ''}
                          />
                        )}
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/parent/children')}
            disabled={isLoading}
          >
            Anuluj
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {mode === 'create' ? 'Dodawanie...' : 'Zapisywanie...'}
              </>
            ) : mode === 'create' ? (
              'Dodaj dziecko'
            ) : (
              'Zapisz zmiany'
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
