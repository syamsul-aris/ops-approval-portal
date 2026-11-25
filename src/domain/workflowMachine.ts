import type {
  PersonnelRequest,
  RequestStatus,
  UserRole,
  WorkflowDecision,
} from '../types/approval';

export const HIGH_BUDGET_THRESHOLD_MYR = 50000;

export class IllegalTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IllegalTransitionError';
  }
}

/**
 * Requests with CRITICAL priority or estimated budget > RM 50,000 require
 * a mandatory 3-tier approval including Security Officer clearance.
 */
export function requiresSecurityClearance(
  request: Pick<PersonnelRequest, 'priority' | 'estimatedBudgetMyr'>
): boolean {
  return (
    request.priority === 'CRITICAL' ||
    request.estimatedBudgetMyr > HIGH_BUDGET_THRESHOLD_MYR
  );
}

export function isTerminalStatus(status: RequestStatus): boolean {
  return status === 'COMMAND_APPROVED' || status === 'REJECTED';
}

export function getAllowedDecisions(
  request: Pick<PersonnelRequest, 'status' | 'priority' | 'estimatedBudgetMyr'>,
  role: UserRole
): WorkflowDecision[] {
  if (role === 'REQUESTER' || isTerminalStatus(request.status)) {
    return [];
  }

  const threeTier = requiresSecurityClearance(request);

  if (role === 'UNIT_REVIEWER' && request.status === 'PENDING_REVIEW') {
    return ['VERIFY', 'REJECT'];
  }

  if (
    role === 'SECURITY_OFFICER' &&
    threeTier &&
    request.status === 'UNIT_VERIFIED'
  ) {
    return ['CLEAR_SECURITY', 'REJECT'];
  }

  if (role === 'COMMAND_APPROVER') {
    if (threeTier && request.status === 'SECURITY_CLEARED') {
      return ['APPROVE', 'REJECT'];
    }
    if (!threeTier && request.status === 'UNIT_VERIFIED') {
      return ['APPROVE', 'REJECT'];
    }
    // Command Approver may reject any active non-terminal request
    return ['REJECT'];
  }

  return [];
}

export function canRoleActOnRequest(
  request: Pick<PersonnelRequest, 'status' | 'priority' | 'estimatedBudgetMyr'>,
  role: UserRole
): boolean {
  return getAllowedDecisions(request, role).length > 0;
}

export function transitionRequestStatus(
  request: Pick<PersonnelRequest, 'status' | 'priority' | 'estimatedBudgetMyr'>,
  decision: WorkflowDecision,
  role: UserRole
): RequestStatus {
  const allowed = getAllowedDecisions(request, role);
  if (!allowed.includes(decision)) {
    throw new IllegalTransitionError(
      `Illegal workflow transition: role "${role}" cannot execute "${decision}" from status "${request.status}".`
    );
  }

  switch (decision) {
    case 'VERIFY':
      return 'UNIT_VERIFIED';
    case 'CLEAR_SECURITY':
      return 'SECURITY_CLEARED';
    case 'APPROVE':
      return 'COMMAND_APPROVED';
    case 'REJECT':
      return 'REJECTED';
  }
}

export interface WorkflowGate {
  key: string;
  label: string;
  required: boolean;
  state: 'completed' | 'current' | 'upcoming' | 'rejected';
}

export function getWorkflowGates(
  request: Pick<PersonnelRequest, 'status' | 'priority' | 'estimatedBudgetMyr'>
): WorkflowGate[] {
  const threeTier = requiresSecurityClearance(request);
  const { status } = request;

  const gates: WorkflowGate[] = [
    {
      key: 'SUBMITTED',
      label: 'Submitted',
      required: true,
      state: 'completed',
    },
    {
      key: 'UNIT_VERIFIED',
      label: 'Unit Verified',
      required: true,
      state:
        status === 'PENDING_REVIEW'
          ? 'current'
          : status === 'REJECTED'
          ? 'rejected'
          : 'completed',
    },
  ];

  if (threeTier) {
    gates.push({
      key: 'SECURITY_CLEARED',
      label: 'Security Cleared',
      required: true,
      state:
        status === 'UNIT_VERIFIED'
          ? 'current'
          : status === 'SECURITY_CLEARED' || status === 'COMMAND_APPROVED'
          ? 'completed'
          : status === 'REJECTED'
          ? 'rejected'
          : 'upcoming',
    });
  }

  const readyForCommand = threeTier
    ? status === 'SECURITY_CLEARED'
    : status === 'UNIT_VERIFIED';

  gates.push({
    key: 'COMMAND_APPROVED',
    label: status === 'REJECTED' ? 'Rejected' : 'Command Approved',
    required: true,
    state:
      status === 'COMMAND_APPROVED'
        ? 'completed'
        : status === 'REJECTED'
        ? 'rejected'
        : readyForCommand
        ? 'current'
        : 'upcoming',
  });

  return gates;
}
