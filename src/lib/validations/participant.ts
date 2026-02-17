import { z } from 'zod';

export const participantSchema = z.object({
  first_name: z
    .string()
    .min(2, 'Imię musi mieć minimum 2 znaki')
    .max(50, 'Imię może mieć maksymalnie 50 znaków'),
  last_name: z
    .string()
    .min(2, 'Nazwisko musi mieć minimum 2 znaki')
    .max(50, 'Nazwisko może mieć maksymalnie 50 znaków'),
  birth_date: z
    .string()
    .min(1, 'Data urodzenia jest wymagana')
    .refine((date) => {
      const birthDate = new Date(date);
      const today = new Date();
      return birthDate <= today;
    }, 'Data urodzenia nie może być w przyszłości')
    .refine((date) => {
      const birthDate = new Date(date);
      const minDate = new Date();
      minDate.setFullYear(minDate.getFullYear() - 25);
      return birthDate >= minDate;
    }, 'Dziecko nie może mieć więcej niż 25 lat'),
  height_cm: z
    .number()
    .positive('Wzrost musi być większy od 0')
    .max(250, 'Wzrost nie może przekraczać 250 cm')
    .nullable()
    .optional(),
  group_id: z
    .string()
    .uuid('Nieprawidłowy identyfikator grupy')
    .nullable()
    .optional(),
});

export const participantWithCustomFieldsSchema = participantSchema.extend({
  custom_fields: z.record(z.string(), z.string()).optional(),
});

export type ParticipantInput = z.infer<typeof participantSchema>;
export type ParticipantWithCustomFieldsInput = z.infer<typeof participantWithCustomFieldsSchema>;
