import type {
  ApprovalPayload,
  BatchApprovalPayload,
  CreateRequestPayload,
  PersonnelRequest,
  UserRole,
} from '../types/approval';
import { sanitizeTextInput } from '../utils/sanitize';
import {
  isTerminalStatus,
  transitionRequestStatus,
} from '../domain/workflowMachine';

export class ApiError extends Error {
  readonly statusCode: 401 | 404 | 409 | 422 | 503;
  readonly latestRequest?: PersonnelRequest;

  constructor(
    statusCode: 401 | 404 | 409 | 422 | 503,
    message: string,
    latestRequest?: PersonnelRequest
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.latestRequest = latestRequest;
  }
}

const ACTOR_NAMES: Record<UserRole, string> = {
  REQUESTER: 'Lt. Amirul Hakim',
  UNIT_REVIEWER: 'Capt. Daniel Lim',
  SECURITY_OFFICER: 'Maj. Nurul Huda',
  COMMAND_APPROVER: 'Cmdr. Razak Ismail',
};

function hoursAgoIso(hours: number): string {
  return new Date(Date.now() - hours * 3600 * 1000).toISOString();
}

function buildInitialRequests(): PersonnelRequest[] {
  return [
    {
      id: 'req-101',
      referenceCode: 'OPS-2026-0841',
      title: 'Field Deployment Clearance — Team Bravo',
      department: 'Operations',
      submittedBy: 'Lt. Amirul Hakim',
      submittedDate: '2026-11-25',
      createdAtIso: hoursAgoIso(3.5), // 4h SLA -> 30m left (WARNING <25%)
      priority: 'CRITICAL',
      estimatedBudgetMyr: 85000,
      status: 'PENDING_REVIEW',
      version: 1,
      justification:
        'Scheduled maritime communications exercise requiring 14-day coastal deployment.',
      auditTrail: [
        {
          id: 'log-1',
          actorRole: 'REQUESTER',
          actorName: 'Lt. Amirul Hakim',
          action: 'SUBMITTED',
          remarks: 'Initial clearance packet submitted with roster.',
          timestamp: '2026-11-25 07:15',
        },
      ],
    },
    {
      id: 'req-102',
      referenceCode: 'LOG-2026-0839',
      title: 'Specialized Telemetry Hardware Requisition',
      department: 'Engineering',
      submittedBy: 'Eng. Farah Nabila',
      submittedDate: '2026-11-24',
      createdAtIso: hoursAgoIso(26), // 24h PRIORITY SLA -> breached by 2h
      priority: 'PRIORITY',
      estimatedBudgetMyr: 64000, // > RM 50,000 -> requires Security Officer!
      status: 'UNIT_VERIFIED',
      version: 2,
      justification: 'Replacement diagnostic modules for Sector 4 relay station.',
      auditTrail: [
        {
          id: 'log-2',
          actorRole: 'REQUESTER',
          actorName: 'Eng. Farah Nabila',
          action: 'SUBMITTED',
          remarks: 'Specs attached per maintenance schedule.',
          timestamp: '2026-11-24 08:15',
        },
        {
          id: 'log-3',
          actorRole: 'UNIT_REVIEWER',
          actorName: 'Capt. Daniel Lim',
          action: 'UNIT_VERIFIED',
          remarks: 'Technical specifications and budget code verified.',
          timestamp: '2026-11-24 13:40',
        },
      ],
    },
    {
      id: 'req-103',
      referenceCode: 'COM-2026-0834',
      title: 'Encrypted Frequency Allocation Renewal',
      department: 'Communications',
      submittedBy: 'Sgt. Hafiz Zulkifli',
      submittedDate: '2026-11-22',
      createdAtIso: hoursAgoIso(40),
      resolvedAtIso: hoursAgoIso(28), // 12h turnaround
      priority: 'ROUTINE',
      estimatedBudgetMyr: 18500,
      status: 'COMMAND_APPROVED',
      version: 3,
      justification: 'Annual renewal of tactical channel block C-12.',
      auditTrail: [],
    },
    {
      id: 'req-104',
      referenceCode: 'LOG-2026-0828',
      title: 'Port Supply Vessel Overtime Authorization',
      department: 'Logistics',
      submittedBy: 'Kpl. Siti Aishah',
      submittedDate: '2026-11-21',
      createdAtIso: hoursAgoIso(52),
      resolvedAtIso: hoursAgoIso(36), // 16h turnaround
      priority: 'ROUTINE',
      estimatedBudgetMyr: 12000,
      status: 'REJECTED',
      version: 2,
      justification: 'Extended weekend dockside loading operations.',
      auditTrail: [],
    },
    {
      id: 'req-105',
      referenceCode: 'ENG-2026-0824',
      title: 'Backup Generator Load-Bank Certification',
      department: 'Engineering',
      submittedBy: 'Eng. Farah Nabila',
      submittedDate: '2026-11-24',
      createdAtIso: hoursAgoIso(6), // 24h SLA -> 18h left (ON_TRACK)
      priority: 'PRIORITY',
      estimatedBudgetMyr: 32000,
      status: 'PENDING_REVIEW',
      version: 1,
      justification: 'Quarterly readiness inspection for primary command bunker power.',
      auditTrail: [
        {
          id: 'log-4',
          actorRole: 'REQUESTER',
          actorName: 'Eng. Farah Nabila',
          action: 'SUBMITTED',
          remarks: 'Vendor inspection schedule attached.',
          timestamp: '2026-11-25 04:45',
        },
      ],
    },
    {
      id: 'req-106',
      referenceCode: 'OPS-2026-0819',
      title: 'Night-Ops Perimeter Sensor Calibration',
      department: 'Operations',
      submittedBy: 'Lt. Amirul Hakim',
      submittedDate: '2026-11-25',
      createdAtIso: hoursAgoIso(4.6), // 4h CRITICAL SLA -> breached
      priority: 'CRITICAL',
      estimatedBudgetMyr: 42000,
      status: 'SECURITY_CLEARED',
      version: 3,
      justification:
        'Thermal array recalibration ahead of northern sector readiness drill.',
      auditTrail: [
        {
          id: 'log-5',
          actorRole: 'REQUESTER',
          actorName: 'Lt. Amirul Hakim',
          action: 'SUBMITTED',
          remarks: 'Calibration window requested for 0200-0400.',
          timestamp: '2026-11-25 06:10',
        },
        {
          id: 'log-6',
          actorRole: 'UNIT_REVIEWER',
          actorName: 'Capt. Daniel Lim',
          action: 'UNIT_VERIFIED',
          remarks: 'Sector schedule deconflicted and verified.',
          timestamp: '2026-11-25 07:30',
        },
        {
          id: 'log-7',
          actorRole: 'SECURITY_OFFICER',
          actorName: 'Maj. Nurul Huda',
          action: 'SECURITY_CLEARED',
          remarks: 'Thermal array encryption & perimeter clearance granted.',
          timestamp: '2026-11-25 08:50',
        },
      ],
    },
  ];
}

let dbStore: PersonnelRequest[] = buildInitialRequests();
let tokenExpired = false;
let shouldFailRefresh = false;

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

function assertValidToken() {
  if (tokenExpired) {
    throw new ApiError(401, '401 Unauthorized: JWT access token expired.');
  }
}

export const mockApprovalApi = {
  armTokenExpiry(failRefresh = false) {
    tokenExpired = true;
    shouldFailRefresh = failRefresh;
  },

  clearSessionExpiry() {
    tokenExpired = false;
    shouldFailRefresh = false;
  },

  async refreshSessionToken(): Promise<void> {
    await delay(450);
    if (shouldFailRefresh) {
      throw new ApiError(
        401,
        '401 Unauthorized: Refresh token invalid or expired. Re-authentication required.'
      );
    }
    tokenExpired = false;
  },

  async withTokenRefresh<T>(
    operation: () => Promise<T>,
    onRefreshing?: (refreshing: boolean) => void
  ): Promise<T> {
    try {
      return await operation();
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 401) {
        onRefreshing?.(true);
        try {
          await mockApprovalApi.refreshSessionToken();
        } finally {
          onRefreshing?.(false);
        }
        return await operation();
      }
      throw err;
    }
  },

  async fetchRequests(simulateError = false): Promise<PersonnelRequest[]> {
    await delay(500);
    assertValidToken();
    if (simulateError) {
      throw new ApiError(503, '503 Service Unavailable: Upstream gateway timeout.');
    }
    return JSON.parse(JSON.stringify(dbStore));
  },

  /**
   * Simulates a concurrent background edit by another user while a drawer is open,
   * incrementing the record's version so the next submit triggers a 409 Conflict.
   */
  simulateConcurrentEdit(requestId: string): PersonnelRequest | null {
    const index = dbStore.findIndex((item) => item.id === requestId);
    if (index === -1) return null;

    const target = dbStore[index];
    const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const updated: PersonnelRequest = {
      ...target,
      version: target.version + 1,
      estimatedBudgetMyr: target.estimatedBudgetMyr + 5000,
      auditTrail: [
        ...target.auditTrail,
        {
          id: `log-concurrent-${Date.now()}`,
          actorRole: 'UNIT_REVIEWER',
          actorName: 'Capt. Daniel Lim (Concurrent Session)',
          action: 'AMENDED',
          remarks: 'Concurrent budget adjustment (+RM 5,000) committed while drawer was open.',
          timestamp,
        },
      ],
    };
    dbStore[index] = updated;
    return JSON.parse(JSON.stringify(updated));
  },

  async processApproval(
    payload: ApprovalPayload,
    simulateError = false
  ): Promise<PersonnelRequest> {
    await delay(550);
    assertValidToken();
    if (simulateError) {
      throw new ApiError(
        422,
        '422 Unprocessable Entity: Session token validation failed.'
      );
    }

    const index = dbStore.findIndex((item) => item.id === payload.requestId);
    if (index === -1) throw new ApiError(404, 'Request record not found.');

    const target = dbStore[index];

    if (target.version !== payload.expectedVersion && !payload.forceOverride) {
      throw new ApiError(
        409,
        `409 Conflict: Record was modified concurrently (expected v${payload.expectedVersion}, server is at v${target.version}).`,
        JSON.parse(JSON.stringify(target))
      );
    }

    const nextStatus = transitionRequestStatus(
      target,
      payload.decision,
      payload.actorRole
    );
    const nowIso = new Date().toISOString();
    const timestamp = nowIso.slice(0, 16).replace('T', ' ');

    const updated: PersonnelRequest = {
      ...target,
      status: nextStatus,
      version: target.version + 1,
      resolvedAtIso: isTerminalStatus(nextStatus) ? nowIso : undefined,
      auditTrail: [
        ...target.auditTrail,
        {
          id: `log-${Date.now()}`,
          actorRole: payload.actorRole,
          actorName: ACTOR_NAMES[payload.actorRole],
          action: payload.forceOverride ? `${nextStatus} (OVERRIDE)` : nextStatus,
          remarks: sanitizeTextInput(payload.remarks, 300),
          timestamp,
        },
      ],
    };

    dbStore[index] = updated;
    return JSON.parse(JSON.stringify(updated));
  },

  async revertDecision(
    requestId: string,
    previousSnapshot: PersonnelRequest,
    actorRole: UserRole
  ): Promise<PersonnelRequest> {
    await delay(300);
    const index = dbStore.findIndex((item) => item.id === requestId);
    if (index === -1) throw new ApiError(404, 'Request record not found.');

    const current = dbStore[index];
    const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const reverted: PersonnelRequest = {
      ...current,
      status: previousSnapshot.status,
      resolvedAtIso: previousSnapshot.resolvedAtIso,
      version: current.version + 1,
      auditTrail: [
        ...current.auditTrail,
        {
          id: `log-undo-${Date.now()}`,
          actorRole,
          actorName: ACTOR_NAMES[actorRole],
          action: 'REVERTED',
          remarks: `Decision reverted to ${previousSnapshot.status} via 10s undo window.`,
          timestamp,
        },
      ],
    };

    dbStore[index] = reverted;
    return JSON.parse(JSON.stringify(reverted));
  },

  async createRequest(
    payload: CreateRequestPayload,
    simulateError = false
  ): Promise<PersonnelRequest> {
    await delay(450);
    assertValidToken();
    if (simulateError) {
      throw new ApiError(
        503,
        '503 Service Unavailable: Unable to persist new request.'
      );
    }

    const deptPrefix: Record<PersonnelRequest['department'], string> = {
      Operations: 'OPS',
      Engineering: 'ENG',
      Communications: 'COM',
      Logistics: 'LOG',
    };
    const seq = 850 + dbStore.length;
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timestamp = now.toISOString().slice(0, 16).replace('T', ' ');
    const submittedBy =
      sanitizeTextInput(payload.submittedBy ?? '', 80) || 'Lt. Amirul Hakim';

    const created: PersonnelRequest = {
      id: `req-${Date.now()}`,
      referenceCode: `${deptPrefix[payload.department]}-2026-0${seq}`,
      title: sanitizeTextInput(payload.title, 100),
      department: payload.department,
      submittedBy,
      submittedDate: dateStr,
      createdAtIso: now.toISOString(),
      priority: payload.priority,
      estimatedBudgetMyr: Math.max(0, Math.round(payload.estimatedBudgetMyr)),
      status: 'PENDING_REVIEW',
      version: 1,
      justification: sanitizeTextInput(payload.justification, 400),
      auditTrail: [
        {
          id: `log-${Date.now()}`,
          actorRole: 'REQUESTER',
          actorName: submittedBy,
          action: 'SUBMITTED',
          remarks: 'Initial request submitted via portal.',
          timestamp,
        },
      ],
    };

    dbStore = [created, ...dbStore];
    return JSON.parse(JSON.stringify(created));
  },

  async processBatchApproval(
    payload: BatchApprovalPayload,
    simulateError = false
  ): Promise<PersonnelRequest[]> {
    await delay(600);
    assertValidToken();
    if (simulateError) {
      throw new ApiError(
        422,
        '422 Unprocessable Entity: Batch authorization token rejected.'
      );
    }

    const nowIso = new Date().toISOString();
    const timestamp = nowIso.slice(0, 16).replace('T', ' ');
    const cleanRemarks = sanitizeTextInput(payload.remarks, 300);

    const updatedItems: PersonnelRequest[] = [];
    dbStore = dbStore.map((item) => {
      if (!payload.requestIds.includes(item.id)) return item;
      const nextStatus = transitionRequestStatus(
        item,
        payload.decision,
        payload.actorRole
      );
      const updated: PersonnelRequest = {
        ...item,
        status: nextStatus,
        version: item.version + 1,
        resolvedAtIso: isTerminalStatus(nextStatus) ? nowIso : undefined,
        auditTrail: [
          ...item.auditTrail,
          {
            id: `log-${Date.now()}-${item.id}`,
            actorRole: payload.actorRole,
            actorName: ACTOR_NAMES[payload.actorRole],
            action: nextStatus,
            remarks: cleanRemarks,
            timestamp,
          },
        ],
      };
      updatedItems.push(updated);
      return updated;
    });

    return JSON.parse(JSON.stringify(updatedItems));
  },

  resetDemoData() {
    dbStore = buildInitialRequests();
    tokenExpired = false;
    shouldFailRefresh = false;
  },
};
