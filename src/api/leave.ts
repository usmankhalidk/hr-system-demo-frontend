import apiClient from './client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LeaveType = 'vacation' | 'sick';

export type LeaveStatus =
  | 'pending'
  | 'supervisor_approved'
  | 'area_manager_approved'
  | 'hr_approved'
  | 'rejected';

export interface LeaveRequest {
  id: number;
  companyId: number;
  userId: number;
  storeId: number | null;
  leaveType: LeaveType;
  startDate: string;       // ISO date YYYY-MM-DD
  endDate: string;         // ISO date YYYY-MM-DD
  status: LeaveStatus;
  currentApproverRole: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  userName?: string;
  userSurname?: string;
}

export interface LeaveBalance {
  id: number;
  companyId: number;
  userId: number;
  year: number;
  leaveType: LeaveType;
  totalDays: number;
  usedDays: number;
  remainingDays: number;
  updatedAt: string;
}

export interface SubmitLeavePayload {
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  notes?: string;
}

export interface LeaveListParams {
  userId?: number;
  status?: LeaveStatus;
  leaveType?: LeaveType;
  dateFrom?: string;
  dateTo?: string;
}

export interface LeaveListResponse {
  requests: LeaveRequest[];
  total: number;
}

export interface BalanceResponse {
  balances: LeaveBalance[];
  year: number;
  userId: number;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/** Submit a new leave request. */
export async function submitLeaveRequest(payload: SubmitLeavePayload): Promise<LeaveRequest> {
  const { data } = await apiClient.post('/leave', payload);
  return data.data as LeaveRequest;
}

/** List leave requests (scope determined server-side by role). */
export async function getLeaveRequests(params?: LeaveListParams): Promise<LeaveListResponse> {
  const { data } = await apiClient.get('/leave', { params });
  return data.data as LeaveListResponse;
}

/** Get the pending approval queue for the current user's role. */
export async function getPendingLeaveApprovals(): Promise<LeaveListResponse> {
  const { data } = await apiClient.get('/leave/pending');
  return data.data as LeaveListResponse;
}

/** Approve a leave request. */
export async function approveLeaveRequest(id: number, notes?: string): Promise<LeaveRequest> {
  const { data } = await apiClient.put(`/leave/${id}/approve`, { notes });
  return data.data as LeaveRequest;
}

/** Reject a leave request (notes are mandatory). */
export async function rejectLeaveRequest(id: number, notes: string): Promise<LeaveRequest> {
  const { data } = await apiClient.put(`/leave/${id}/reject`, { notes });
  return data.data as LeaveRequest;
}

/** Get leave balances for a user. */
export async function getLeaveBalance(params?: { userId?: number; year?: number }): Promise<BalanceResponse> {
  const { data } = await apiClient.get('/leave/balance', { params });
  return data.data as BalanceResponse;
}
