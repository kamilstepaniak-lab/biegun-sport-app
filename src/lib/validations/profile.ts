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
  address_street: z
    .string()
    .max(100, 'Adres może mieć maksymalnie 100 znaków')
    .nullable()
    .optional()
    .or(z.literal('')),
  address_zip: z
    .string()
    .regex(/^\d{2}-\d{3}$/, 'Format: XX-XXX (np. 30-731)')
    .nullable()
    .optional()
    .or(z.literal('')),
  address_city: z
    .string()
    .max(80, 'Miasto może mieć maksymalnie 80 znaków')
    .nullable()
    .optional()
    .or(z.literal('')),
  pesel: z
    .string()
    .regex(/^\d{11}$/, 'PESEL musi mieć dokładnie 11 cyfr')
    .nullable()
    .optional()
    .or(z.literal('')),
});

export type ProfileInput = z.infer<typeof profileSchema>;
