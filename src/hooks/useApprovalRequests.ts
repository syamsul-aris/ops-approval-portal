import { useState, useEffect, useMemo, useCallback } from 'react';
import type {
  ActivityEvent,
  ApprovalPayload,
  AsyncStatus,
  BatchApprovalPayload,
  CreateRequestPayload,
  FilterPreset,
  PersonnelRequest,
  PriorityLevel,
  RequestStatus,
  SortDirection,
  SortField,
  UserRole,
} from '../types/approval';
import { ApiError, mockApprovalApi } from '../services/mockApprovalApi';
import { transitionRequestStatus } from '../domain/workflowMachine';
import { computeSlaSnapshot } from './useSlaTracker';

const PRESETS_STORAGE_KEY = 'ops-portal:filter-presets';

const DEFAULT_PRESETS: FilterPreset[] = [
  {
    id: 'preset-pending-criticals',
    name: 'My Pending Criticals',
    searchQuery: '',
    statusFilter: 'PENDING_REVIEW',
    departmentFilter: 'ALL',
    slaBreachedOnly: false,
    isDefault: true,
  },
  {
    id: 'preset-overdue-eng',
    name: 'Overdue Engineering',
    searchQuery: '',
    statusFilter: 'ALL',
    departmentFilter: 'Engineering',
    slaBreachedOnly: true,
    isDefault: true,
  },
];

const VALID_STATUSES: ReadonlySet<string> = new Set([
  'ALL',
  'PENDING_REVIEW',
  'UNIT_VERIFIED',
  'SECURITY_CLEARED',
  'COMMAND_APPROVED',
  'REJECTED',
]);

const PRIORITY_RANK: Record<PriorityLevel, number> = {
  CRITICAL: 3,
  PRIORITY: 2,
  ROUTINE: 1,
};

const STATUS_RANK: Record<RequestStatus, number> = {
  PENDING_REVIEW: 1,
  UNIT_VERIFIED: 2,
  SECURITY_CLEARED: 3,
  COMMAND_APPROVED: 4,
  REJECTED: 5,
};

function readInitialFiltersFromUrl() {
  if (typeof window === 'undefined') {
    return { q: '', status: 'ALL' as RequestStatus | 'ALL', dept: 'ALL', sla: false };
  }
  const params = new URLSearchParams(window.location.search);
  const q = params.get('q') ?? '';
  const rawStatus = params.get('status') ?? 'ALL';
  const status = (VALID_STATUSES.has(rawStatus) ? rawStatus : 'ALL') as
    | RequestStatus
    | 'ALL';
  const dept = params.get('dept') ?? 'ALL';
  const sla = params.get('sla') === 'breached';
  return { q, status, dept, sla };
}

function loadStoredPresets(): FilterPreset[] {
  if (typeof window === 'undefined') return DEFAULT_PRESETS;
  try {
    const raw = window.localStorage.getItem(PRESETS_STORAGE_KEY);
    if (!raw) return DEFAULT_PRESETS;
    const parsed = JSON.parse(raw) as FilterPreset[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_PRESETS;
  } catch {
    return DEFAULT_PRESETS;
  }
}

export interface UndoEntry {
  id: string;
  previousSnapshot: PersonnelRequest;
  actorRole: UserRole;
  expiresAt: number;
}

export function useApprovalRequests() {
  const initialFilters = useMemo(() => readInitialFiltersFromUrl(), []);

  const [requests, setRequests] = useState<PersonnelRequest[]>([]);
  const [fetchStatus, setFetchStatus] = useState<AsyncStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [simulateError, setSimulateError] = useState<boolean>(false);
  const [simulateConflict, setSimulateConflict] = useState<boolean>(false);
  const [isRefreshingSession, setIsRefreshingSession] = useState<boolean>(false);
  const [sessionExpired, setSessionExpired] = useState<boolean>(false);

  // Filter states (initialized from URL query params)
  const [searchQuery, setSearchQuery] = useState(initialFilters.q);
  const [statusFilter, setStatusFilter] = useState<RequestStatus | 'ALL'>(
    initialFilters.status
  );
  const [departmentFilter, setDepartmentFilter] = useState<string>(initialFilters.dept);
  const [slaBreachedOnly, setSlaBreachedOnly] = useState<boolean>(initialFilters.sla);

  // Saved filter presets
  const [filterPresets, setFilterPresets] = useState<FilterPreset[]>(() =>
    loadStoredPresets()
  );

  // Sorting states
  const [sortField, setSortField] = useState<SortField>('submittedDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // In-memory session activity feed & undo stack
  const [activityFeed, setActivityFeed] = useState<ActivityEvent[]>([]);
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [slaReferenceNowMs] = useState<number>(() => Date.now());

  const logActivity = useCallback(
    (type: ActivityEvent['type'], summary: string, detail?: string) => {
      const entry: ActivityEvent = {
        id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type,
        summary,
        detail,
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      };
      setActivityFeed((prev) => [entry, ...prev].slice(0, 50));
    },
    []
  );

  // Sync filters to URL query parameters without creating history entries
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);

    if (searchQuery.trim()) {
      params.set('q', searchQuery.trim());
    } else {
      params.delete('q');
    }

    if (statusFilter !== 'ALL') {
      params.set('status', statusFilter);
    } else {
      params.delete('status');
    }

    if (departmentFilter !== 'ALL') {
      params.set('dept', departmentFilter);
    } else {
      params.delete('dept');
    }

    if (slaBreachedOnly) {
      params.set('sla', 'breached');
    } else {
      params.delete('sla');
    }

    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    window.history.replaceState(null, '', nextUrl);
  }, [searchQuery, statusFilter, departmentFilter, slaBreachedOnly]);

  const handleAuthFailure = useCallback((err: unknown) => {
    if (err instanceof ApiError && err.statusCode === 401) {
      setSessionExpired(true);
    }
  }, []);

  const loadRequests = useCallback(async () => {
    setFetchStatus('loading');
    setErrorMessage(null);
    try {
      const data = await mockApprovalApi.withTokenRefresh(
        () => mockApprovalApi.fetchRequests(simulateError),
        (refreshing) => {
          setIsRefreshingSession(refreshing);
          if (refreshing) {
            logActivity('API_RETRY', 'Silent JWT refresh triggered (401)');
          }
        }
      );
      setRequests(data);
      setFetchStatus('success');
      setSessionExpired(false);
    } catch (err) {
      handleAuthFailure(err);
      setFetchStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Unknown API error');
    }
  }, [simulateError, handleAuthFailure, logActivity]);

  useEffect(() => {
    let cancelled = false;

    mockApprovalApi
      .withTokenRefresh(
        () => mockApprovalApi.fetchRequests(false),
        (refreshing) => {
          if (!cancelled) setIsRefreshingSession(refreshing);
        }
      )
      .then((data) => {
        if (cancelled) return;
        setRequests(data);
        setFetchStatus('success');
      })
      .catch((err) => {
        if (cancelled) return;
        setFetchStatus('error');
        setErrorMessage(err instanceof Error ? err.message : 'Unknown API error');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const createRequest = useCallback(
    async (payload: CreateRequestPayload): Promise<PersonnelRequest> => {
      setActionError(null);
      try {
        const created = await mockApprovalApi.withTokenRefresh(
          () => mockApprovalApi.createRequest(payload, simulateError),
          (refreshing) => {
            setIsRefreshingSession(refreshing);
            if (refreshing) {
              logActivity('API_RETRY', 'Silent JWT refresh during request creation');
            }
          }
        );
        setRequests((prev) => [created, ...prev]);
        logActivity(
          'CREATE',
          `Submitted ${created.referenceCode}`,
          `${created.priority} · RM ${created.estimatedBudgetMyr.toLocaleString()}`
        );
        return created;
      } catch (err) {
        handleAuthFailure(err);
        const msg = err instanceof Error ? err.message : 'Failed to create request.';
        setActionError(msg);
        throw err;
      }
    },
    [simulateError, handleAuthFailure, logActivity]
  );

  const submitDecision = useCallback(
    async (
      payload: ApprovalPayload
    ): Promise<{ updated: PersonnelRequest; undoId: string }> => {
      setActionError(null);
      const snapshot = requests;
      const target = snapshot.find((r) => r.id === payload.requestId);
      if (!target) {
        throw new Error('Request not found in local state.');
      }

      // Enforce FSM legality at the hook/reducer boundary before optimistic update
      const optimisticStatus = transitionRequestStatus(
        target,
        payload.decision,
        payload.actorRole
      );

      setRequests((prev) =>
        prev.map((req) =>
          req.id === payload.requestId
            ? {
                ...req,
                status: optimisticStatus,
                auditTrail: [
                  ...req.auditTrail,
                  {
                    id: `optimistic-${Date.now()}`,
                    actorRole: payload.actorRole,
                    actorName: payload.actorRole,
                    action: optimisticStatus,
                    remarks: payload.remarks,
                    timestamp: 'Syncing...',
                  },
                ],
              }
            : req
        )
      );

      try {
        const updated = await mockApprovalApi.withTokenRefresh(
          () => mockApprovalApi.processApproval(payload, simulateError),
          (refreshing) => {
            setIsRefreshingSession(refreshing);
            if (refreshing) {
              logActivity('API_RETRY', 'Silent JWT refresh & auto-retry (401)');
            }
          }
        );
        setRequests((prev) =>
          prev.map((req) => (req.id === updated.id ? updated : req))
        );

        const undoId = `undo-${Date.now()}`;
        const undoEntry: UndoEntry = {
          id: undoId,
          previousSnapshot: target,
          actorRole: payload.actorRole,
          expiresAt: Date.now() + 10_000,
        };
        setUndoStack((prev) => [undoEntry, ...prev].slice(0, 10));

        logActivity(
          'TRANSITION',
          `${updated.referenceCode} → ${updated.status}`,
          `${payload.actorRole} (${payload.decision})`
        );

        return { updated, undoId };
      } catch (err) {
        handleAuthFailure(err);
        if (err instanceof ApiError && err.statusCode === 409 && err.latestRequest) {
          // Sync latest server record into table while keeping modal open for diff/resolve
          const latest = err.latestRequest;
          setRequests((prev) =>
            prev.map((req) => (req.id === latest.id ? latest : req))
          );
          logActivity(
            'API_RETRY',
            `409 Conflict detected on ${latest.referenceCode}`,
            `Server v${latest.version} vs expected v${payload.expectedVersion}`
          );
          throw err;
        }
        setRequests(snapshot);
        const msg =
          err instanceof Error
            ? `Action rolled back: ${err.message}`
            : 'Action rolled back due to API error.';
        setActionError(msg);
        throw err;
      }
    },
    [requests, simulateError, handleAuthFailure, logActivity]
  );

  const undoDecision = useCallback(
    async (undoId: string): Promise<PersonnelRequest | null> => {
      const entry = undoStack.find((u) => u.id === undoId);
      if (!entry || Date.now() > entry.expiresAt) {
        return null;
      }

      const reverted = await mockApprovalApi.revertDecision(
        entry.previousSnapshot.id,
        entry.previousSnapshot,
        entry.actorRole
      );
      setRequests((prev) =>
        prev.map((req) => (req.id === reverted.id ? reverted : req))
      );
      setUndoStack((prev) => prev.filter((u) => u.id !== undoId));
      logActivity(
        'UNDO',
        `Reverted ${reverted.referenceCode} → ${reverted.status}`,
        '10-second undo applied'
      );
      return reverted;
    },
    [undoStack, logActivity]
  );

  const submitBatchDecision = useCallback(
    async (payload: BatchApprovalPayload): Promise<PersonnelRequest[]> => {
      setActionError(null);
      const snapshot = requests;
      const idSet = new Set(payload.requestIds);

      // Validate every selected request against the FSM before optimistic update
      const optimisticById = new Map<string, RequestStatus>();
      for (const req of snapshot) {
        if (idSet.has(req.id)) {
          optimisticById.set(
            req.id,
            transitionRequestStatus(req, payload.decision, payload.actorRole)
          );
        }
      }

      setRequests((prev) =>
        prev.map((req) => {
          const next = optimisticById.get(req.id);
          return next ? { ...req, status: next } : req;
        })
      );

      try {
        const updatedList = await mockApprovalApi.withTokenRefresh(
          () => mockApprovalApi.processBatchApproval(payload, simulateError),
          (refreshing) => {
            setIsRefreshingSession(refreshing);
            if (refreshing) {
              logActivity('API_RETRY', 'Silent JWT refresh during batch action');
            }
          }
        );
        const updatedById = new Map(updatedList.map((u) => [u.id, u]));
        setRequests((prev) =>
          prev.map((req) => updatedById.get(req.id) ?? req)
        );
        logActivity(
          'TRANSITION',
          `Batch ${payload.decision} (${updatedList.length} items)`,
          payload.actorRole
        );
        return updatedList;
      } catch (err) {
        handleAuthFailure(err);
        setRequests(snapshot);
        const msg =
          err instanceof Error
            ? `Batch action rolled back: ${err.message}`
            : 'Batch action rolled back due to API error.';
        setActionError(msg);
        throw err;
      }
    },
    [requests, simulateError, handleAuthFailure, logActivity]
  );

  const reauthenticateSession = useCallback(() => {
    mockApprovalApi.clearSessionExpiry();
    setSessionExpired(false);
    setActionError(null);
    logActivity('API_RETRY', 'Session re-authenticated');
    loadRequests();
  }, [loadRequests, logActivity]);

  const toggleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortField(field);
        setSortDirection(field === 'submittedDate' ? 'desc' : 'asc');
      }
    },
    [sortField]
  );

  const saveFilterPreset = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const preset: FilterPreset = {
        id: `preset-${Date.now()}`,
        name: trimmed,
        searchQuery,
        statusFilter,
        departmentFilter,
        slaBreachedOnly,
      };
      setFilterPresets((prev) => {
        const next = [...prev, preset];
        try {
          window.localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore storage quota errors
        }
        return next;
      });
    },
    [searchQuery, statusFilter, departmentFilter, slaBreachedOnly]
  );

  const applyFilterPreset = useCallback((preset: FilterPreset) => {
    setSearchQuery(preset.searchQuery);
    setStatusFilter(preset.statusFilter);
    setDepartmentFilter(preset.departmentFilter);
    setSlaBreachedOnly(Boolean(preset.slaBreachedOnly));
  }, []);

  const deleteFilterPreset = useCallback((id: string) => {
    setFilterPresets((prev) => {
      const next = prev.filter((p) => p.id !== id);
      try {
        window.localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const filteredRequests = useMemo(() => {
    const query = searchQuery.toLowerCase();

    const filtered = requests.filter((item) => {
      const matchesSearch =
        item.title.toLowerCase().includes(query) ||
        item.referenceCode.toLowerCase().includes(query) ||
        item.submittedBy.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === 'ALL' || item.status === statusFilter;

      const matchesDept =
        departmentFilter === 'ALL' || item.department === departmentFilter;

      const matchesSla =
        !slaBreachedOnly ||
        computeSlaSnapshot(item, slaReferenceNowMs).health === 'BREACHED';

      return matchesSearch && matchesStatus && matchesDept && matchesSla;
    });

    return [...filtered].sort((a, b) => {
      let comparison = 0;
      if (sortField === 'submittedDate') {
        comparison = a.submittedDate.localeCompare(b.submittedDate);
      } else if (sortField === 'priority') {
        comparison = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      } else if (sortField === 'status') {
        comparison = STATUS_RANK[a.status] - STATUS_RANK[b.status];
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [
    requests,
    searchQuery,
    statusFilter,
    departmentFilter,
    slaBreachedOnly,
    slaReferenceNowMs,
    sortField,
    sortDirection,
  ]);

  return {
    requests,
    filteredRequests,
    fetchStatus,
    errorMessage,
    actionError,
    clearActionError: () => setActionError(null),
    simulateError,
    setSimulateError,
    simulateConflict,
    setSimulateConflict,
    isRefreshingSession,
    sessionExpired,
    reauthenticateSession,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    departmentFilter,
    setDepartmentFilter,
    slaBreachedOnly,
    setSlaBreachedOnly,
    filterPresets,
    saveFilterPreset,
    applyFilterPreset,
    deleteFilterPreset,
    sortField,
    sortDirection,
    toggleSort,
    activityFeed,
    logActivity,
    undoDecision,
    reload: loadRequests,
    createRequest,
    submitDecision,
    submitBatchDecision,
  };
}
