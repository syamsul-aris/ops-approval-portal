import { useState, useEffect, useMemo, useCallback } from 'react';
import type {
  ApprovalPayload,
  AsyncStatus,
  BatchApprovalPayload,
  CreateRequestPayload,
  PersonnelRequest,
  PriorityLevel,
  RequestStatus,
  SortDirection,
  SortField,
} from '../types/approval';
import { ApiError, mockApprovalApi } from '../services/mockApprovalApi';

const VALID_STATUSES: ReadonlySet<string> = new Set([
  'ALL',
  'PENDING_REVIEW',
  'VERIFIED',
  'APPROVED',
  'REJECTED',
]);

const PRIORITY_RANK: Record<PriorityLevel, number> = {
  CRITICAL: 3,
  PRIORITY: 2,
  ROUTINE: 1,
};

const STATUS_RANK: Record<RequestStatus, number> = {
  PENDING_REVIEW: 1,
  VERIFIED: 2,
  APPROVED: 3,
  REJECTED: 4,
};

function readInitialFiltersFromUrl() {
  if (typeof window === 'undefined') {
    return { q: '', status: 'ALL' as RequestStatus | 'ALL', dept: 'ALL' };
  }
  const params = new URLSearchParams(window.location.search);
  const q = params.get('q') ?? '';
  const rawStatus = params.get('status') ?? 'ALL';
  const status = (VALID_STATUSES.has(rawStatus) ? rawStatus : 'ALL') as
    | RequestStatus
    | 'ALL';
  const dept = params.get('dept') ?? 'ALL';
  return { q, status, dept };
}

function nextStatusForDecision(decision: ApprovalPayload['decision']): RequestStatus {
  if (decision === 'REJECT') return 'REJECTED';
  if (decision === 'VERIFY') return 'VERIFIED';
  return 'APPROVED';
}

export function useApprovalRequests() {
  const initialFilters = useMemo(() => readInitialFiltersFromUrl(), []);

  const [requests, setRequests] = useState<PersonnelRequest[]>([]);
  const [fetchStatus, setFetchStatus] = useState<AsyncStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [simulateError, setSimulateError] = useState<boolean>(false);
  const [isRefreshingSession, setIsRefreshingSession] = useState<boolean>(false);
  const [sessionExpired, setSessionExpired] = useState<boolean>(false);

  // Filter states (initialized from URL query params)
  const [searchQuery, setSearchQuery] = useState(initialFilters.q);
  const [statusFilter, setStatusFilter] = useState<RequestStatus | 'ALL'>(
    initialFilters.status
  );
  const [departmentFilter, setDepartmentFilter] = useState<string>(initialFilters.dept);

  // Sorting states
  const [sortField, setSortField] = useState<SortField>('submittedDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

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

    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    window.history.replaceState(null, '', nextUrl);
  }, [searchQuery, statusFilter, departmentFilter]);

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
        setIsRefreshingSession
      );
      setRequests(data);
      setFetchStatus('success');
      setSessionExpired(false);
    } catch (err) {
      handleAuthFailure(err);
      setFetchStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Unknown API error');
    }
  }, [simulateError, handleAuthFailure]);

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
          setIsRefreshingSession
        );
        setRequests((prev) => [created, ...prev]);
        return created;
      } catch (err) {
        handleAuthFailure(err);
        const msg = err instanceof Error ? err.message : 'Failed to create request.';
        setActionError(msg);
        throw err;
      }
    },
    [simulateError, handleAuthFailure]
  );

  /**
   * Optimistically applies the status transition immediately and rolls back
   * to the previous snapshot if the API request fails.
   */
  const submitDecision = useCallback(
    async (payload: ApprovalPayload): Promise<void> => {
      setActionError(null);
      const snapshot = requests;
      const optimisticStatus = nextStatusForDecision(payload.decision);

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
          setIsRefreshingSession
        );
        setRequests((prev) =>
          prev.map((req) => (req.id === updated.id ? updated : req))
        );
      } catch (err) {
        handleAuthFailure(err);
        setRequests(snapshot);
        const msg =
          err instanceof Error
            ? `Action rolled back: ${err.message}`
            : 'Action rolled back due to API error.';
        setActionError(msg);
        throw err;
      }
    },
    [requests, simulateError, handleAuthFailure]
  );

  /**
   * Optimistically applies batch approval/verification/rejection and rolls back on failure.
   */
  const submitBatchDecision = useCallback(
    async (payload: BatchApprovalPayload): Promise<PersonnelRequest[]> => {
      setActionError(null);
      const snapshot = requests;
      const optimisticStatus = nextStatusForDecision(payload.decision);
      const idSet = new Set(payload.requestIds);

      setRequests((prev) =>
        prev.map((req) =>
          idSet.has(req.id)
            ? {
                ...req,
                status: optimisticStatus,
              }
            : req
        )
      );

      try {
        const updatedList = await mockApprovalApi.withTokenRefresh(
          () => mockApprovalApi.processBatchApproval(payload, simulateError),
          setIsRefreshingSession
        );
        const updatedById = new Map(updatedList.map((u) => [u.id, u]));
        setRequests((prev) =>
          prev.map((req) => updatedById.get(req.id) ?? req)
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
    [requests, simulateError, handleAuthFailure]
  );

  const reauthenticateSession = useCallback(() => {
    mockApprovalApi.clearSessionExpiry();
    setSessionExpired(false);
    setActionError(null);
    loadRequests();
  }, [loadRequests]);

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

      return matchesSearch && matchesStatus && matchesDept;
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
    isRefreshingSession,
    sessionExpired,
    reauthenticateSession,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    departmentFilter,
    setDepartmentFilter,
    sortField,
    sortDirection,
    toggleSort,
    reload: loadRequests,
    createRequest,
    submitDecision,
    submitBatchDecision,
  };
}
