import { z } from 'zod';

export const notificationSchema = z.object({
  notification_type: z.enum(['payment_reminder', 'new_trip', 'trip_update', 'custom'], {
    message: 'Typ powiadomienia jest wymagany',
  }),
  target_type: z.enum(['all', 'group', 'trip', 'individual'], {
    message: 'Typ odbiorcy jest wymagany',
  }),
  target_group_id: z.string().uuid().nullable().optional(),
  target_trip_id: z.string().uuid().nullable().optional(),
  target_user_id: z.string().uuid().nullable().optional(),
  subject: z
    .string()
    .min(3, 'Temat musi mieć minimum 3 znaki')
    .max(200, 'Temat może mieć maksymalnie 200 znaków'),
  body: z
    .string()
    .min(10, 'Treść musi mieć minimum 10 znaków')
    .max(5000, 'Treść może mieć maksymalnie 5000 znaków'),
  channel: z.enum(['email', 'sms', 'both'], {
    message: 'Kanał powiadomienia jest wymagany',
  }),
}).refine((data) => {
  if (data.target_type === 'group' && !data.target_group_id) {
    return false;
  }
  return true;
}, {
  message: 'Wybierz grupę dla tego typu odbiorcy',
  path: ['target_group_id'],
}).refine((data) => {
  if (data.target_type === 'trip' && !data.target_trip_id) {
    return false;
  }
  return true;
}, {
  message: 'Wybierz wyjazd dla tego typu odbiorcy',
  path: ['target_trip_id'],
}).refine((data) => {
  if (data.target_type === 'individual' && !data.target_user_id) {
    return false;
  }
  return true;
}, {
  message: 'Wybierz użytkownika dla tego typu odbiorcy',
  path: ['target_user_id'],
});

export type NotificationInput = z.infer<typeof notificationSchema>;
