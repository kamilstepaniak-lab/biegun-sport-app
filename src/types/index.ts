export * from './database';

// Dodatkowe typy pomocnicze

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface FilterParams {
  search?: string;
  status?: string;
  groupId?: string;
  tripId?: string;
  currency?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaymentFilterParams extends FilterParams {
  paymentStatus?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
}

export interface ParticipantFilterParams extends FilterParams {
  parentId?: string;
  birthYearFrom?: number;
  birthYearTo?: number;
}

// Typy dla UI

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface NavItem {
  title: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: string | number;
  children?: NavItem[];
}

export interface TableColumn<T> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  render?: (value: unknown, row: T) => React.ReactNode;
  className?: string;
}

// Typy dla statystyk dashboardu

export interface ParentDashboardStats {
  childrenCount: number;
  upcomingTrips: number;
  pendingPayments: number;
  overduePayments: number;
  totalOwed: {
    PLN: number;
    EUR: number;
  };
}

export interface AdminDashboardStats {
  totalParticipants: number;
  totalParents: number;
  activeTrips: number;
  upcomingTrips: number;
  pendingPayments: number;
  overduePayments: number;
  totalCollected: {
    PLN: number;
    EUR: number;
  };
  totalOutstanding: {
    PLN: number;
    EUR: number;
  };
}

// Typy dla eksportu

export interface ExportParticipant {
  lp: number;
  lastName: string;
  firstName: string;
  birthDate: string;
  age: number;
  groupName: string;
  isOutsideGroup: boolean;
  phone: string;
  paymentStatus: string;
  amountOwed?: number;
  currency?: string;
}

export interface ExportTripSummary {
  title: string;
  departureDateTime: string;
  departureLocation: string;
  returnDateTime: string;
  returnLocation: string;
  totalRegistered: number;
  fullyPaid: number;
  withArrears: number;
  arrearsPLN: number;
  arrearsEUR: number;
}
