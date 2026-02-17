import { z } from 'zod';

export const paymentTemplateSchema = z.object({
  payment_type: z.enum(['installment', 'season_pass'], {
    message: 'Typ płatności jest wymagany',
  }),
  installment_number: z
    .number()
    .int()
    .positive('Numer raty musi być większy od 0')
    .nullable()
    .optional(),
  is_first_installment: z.boolean().default(false),
  includes_season_pass: z.boolean().default(false),
  category_name: z
    .string()
    .max(100, 'Nazwa kategorii może mieć maksymalnie 100 znaków')
    .nullable()
    .optional(),
  birth_year_from: z
    .number()
    .int()
    .min(1990, 'Rocznik nie może być wcześniejszy niż 1990')
    .max(new Date().getFullYear(), 'Rocznik nie może być w przyszłości')
    .nullable()
    .optional(),
  birth_year_to: z
    .number()
    .int()
    .min(1990, 'Rocznik nie może być wcześniejszy niż 1990')
    .max(new Date().getFullYear(), 'Rocznik nie może być w przyszłości')
    .nullable()
    .optional(),
  amount: z
    .number()
    .positive('Kwota musi być większa od 0')
    .max(100000, 'Kwota nie może przekraczać 100 000'),
  currency: z.enum(['PLN', 'EUR'], {
    message: 'Waluta jest wymagana',
  }),
  due_date: z.string().nullable().optional(),
  payment_method: z.enum(['cash', 'transfer', 'both']).nullable().optional(),
}).refine((data) => {
  if (data.payment_type === 'installment' && !data.installment_number) {
    return false;
  }
  return true;
}, {
  message: 'Numer raty jest wymagany dla płatności typu rata',
  path: ['installment_number'],
}).refine((data) => {
  if (data.payment_type === 'season_pass') {
    return data.birth_year_from !== null && data.birth_year_to !== null;
  }
  return true;
}, {
  message: 'Roczniki są wymagane dla karnetu',
  path: ['birth_year_from'],
}).refine((data) => {
  if (data.birth_year_from && data.birth_year_to) {
    return data.birth_year_from <= data.birth_year_to;
  }
  return true;
}, {
  message: 'Rocznik "od" nie może być większy niż rocznik "do"',
  path: ['birth_year_to'],
});

export const tripBasicInfoSchema = z.object({
  title: z
    .string()
    .min(3, 'Tytuł musi mieć minimum 3 znaki')
    .max(200, 'Tytuł może mieć maksymalnie 200 znaków'),
  description: z
    .string()
    .max(2000, 'Opis może mieć maksymalnie 2000 znaków')
    .nullable()
    .optional(),
  status: z.enum(['draft', 'published', 'cancelled', 'completed'], {
    message: 'Status jest wymagany',
  }),
});

export const tripDatesSchema = z.object({
  departure_datetime: z
    .string()
    .min(1, 'Data wyjazdu jest wymagana'),
  departure_location: z
    .string()
    .min(3, 'Miejsce wyjazdu musi mieć minimum 3 znaki')
    .max(200, 'Miejsce wyjazdu może mieć maksymalnie 200 znaków'),
  return_datetime: z
    .string()
    .min(1, 'Data powrotu jest wymagana'),
  return_location: z
    .string()
    .min(3, 'Miejsce powrotu musi mieć minimum 3 znaki')
    .max(200, 'Miejsce powrotu może mieć maksymalnie 200 znaków'),
}).refine((data) => {
  const departure = new Date(data.departure_datetime);
  const returnDate = new Date(data.return_datetime);
  return returnDate > departure;
}, {
  message: 'Data powrotu musi być późniejsza niż data wyjazdu',
  path: ['return_datetime'],
});

export const tripGroupsSchema = z.object({
  group_ids: z
    .array(z.string().uuid())
    .min(1, 'Wybierz przynajmniej jedną grupę'),
});

export const tripPaymentsSchema = z.object({
  payment_templates: z
    .array(paymentTemplateSchema)
    .min(1, 'Dodaj przynajmniej jedną płatność'),
  bank_account_pln: z
    .string()
    .min(1, 'Numer konta PLN jest wymagany')
    .default('39 1240 1444 1111 0010 7170 4855'),
  bank_account_eur: z
    .string()
    .min(1, 'Numer konta EUR jest wymagany')
    .default('PL21 1240 1444 1978 0010 7136 2778'),
});

export const tripFullSchema = tripBasicInfoSchema
  .merge(tripDatesSchema)
  .merge(tripGroupsSchema)
  .merge(tripPaymentsSchema);

export type PaymentTemplateInput = z.infer<typeof paymentTemplateSchema>;
export type TripBasicInfoInput = z.infer<typeof tripBasicInfoSchema>;
export type TripDatesInput = z.infer<typeof tripDatesSchema>;
export type TripGroupsInput = z.infer<typeof tripGroupsSchema>;
export type TripPaymentsInput = z.infer<typeof tripPaymentsSchema>;
export type TripFullInput = z.infer<typeof tripFullSchema>;
