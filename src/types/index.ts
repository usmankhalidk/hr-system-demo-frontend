export type UserRole = 'admin' | 'hr' | 'area_manager' | 'store_manager' | 'employee' | 'store_terminal';

export interface User {
  id: number;
  companyId: number | null;
  storeId: number | null;
  supervisorId: number | null;
  name: string;
  surname: string | null;
  email: string;
  role: UserRole;
  status: 'active' | 'inactive';
  isSuperAdmin: boolean;
  avatarFilename?: string | null;

  // Device binding (employee self-service only)
  isDeviceRegistered?: boolean;
  deviceResetPending?: boolean;
  requiresDeviceRegistration?: boolean;
}

export interface Company {
  id: number;
  name: string;
  slug?: string;
  isActive: boolean;
  logoFilename?: string | null;
  groupId?: number | null;
  storeCount: number;
  employeeCount: number;
  createdAt: string;
}

export interface Store {
  id: number;
  companyId: number;
  companyName?: string;   // populated when super admin fetches across companies
  companyLogoFilename?: string | null;
  name: string;
  code: string;
  address: string | null;
  cap: string | null;
  maxStaff: number | null;
  isActive: boolean;
  employeeCount?: number;
  createdAt: string;
}

export interface Employee {
  id: number;
  companyId: number;
  storeId: number | null;
  supervisorId: number | null;
  name: string;
  surname: string;
  email: string;
  role: UserRole;
  uniqueId: string | null;
  department: string | null;
  hireDate: string | null;
  contractEndDate: string | null;
  terminationDate: string | null;
  workingType: 'full_time' | 'part_time' | null;
  weeklyHours: number | null;
  status: 'active' | 'inactive';
  firstAidFlag: boolean;
  maritalStatus: string | null;
  storeName?: string;
  supervisorName?: string;
  companyName?: string;
  // Sensitive — only returned for admin/hr or self
  personalEmail?: string | null;
  dateOfBirth?: string | null;
  nationality?: string | null;
  gender?: string | null;
  iban?: string | null;
  address?: string | null;
  cap?: string | null;
  contractType?: string | null;
  probationMonths?: number | null;
  terminationType?: string | null;
  avatarFilename?: string | null;

  // Device binding (HR/admin view)
  deviceResetPending?: boolean;
  deviceRegistered?: boolean;
  deviceRegisteredAt?: string | null;
}

export interface EmployeeAssociationEntry {
  id: number;
  name: string;
  surname: string;
  email: string;
  role: UserRole;
  status: 'active' | 'inactive';
  companyId: number;
  companyName: string;
  storeId: number | null;
  storeName: string | null;
  supervisorId: number | null;
  avatarFilename: string | null;
}

export interface EmployeeAssociationStore {
  id: number;
  name: string;
  code: string;
  isActive: boolean;
  employees: EmployeeAssociationEntry[];
}

export interface EmployeeAssociationCompany {
  id: number;
  name: string;
  slug: string;
  isActive: boolean;
  stores: EmployeeAssociationStore[];
  unassignedEmployees: EmployeeAssociationEntry[];
  employeeCount: number;
}

export interface EmployeeAssociationsResponse {
  subject: {
    id: number;
    role: UserRole;
    companyId: number;
    companyName: string | null;
    storeId: number | null;
    storeName: string | null;
    supervisorId: number | null;
    name: string;
    surname: string;
    email: string;
    status: 'active' | 'inactive';
    avatarFilename: string | null;
  };
  scope: 'company' | 'company_group' | 'managed' | 'store' | 'self' | 'none';
  summary: {
    companyCount: number;
    storeCount: number;
    employeeCount: number;
  };
  companies: EmployeeAssociationCompany[];
}

export type TrainingType = 'product' | 'general' | 'low_risk_safety' | 'fire_safety';

export interface Training {
  id: number;
  userId: number;
  companyId: number;
  trainingType: TrainingType;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
  createdAt: string;
}

export interface MedicalCheck {
  id: number;
  userId: number;
  companyId: number;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
  createdAt: string;
}

export interface Message {
  id: number;
  companyId: number;
  senderId: number;
  recipientId: number;
  subject: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  senderName?: string;
  senderRole?: UserRole;
  recipientName?: string;
  recipientRole?: UserRole;
  direction?: 'received' | 'sent';
}

export interface PermissionGrid {
  grid: Record<string, Record<string, boolean>>;
  moduleMeta: Record<string, { active: boolean }>;
}

export type PermissionMap = Record<string, boolean>;

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ApiError {
  success: false;
  error: string;
  code: string;
}

export interface EmployeeListResponse {
  employees: Employee[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}
