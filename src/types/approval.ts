export type UserRole = 'REQUESTER' | 'UNIT_REVIEWER' | 'COMMAND_APPROVER';

export type RequestStatus =
  | 'PENDING_REVIEW'
  | 'VERIFIED'
  | 'APPROVED'
  | 'REJECTED';

export type PriorityLevel = 'ROUTINE' | 'PRIORITY' | 'CRITICAL';

export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';

export interface ApprovalAuditLog {
  id: string;
  actorRole: UserRole;
  actorName: string;
  action: string;
  remarks: string;
  timestamp: string;
}

export interface PersonnelRequest {
  id: string;
  referenceCode: string;
  title: string;
  department: 'Logistics' | 'Operations' | 'Engineering' | 'Communications';
  submittedBy: string;
  submittedDate: string;
  priority: PriorityLevel;
  status: RequestStatus;
  justification: string;
  auditTrail: ApprovalAuditLog[];
}

export interface ApprovalPayload {
  requestId: string;
  decision: 'VERIFY' | 'APPROVE' | 'REJECT';
  remarks: string;
  actorRole: UserRole;
}

export interface CreateRequestPayload {
  title: string;
  department: PersonnelRequest['department'];
  priority: PriorityLevel;
  justification: string;
  submittedBy?: string;
}

export interface BatchApprovalPayload {
  requestIds: string[];
  decision: 'VERIFY' | 'APPROVE' | 'REJECT';
  remarks: string;
  actorRole: UserRole;
}

export type ToastVariant = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
}

export type SortField = 'submittedDate' | 'priority' | 'status';
export type SortDirection = 'asc' | 'desc';