import { useEffect, useMemo, useCallback, useState } from 'react';
import type {
  ActivityEvent,
  ApprovalPayload,
  BatchApprovalPayload,
  CreateRequestPayload,
  FilterPreset,
  PersonnelRequest,
  PriorityLevel,
  RequestStatus,
  SortField,
  UserRole,
} from '../types/approval';
import { ApiError, mockApprovalApi } from '../services/mockApprovalApi';
import { computeSlaSnapshot } from './useSlaTracker';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  addActivity,
  applyFilterPreset,
  clearActionError,
  clearSessionExpired,
  createRequestThunk,
  deleteFilterPreset,
  fetchRequestsThunk,
  resetFilters,
  saveFilterPreset,
  setCurrentRole,
  setDepartmentFilter,
  setSearchQuery,
  setSimulateConflict,
  setSimulateError,
  setSlaBreachedOnly,
  setStatusFilter,
  submitBatchDecisionThunk,
  submitDecisionThunk,
  toggleSort,
  undoDecisionThunk,
} from '../store/approvalSlice';

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

export function useApprovalRequests() {
  const dispatch = useAppDispatch();
  const state = useAppSelector((s) => s.approval);
  const [slaReferenceNowMs] = useState<number>(() => Date.now());

  // Sync filters to URL query parameters without creating history entries
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);

    if (state.searchQuery.trim()) {
      params.set('q', state.searchQuery.trim());
    } else {
      params.delete('q');
    }

    if (state.statusFilter !== 'ALL') {
      params.set('status', state.statusFilter);
    } else {
      params.delete('status');
    }

    if (state.departmentFilter !== 'ALL') {
      params.set('dept', state.departmentFilter);
    } else {
      params.delete('dept');
    }

    if (state.slaBreachedOnly) {
      params.set('sla', 'breached');
    } else {
      params.delete('sla');
    }

    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    window.history.replaceState(null, '', nextUrl);
  }, [
    state.searchQuery,
    state.statusFilter,
    state.departmentFilter,
    state.slaBreachedOnly,
  ]);

  // Initial fetch on mount
  useEffect(() => {
    void dispatch(fetchRequestsThunk({ simulateError: false }));
  }, [dispatch]);

  const reload = useCallback(() => {
    void dispatch(fetchRequestsThunk());
  }, [dispatch]);

  const createRequest = useCallback(
    async (payload: CreateRequestPayload): Promise<PersonnelRequest> => {
      const action = await dispatch(createRequestThunk(payload));
      if (createRequestThunk.rejected.match(action)) {
        throw new Error(action.payload?.message ?? 'Failed to create request.');
      }
      return action.payload;
    },
    [dispatch]
  );

  const submitDecision = useCallback(
    async (
      payload: ApprovalPayload
    ): Promise<{ updated: PersonnelRequest; undoId: string }> => {
      const action = await dispatch(submitDecisionThunk(payload));
      if (submitDecisionThunk.rejected.match(action)) {
        const errPayload = action.payload;
        if (errPayload && 'latestRequest' in errPayload) {
          throw new ApiError(409, errPayload.message, errPayload.latestRequest);
        }
        throw new Error(errPayload?.message ?? 'Decision submission failed.');
      }
      return {
        updated: action.payload.updated,
        undoId: action.payload.undoId,
      };
    },
    [dispatch]
  );

  const undoDecision = useCallback(
    async (undoId: string): Promise<PersonnelRequest | null> => {
      const action = await dispatch(undoDecisionThunk(undoId));
      if (undoDecisionThunk.fulfilled.match(action) && action.payload) {
        return action.payload.reverted;
      }
      return null;
    },
    [dispatch]
  );

  const submitBatchDecision = useCallback(
    async (payload: BatchApprovalPayload): Promise<PersonnelRequest[]> => {
      const action = await dispatch(submitBatchDecisionThunk(payload));
      if (submitBatchDecisionThunk.rejected.match(action)) {
        throw new Error(action.payload?.message ?? 'Batch action failed.');
      }
      return action.payload;
    },
    [dispatch]
  );

  const reauthenticateSession = useCallback(() => {
    mockApprovalApi.clearSessionExpiry();
    dispatch(clearSessionExpired());
    dispatch(
      addActivity({
        type: 'API_RETRY',
        summary: 'Session re-authenticated',
      })
    );
    void dispatch(fetchRequestsThunk());
  }, [dispatch]);

  const filteredRequests = useMemo(() => {
    const query = state.searchQuery.toLowerCase();

    const filtered = state.requests.filter((item) => {
      const matchesSearch =
        item.title.toLowerCase().includes(query) ||
        item.referenceCode.toLowerCase().includes(query) ||
        item.submittedBy.toLowerCase().includes(query);

      const matchesStatus =
        state.statusFilter === 'ALL' || item.status === state.statusFilter;

      const matchesDept =
        state.departmentFilter === 'ALL' ||
        item.department === state.departmentFilter;

      const matchesSla =
        !state.slaBreachedOnly ||
        computeSlaSnapshot(item, slaReferenceNowMs).health === 'BREACHED';

      return matchesSearch && matchesStatus && matchesDept && matchesSla;
    });

    return [...filtered].sort((a, b) => {
      let comparison = 0;
      if (state.sortField === 'submittedDate') {
        comparison = a.submittedDate.localeCompare(b.submittedDate);
      } else if (state.sortField === 'priority') {
        comparison = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      } else if (state.sortField === 'status') {
        comparison = STATUS_RANK[a.status] - STATUS_RANK[b.status];
      }
      return state.sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [
    state.requests,
    state.searchQuery,
    state.statusFilter,
    state.departmentFilter,
    state.slaBreachedOnly,
    slaReferenceNowMs,
    state.sortField,
    state.sortDirection,
  ]);

  return {
    requests: state.requests,
    filteredRequests,
    currentRole: state.currentRole,
    setCurrentRole: useCallback(
      (role: UserRole) => dispatch(setCurrentRole(role)),
      [dispatch]
    ),
    fetchStatus: state.fetchStatus,
    errorMessage: state.errorMessage,
    actionError: state.actionError,
    clearActionError: useCallback(() => dispatch(clearActionError()), [dispatch]),
    simulateError: state.simulateError,
    setSimulateError: useCallback(
      (val: boolean) => dispatch(setSimulateError(val)),
      [dispatch]
    ),
    simulateConflict: state.simulateConflict,
    setSimulateConflict: useCallback(
      (val: boolean) => dispatch(setSimulateConflict(val)),
      [dispatch]
    ),
    isRefreshingSession: state.isRefreshingSession,
    sessionExpired: state.sessionExpired,
    reauthenticateSession,
    searchQuery: state.searchQuery,
    setSearchQuery: useCallback(
      (q: string) => dispatch(setSearchQuery(q)),
      [dispatch]
    ),
    statusFilter: state.statusFilter,
    setStatusFilter: useCallback(
      (s: RequestStatus | 'ALL') => dispatch(setStatusFilter(s)),
      [dispatch]
    ),
    departmentFilter: state.departmentFilter,
    setDepartmentFilter: useCallback(
      (d: string) => dispatch(setDepartmentFilter(d)),
      [dispatch]
    ),
    slaBreachedOnly: state.slaBreachedOnly,
    setSlaBreachedOnly: useCallback(
      (v: boolean) => dispatch(setSlaBreachedOnly(v)),
      [dispatch]
    ),
    resetAllFilters: useCallback(() => dispatch(resetFilters()), [dispatch]),
    filterPresets: state.filterPresets,
    saveFilterPreset: useCallback(
      (name: string) => dispatch(saveFilterPreset(name)),
      [dispatch]
    ),
    applyFilterPreset: useCallback(
      (preset: FilterPreset) => dispatch(applyFilterPreset(preset)),
      [dispatch]
    ),
    deleteFilterPreset: useCallback(
      (id: string) => dispatch(deleteFilterPreset(id)),
      [dispatch]
    ),
    sortField: state.sortField,
    sortDirection: state.sortDirection,
    toggleSort: useCallback(
      (field: SortField) => dispatch(toggleSort(field)),
      [dispatch]
    ),
    activityFeed: state.activityFeed,
    logActivity: useCallback(
      (type: ActivityEvent['type'], summary: string, detail?: string) =>
        dispatch(addActivity({ type, summary, detail })),
      [dispatch]
    ),
    undoDecision,
    reload,
    createRequest,
    submitDecision,
    submitBatchDecision,
  };
}
