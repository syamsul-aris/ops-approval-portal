import type {
  ApprovalPayload,
  BatchApprovalPayload,
  CreateRequestPayload,
  PersonnelRequest,
} from '../types/approval';
import { sanitizeTextInput } from '../utils/sanitize';

export class ApiError extends Error {
  readonly statusCode: 401 | 404 | 422 | 503;

  constructor(statusCode: 401 | 404 | 422 | 503, message: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
  }
}

const INITIAL_REQUESTS: PersonnelRequest[] = [
  {
    id: 'req-101',
    referenceCode: 'OPS-2026-0841',
    title: 'Field Deployment Clearance — Team Bravo',
    department: 'Operations',
    submittedBy: 'Lt. Amirul Hakim',
    submittedDate: '2026-11-22',
    priority: 'CRITICAL',
    status: 'PENDING_REVIEW',
    justification:
      'Scheduled maritime communications exercise requiring 14-day coastal deployment.',
    auditTrail: [
      {
        id: 'log-1',
        actorRole: 'REQUESTER',
        actorName: 'Lt. Amirul Hakim',
        action: 'SUBMITTED',
        remarks: 'Initial clearance packet submitted with roster.',
        timestamp: '2026-11-22 08:30',
      },
    ],
  },
  {
    id: 'req-102',
    referenceCode: 'LOG-2026-0839',
    title: 'Specialized Telemetry Hardware Requisition',
    department: 'Engineering',
    submittedBy: 'Eng. Farah Nabila',
    submittedDate: '2026-11-21',
    priority: 'PRIORITY',
    status: 'VERIFIED',
    justification: 'Replacement diagnostic modules for Sector 4 relay station.',
    auditTrail: [
      {
        id: 'log-2',
        actorRole: 'REQUESTER',
        actorName: 'Eng. Farah Nabila',
        action: 'SUBMITTED',
        remarks: 'Specs attached per maintenance schedule.',
        timestamp: '2026-11-21 10:15',
      },
      {
        id: 'log-3',
        actorRole: 'UNIT_REVIEWER',
        actorName: 'Capt. Daniel Lim',
        action: 'VERIFIED',
        remarks: 'Technical specifications and budget code verified.',
        timestamp: '2026-11-21 15:40',
      },
    ],
  },
  {
    id: 'req-103',
    referenceCode: 'COM-2026-0834',
    title: 'Encrypted Frequency Allocation Renewal',
    department: 'Communications',
    submittedBy: 'Sgt. Hafiz Zulkifli',
    submittedDate: '2026-11-19',
    priority: 'ROUTINE',
    status: 'APPROVED',
    justification: 'Annual renewal of tactical channel block C-12.',
    auditTrail: [],
  },
  {
    id: 'req-104',
    referenceCode: 'LOG-2026-0828',
    title: 'Port Supply Vessel Overtime Authorization',
    department: 'Logistics',
    submittedBy: 'Kpl. Siti Aishah',
    submittedDate: '2026-11-18',
    priority: 'ROUTINE',
    status: 'REJECTED',
    justification: 'Extended weekend dockside loading operations.',
    auditTrail: [],
  },
  {
    id: 'req-105',
    referenceCode: 'ENG-2026-0824',
    title: 'Backup Generator Load-Bank Certification',
    department: 'Engineering',
    submittedBy: 'Eng. Farah Nabila',
    submittedDate: '2026-11-17',
    priority: 'PRIORITY',
    status: 'PENDING_REVIEW',
    justification: 'Quarterly readiness inspection for primary command bunker power.',
    auditTrail: [
      {
        id: 'log-4',
        actorRole: 'REQUESTER',
        actorName: 'Eng. Farah Nabila',
        action: 'SUBMITTED',
        remarks: 'Vendor inspection schedule attached.',
        timestamp: '2026-11-17 09:05',
      },
    ],
  },
  {
    id: 'req-106',
    referenceCode: 'OPS-2026-0819',
    title: 'Night-Ops Perimeter Sensor Calibration',
    department: 'Operations',
    submittedBy: 'Lt. Amirul Hakim',
    submittedDate: '2026-11-15',
    priority: 'CRITICAL',
    status: 'VERIFIED',
    justification:
      'Thermal array recalibration ahead of northern sector readiness drill.',
    auditTrail: [
      {
        id: 'log-5',
        actorRole: 'REQUESTER',
        actorName: 'Lt. Amirul Hakim',
        action: 'SUBMITTED',
        remarks: 'Calibration window requested for 0200-0400.',
        timestamp: '2026-11-15 11:20',
      },
      {
        id: 'log-6',
        actorRole: 'UNIT_REVIEWER',
        actorName: 'Capt. Daniel Lim',
        action: 'VERIFIED',
        remarks: 'Sector schedule deconflicted and verified.',
        timestamp: '2026-11-16 14:10',
      },
    ],
  },
];

let dbStore: PersonnelRequest[] = [...INITIAL_REQUESTS];
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
    await delay(500);
    if (shouldFailRefresh) {
      throw new ApiError(
        401,
        '401 Unauthorized: Refresh token invalid or expired. Re-authentication required.'
      );
    }
    tokenExpired = false;
  },

  /**
   * Interceptor-style wrapper: catches 401 Unauthorized, runs silent JWT refresh,
   * and retries the original operation once.
   */
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
    await delay(650);
    assertValidToken();
    if (simulateError) {
      throw new ApiError(503, '503 Service Unavailable: Upstream gateway timeout.');
    }
    return JSON.parse(JSON.stringify(dbStore));
  },

  async processApproval(
    payload: ApprovalPayload,
    simulateError = false
  ): Promise<PersonnelRequest> {
    await delay(750);
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
    const nextStatus =
      payload.decision === 'REJECT'
        ? 'REJECTED'
        : payload.decision === 'VERIFY'
        ? 'VERIFIED'
        : 'APPROVED';

    const actorNames: Record<string, string> = {
      REQUESTER: 'Lt. Amirul Hakim',
      UNIT_REVIEWER: 'Capt. Daniel Lim',
      COMMAND_APPROVER: 'Cmdr. Razak Ismail',
    };

    const updated: PersonnelRequest = {
      ...target,
      status: nextStatus,
      auditTrail: [
        ...target.auditTrail,
        {
          id: `log-${Date.now()}`,
          actorRole: payload.actorRole,
          actorName: actorNames[payload.actorRole],
          action: nextStatus,
          remarks: sanitizeTextInput(payload.remarks, 300),
          timestamp: new Date().toISOString().slice(0, 16).replace('T', ' '),
        },
      ],
    };

    dbStore[index] = updated;
    return JSON.parse(JSON.stringify(updated));
  },

  async createRequest(
    payload: CreateRequestPayload,
    simulateError = false
  ): Promise<PersonnelRequest> {
    await delay(550);
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
      priority: payload.priority,
      status: 'PENDING_REVIEW',
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
    await delay(750);
    assertValidToken();
    if (simulateError) {
      throw new ApiError(
        422,
        '422 Unprocessable Entity: Batch authorization token rejected.'
      );
    }

    const nextStatus =
      payload.decision === 'REJECT'
        ? 'REJECTED'
        : payload.decision === 'VERIFY'
        ? 'VERIFIED'
        : 'APPROVED';

    const actorNames: Record<string, string> = {
      REQUESTER: 'Lt. Amirul Hakim',
      UNIT_REVIEWER: 'Capt. Daniel Lim',
      COMMAND_APPROVER: 'Cmdr. Razak Ismail',
    };
    const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const cleanRemarks = sanitizeTextInput(payload.remarks, 300);

    const updatedItems: PersonnelRequest[] = [];
    dbStore = dbStore.map((item) => {
      if (!payload.requestIds.includes(item.id)) return item;
      const updated: PersonnelRequest = {
        ...item,
        status: nextStatus,
        auditTrail: [
          ...item.auditTrail,
          {
            id: `log-${Date.now()}-${item.id}`,
            actorRole: payload.actorRole,
            actorName: actorNames[payload.actorRole],
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
    dbStore = JSON.parse(JSON.stringify(INITIAL_REQUESTS));
    tokenExpired = false;
    shouldFailRefresh = false;
  },
};
