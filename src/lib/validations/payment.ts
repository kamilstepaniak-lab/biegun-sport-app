import { z } from 'zod';

export const paymentTransactionSchema = z.object({
  payment_id: z.string().uuid('Nieprawidłowy identyfikator płatności'),
  amount: z
    .number()
    .positive('Kwota musi być większa od 0')
    .max(100000, 'Kwota nie może przekraczać 100 000'),
  currency: z.enum(['PLN', 'EUR'], {
    message: 'Waluta jest wymagana',
  }),
  transaction_date: z.string().min(1, 'Data transakcji jest wymagana'),
  payment_method: z.enum(['cash', 'transfer'], {
    message: 'Metoda płatności jest wymagana',
  }),
  notes: z
    .string()
    .max(500, 'Notatka może mieć maksymalnie 500 znaków')
    .nullable()
    .optional(),
});

export const discountSchema = z.object({
  payment_id: z.string().uuid('Nieprawidłowy identyfikator płatności'),
  discount_percentage: z
    .number()
    .min(0, 'Zniżka nie może być mniejsza niż 0%')
    .max(100, 'Zniżka nie może być większa niż 100%'),
});

export const markAsPaidSchema = z.object({
  payment_id: z.string().uuid('Nieprawidłowy identyfikator płatności'),
  payment_method: z.enum(['cash', 'transfer'], {
    message: 'Metoda płatności jest wymagana',
  }),
});

export type PaymentTransactionInput = z.infer<typeof paymentTransactionSchema>;
export type DiscountInput = z.infer<typeof discountSchema>;
export type MarkAsPaidInput = z.infer<typeof markAsPaidSchema>;
