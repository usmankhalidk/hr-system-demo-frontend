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
  uniqueId?: string | null;
}

export interface Company {
  id: number;
  name: string;
  slug?: string;
  isActive: boolean;
  logoFilename?: string | null;
  bannerFilename?: string | null;
  groupId?: number | null;
  groupName?: string | null;
  ownerUserId?: number | null;
  ownerName?: string | null;
  ownerSurname?: string | null;
  ownerAvatarFilename?: string | null;
  registrationNumber?: string | null;
  companyEmail?: string | null;
  companyPhoneNumbers?: string | null;
  officesLocations?: string | null;
  country?: string | null;
  city?: string | null;
  state?: string | null;
  address?: string | null;
  timezones?: string | null;
  currency?: string | null;
  storeCount: number;
  employeeCount: number;
  createdAt: string;
}

export interface Store {
  id: number;
  companyId: number;
  companyName?: string;   // populated when super admin fetches across companies
  groupName?: string | null;
  companyLogoFilename?: string | null;
  logoFilename?: string | null;
  name: string;
  code: string;
  address: string | null;
  cap: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  phone?: string | null;
  timezone?: string | null;
  maxStaff: number | null;
  isActive: boolean;
  employeeCount?: number;
  createdAt: string;
}

export interface StoreOperatingHour {
  id?: number;
  storeId?: number;
  dayOfWeek: number;
  openTime: string | null;
  closeTime: string | null;
  peakStartTime?: string | null;
  peakEndTime?: string | null;
  plannedShiftCount?: number | null;
  plannedStaffCount?: number | null;
  shiftPlanNotes?: string | null;
  isClosed: boolean;
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
  isSuperAdmin?: boolean;
  firstAidFlag: boolean;
  maritalStatus: string | null;
  storeName?: string;
  supervisorName?: string;
  companyName?: string;
  companyGroupName?: string | null;
  // Sensitive — only returned for admin/hr or self
  personalEmail?: string | null;
  dateOfBirth?: string | null;
  nationality?: string | null;
  gender?: string | null;
  iban?: string | null;
  phone?: string | null;
  country?: string | null;
  state?: string | null;
  city?: string | null;
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
  isSuperAdmin?: boolean;
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
  logoFilename?: string | null;
  employees: EmployeeAssociationEntry[];
}

export interface EmployeeAssociationCompany {
  id: number;
  name: string;
  slug: string;
  isActive: boolean;
  logoFilename?: string | null;
  groupName?: string | null;
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
  companyName?: string | null;
  senderId: number;
  recipientId: number;
  subject: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  senderName?: string;
  senderRole?: UserRole;
  senderAvatarFilename?: string | null;
  recipientName?: string;
  recipientRole?: UserRole;
  recipientAvatarFilename?: string | null;
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
