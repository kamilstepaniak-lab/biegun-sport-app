import type { CreatePaymentTemplateInput, TripStatus, AttendanceType, TripCategory } from '@/types';

export interface TripFormData {
  title: string;
  description: string;
  declaration_deadline: string;
  location: string;
  status: TripStatus;
  attendance_type: AttendanceType;
  category: TripCategory;
  departure_datetime: string;
  departure_time_known: boolean;
  departure_location: string;
  departure_stop2_datetime: string;
  departure_stop2_location: string;
  return_datetime: string;
  return_time_known: boolean;
  return_location: string;
  return_stop2_datetime: string;
  return_stop2_location: string;
  group_ids: string[];
  payment_templates: CreatePaymentTemplateInput[];
  allow_own_transport: boolean;
  packing_list: string;
  additional_info: string;
}

export const emptyPayment: CreatePaymentTemplateInput = {
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
  due_days_from_confirmation: null,
  payment_method: 'transfer',
};

// Predefiniowane przystanki
export const PREDEFINED_STOPS = [
  'BP Pasternik',
  'Orlen Opatkowice',
  'BP Opatkowice',
  'Ikea',
];

export interface SectionProps {
  formData: TripFormData;
  updateFormData: (data: Partial<TripFormData>) => void;
}
