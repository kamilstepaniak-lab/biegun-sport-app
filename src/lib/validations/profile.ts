import { z } from 'zod';

export const profileSchema = z.object({
  first_name: z
    .string()
    .min(2, 'Imię musi mieć minimum 2 znaki')
    .max(50, 'Imię może mieć maksymalnie 50 znaków')
    .nullable()
    .optional(),
  last_name: z
    .string()
    .min(2, 'Nazwisko musi mieć minimum 2 znaki')
    .max(50, 'Nazwisko może mieć maksymalnie 50 znaków')
    .nullable()
    .optional(),
  phone: z
    .string()
    .min(9, 'Numer telefonu musi mieć minimum 9 cyfr')
    .regex(/^[0-9+\s-]+$/, 'Nieprawidłowy format numeru telefonu'),
  secondary_email: z
    .string()
    .email('Nieprawidłowy format email')
    .nullable()
    .optional()
    .or(z.literal('')),
  secondary_phone: z
    .string()
    .regex(/^[0-9+\s-]*$/, 'Nieprawidłowy format numeru telefonu')
    .nullable()
    .optional()
    .or(z.literal('')),
});

export type ProfileInput = z.infer<typeof profileSchema>;
