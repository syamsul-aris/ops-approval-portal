export type UserRole =
  | 'REQUESTER'
  | 'UNIT_REVIEWER'
  | 'SECURITY_OFFICER'
  | 'COMMAND_APPROVER';

export type RequestStatus =
  | 'PENDING_REVIEW'
  | 'UNIT_VERIFIED'
  | 'SECURITY_CLEARED'
  | 'COMMAND_APPROVED'
  | 'REJECTED';

export type PriorityLevel = 'ROUTINE' | 'PRIORITY' | 'CRITICAL';

export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';

export type WorkflowDecision =
  | 'VERIFY'
  | 'CLEAR_SECURITY'
  | 'APPROVE'
  | 'REJECT';

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
  createdAtIso: string;
  resolvedAtIso?: string;
  priority: PriorityLevel;
  estimatedBudgetMyr: number;
  status: RequestStatus;
  version: number;
  justification: string;
  auditTrail: ApprovalAuditLog[];
}

export interface ApprovalPayload {
  requestId: string;
  decision: WorkflowDecision;
  remarks: string;
  actorRole: UserRole;
  expectedVersion: number;
  forceOverride?: boolean;
}

export interface CreateRequestPayload {
  title: string;
  department: PersonnelRequest['department'];
  priority: PriorityLevel;
  estimatedBudgetMyr: number;
  justification: string;
  submittedBy?: string;
}

export interface BatchApprovalPayload {
  requestIds: string[];
  decision: WorkflowDecision;
  remarks: string;
  actorRole: UserRole;
}

export type ToastVariant = 'success' | 'error' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastMessage {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
  action?: ToastAction;
}

export type SortField = 'submittedDate' | 'priority' | 'status';
export type SortDirection = 'asc' | 'desc';

export interface FilterPreset {
  id: string;
  name: string;
  searchQuery: string;
  statusFilter: RequestStatus | 'ALL';
  departmentFilter: string;
  slaBreachedOnly?: boolean;
  isDefault?: boolean;
}

export interface ActivityEvent {
  id: string;
  type: 'TRANSITION' | 'ROLE_SWITCH' | 'API_RETRY' | 'UNDO' | 'CREATE';
  summary: string;
  detail?: string;
  timestamp: string;
}


export interface FilterPreset {
  id: string;
  name: string;
  searchQuery: string;
  statusFilter: RequestStatus | 'ALL';
  departmentFilter: string;
  slaBreachedOnly?: boolean;
  isDefault?: boolean;
}

export interface ActivityEvent {
  id: string;
  type: 'TRANSITION' | 'ROLE_SWITCH' | 'API_RETRY' | 'UNDO' | 'CREATE';
  summary: string;
  detail?: string;
  timestamp: string;
}