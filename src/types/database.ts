// Typy bazodanowe dla aplikacji BiegunSport

export type UserRole = 'parent' | 'admin';

export type TripStatus = 'draft' | 'published' | 'cancelled' | 'completed';

export type PaymentType = 'installment' | 'season_pass';

export type PaymentStatus = 'pending' | 'partially_paid' | 'paid' | 'overdue' | 'partially_paid_overdue' | 'cancelled';

export type PaymentMethod = 'cash' | 'transfer' | 'both';

export type Currency = 'PLN' | 'EUR';

export type NotificationType = 'payment_reminder' | 'new_trip' | 'trip_update' | 'custom';

export type NotificationTargetType = 'all' | 'group' | 'trip' | 'individual';

export type NotificationChannel = 'email' | 'sms' | 'both';

export type NotificationStatus = 'draft' | 'approved' | 'sent' | 'failed';

export type CustomFieldType = 'text' | 'number' | 'date' | 'boolean' | 'select';

export type RegistrationStatus = 'active' | 'cancelled';

export type ParticipationStatus = 'unconfirmed' | 'confirmed' | 'not_going' | 'other';

export type RegistrationType = 'parent' | 'admin';

// Interfejsy tabel

export interface Profile {
  id: string;
  email: string;
  phone: string;
  secondary_email: string | null;
  secondary_phone: string | null;
  first_name: string | null;
  last_name: string | null;
  address_street: string | null;
  address_zip: string | null;
  address_city: string | null;
  pesel: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Participant {
  id: string;
  parent_id: string;
  first_name: string;
  last_name: string;
  birth_date: string;
  height_cm: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ParticipantCustomField {
  id: string;
  participant_id: string;
  field_name: string;
  field_value: string | null;
  created_at: string;
}

export interface CustomFieldDefinition {
  id: string;
  field_name: string;
  field_label: string;
  field_type: CustomFieldType;
  options: Record<string, unknown> | null;
  is_required: boolean;
  display_order: number | null;
  created_at: string;
}

export interface Group {
  id: string;
  name: string;
  description: string | null;
  display_order: number | null;
  is_selectable_by_parent: boolean;
  created_at: string;
}

export interface ParticipantGroup {
  id: string;
  participant_id: string;
  group_id: string;
  assigned_at: string;
  assigned_by: string | null;
}

export interface Trip {
  id: string;
  title: string;
  description: string | null;
  declaration_deadline: string | null;
  location: string | null;
  departure_datetime: string;
  departure_location: string;
  departure_stop2_datetime: string | null;
  departure_stop2_location: string | null;
  return_datetime: string;
  return_location: string;
  return_stop2_datetime: string | null;
  return_stop2_location: string | null;
  bank_account_pln: string;
  bank_account_eur: string;
  status: TripStatus;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface TripGroup {
  id: string;
  trip_id: string;
  group_id: string;
}

export interface TripPaymentTemplate {
  id: string;
  trip_id: string;
  payment_type: PaymentType;
  installment_number: number | null;
  is_first_installment: boolean;
  includes_season_pass: boolean;
  category_name: string | null;
  birth_year_from: number | null;
  birth_year_to: number | null;
  amount: number;
  currency: Currency;
  due_date: string | null;
  payment_method: PaymentMethod | null;
  created_at: string;
}

export interface TripRegistration {
  id: string;
  trip_id: string;
  participant_id: string;
  registered_by: string;
  registration_type: RegistrationType;
  is_outside_group: boolean;
  status: RegistrationStatus;
  participation_status: ParticipationStatus;
  participation_note: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  registration_id: string;
  template_id: string | null;
  payment_type: PaymentType;
  installment_number: number | null;
  original_amount: number;
  discount_percentage: number;
  amount: number;
  amount_paid: number;
  amount_remaining: number;
  currency: Currency;
  due_date: string | null;
  status: PaymentStatus;
  paid_at: string | null;
  payment_method_used: 'cash' | 'transfer' | null;
  admin_notes: string | null;
  marked_by: string | null;
  discount_applied_by: string | null;
  discount_applied_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentTransaction {
  id: string;
  payment_id: string;
  amount: number;
  currency: Currency;
  transaction_date: string;
  payment_method: 'cash' | 'transfer';
  notes: string | null;
  recorded_by: string;
  created_at: string;
}

export interface Notification {
  id: string;
  notification_type: NotificationType;
  target_type: NotificationTargetType;
  target_group_id: string | null;
  target_trip_id: string | null;
  target_user_id: string | null;
  subject: string;
  body: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  created_at: string;
  approved_at: string | null;
  approved_by: string | null;
  sent_at: string | null;
}

export interface NotificationLog {
  id: string;
  notification_id: string;
  recipient_id: string;
  channel: 'email' | 'sms';
  status: 'sent' | 'failed' | 'bounced';
  sent_at: string;
  error_message: string | null;
}

// Typy rozszerzone (z relacjami)

export interface ParticipantWithGroup extends Participant {
  group: Group | null;
}

export interface ParticipantWithParent extends Participant {
  parent: Profile;
}

export interface ParticipantFull extends Participant {
  parent: Profile;
  group: Group | null;
  custom_fields: ParticipantCustomField[];
}

export interface TripWithGroups extends Trip {
  groups: Group[];
}

export interface TripWithPaymentTemplates extends Trip {
  groups: Group[];
  payment_templates: TripPaymentTemplate[];
}

export interface RegistrationWithDetails extends TripRegistration {
  participant: ParticipantWithParent;
  trip: Trip;
  payments: Payment[];
}

export interface PaymentWithDetails extends Payment {
  registration: TripRegistration & {
    participant: ParticipantWithParent;
    trip: Trip;
  };
  transactions: PaymentTransaction[];
}

export interface TripContractTemplate {
  id: string;
  trip_id: string;
  template_text: string;
  is_active: boolean;
  activated_at: string | null;
  activated_by: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
}

export interface TripContract {
  id: string;
  trip_id: string;
  participant_id: string;
  registration_id: string | null;
  contract_text: string;
  contract_number: string | null;
  accepted_at: string | null;
  accepted_by_parent_id: string | null;
  created_at: string;
  created_by: string | null;
}

export interface TripContractWithDetails extends TripContract {
  trip: Pick<Trip, 'id' | 'title' | 'departure_datetime' | 'return_datetime'>;
  participant: Pick<Participant, 'id' | 'first_name' | 'last_name' | 'birth_date'>;
  parent: Pick<Profile, 'id' | 'email' | 'first_name' | 'last_name'>;
}

// Typy dla formularzy

export interface CreateParticipantInput {
  first_name: string;
  last_name: string;
  birth_date: string;
  height_cm?: number | null;
  group_id?: string | null;
  custom_fields?: Record<string, string>;
}

export interface UpdateParticipantInput extends Partial<CreateParticipantInput> {
  id: string;
}

export interface CreateTripInput {
  title: string;
  description?: string | null;
  declaration_deadline?: string | null;
  location?: string | null;
  departure_datetime: string;
  departure_location: string;
  departure_stop2_datetime?: string | null;
  departure_stop2_location?: string | null;
  return_datetime: string;
  return_location: string;
  return_stop2_datetime?: string | null;
  return_stop2_location?: string | null;
  bank_account_pln?: string;
  bank_account_eur?: string;
  status: TripStatus;
  group_ids: string[];
  payment_templates: CreatePaymentTemplateInput[];
}

export interface CreatePaymentTemplateInput {
  payment_type: PaymentType;
  installment_number?: number | null;
  is_first_installment?: boolean;
  includes_season_pass?: boolean;
  category_name?: string | null;
  birth_year_from?: number | null;
  birth_year_to?: number | null;
  amount: number;
  currency: Currency;
  due_date?: string | null;
  payment_method?: PaymentMethod | null;
}

export interface AddPaymentTransactionInput {
  payment_id: string;
  amount: number;
  currency: Currency;
  transaction_date: string;
  payment_method: 'cash' | 'transfer';
  notes?: string | null;
}

export interface UpdateProfileInput {
  first_name?: string | null;
  last_name?: string | null;
  phone?: string;
  secondary_email?: string | null;
  secondary_phone?: string | null;
  address_street?: string | null;
  address_zip?: string | null;
  address_city?: string | null;
  pesel?: string | null;
}

export interface CreateNotificationInput {
  notification_type: NotificationType;
  target_type: NotificationTargetType;
  target_group_id?: string | null;
  target_trip_id?: string | null;
  target_user_id?: string | null;
  subject: string;
  body: string;
  channel: NotificationChannel;
}
