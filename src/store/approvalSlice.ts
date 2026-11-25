import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type {
  ActivityEvent,
  ApprovalPayload,
  AsyncStatus,
  BatchApprovalPayload,
  CreateRequestPayload,
  FilterPreset,
  PersonnelRequest,
  RequestStatus,
  SortDirection,
  SortField,
  UserRole,
} from '../types/approval';
import { ApiError, mockApprovalApi } from '../services/mockApprovalApi';
import { transitionRequestStatus } from '../domain/workflowMachine';

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

export function readInitialFiltersFromUrl() {
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

export interface SerializedConflictError {
  statusCode: 409;
  message: string;
  latestRequest: PersonnelRequest;
}

export interface ApprovalState {
  requests: PersonnelRequest[];
  currentRole: UserRole;
  fetchStatus: AsyncStatus;
  errorMessage: string | null;
  actionError: string | null;
  simulateError: boolean;
  simulateConflict: boolean;
  isRefreshingSession: boolean;
  sessionExpired: boolean;
  searchQuery: string;
  statusFilter: RequestStatus | 'ALL';
  departmentFilter: string;
  slaBreachedOnly: boolean;
  filterPresets: FilterPreset[];
  sortField: SortField;
  sortDirection: SortDirection;
  activityFeed: ActivityEvent[];
  undoStack: UndoEntry[];
}

function createInitialState(): ApprovalState {
  const initialFilters = readInitialFiltersFromUrl();
  return {
    requests: [],
    currentRole: 'UNIT_REVIEWER',
    fetchStatus: 'loading',
    errorMessage: null,
    actionError: null,
    simulateError: false,
    simulateConflict: false,
    isRefreshingSession: false,
    sessionExpired: false,
    searchQuery: initialFilters.q,
    statusFilter: initialFilters.status,
    departmentFilter: initialFilters.dept,
    slaBreachedOnly: initialFilters.sla,
    filterPresets: loadStoredPresets(),
    sortField: 'submittedDate',
    sortDirection: 'desc',
    activityFeed: [],
    undoStack: [],
  };
}

function makeActivityEvent(
  type: ActivityEvent['type'],
  summary: string,
  detail?: string
): ActivityEvent {
  return {
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
}

export const fetchRequestsThunk = createAsyncThunk<
  PersonnelRequest[],
  { simulateError?: boolean } | void,
  { state: { approval: ApprovalState }; rejectValue: { message: string; isAuthError: boolean } }
>('approval/fetchRequests', async (arg, { getState, dispatch, rejectWithValue }) => {
  const useSimError =
    arg && typeof arg.simulateError === 'boolean'
      ? arg.simulateError
      : getState().approval.simulateError;
  try {
    return await mockApprovalApi.withTokenRefresh(
      () => mockApprovalApi.fetchRequests(useSimError),
      (refreshing) => {
        dispatch(approvalSlice.actions.setRefreshingSession(refreshing));
        if (refreshing) {
          dispatch(
            approvalSlice.actions.addActivity({
              type: 'API_RETRY',
              summary: 'Silent JWT refresh triggered (401)',
            })
          );
        }
      }
    );
  } catch (err) {
    return rejectWithValue({
      message: err instanceof Error ? err.message : 'Unknown API error',
      isAuthError: err instanceof ApiError && err.statusCode === 401,
    });
  }
});

export const createRequestThunk = createAsyncThunk<
  PersonnelRequest,
  CreateRequestPayload,
  { state: { approval: ApprovalState }; rejectValue: { message: string; isAuthError: boolean } }
>('approval/createRequest', async (payload, { getState, dispatch, rejectWithValue }) => {
  const { simulateError } = getState().approval;
  try {
    return await mockApprovalApi.withTokenRefresh(
      () => mockApprovalApi.createRequest(payload, simulateError),
      (refreshing) => {
        dispatch(approvalSlice.actions.setRefreshingSession(refreshing));
        if (refreshing) {
          dispatch(
            approvalSlice.actions.addActivity({
              type: 'API_RETRY',
              summary: 'Silent JWT refresh during request creation',
            })
          );
        }
      }
    );
  } catch (err) {
    return rejectWithValue({
      message: err instanceof Error ? err.message : 'Failed to create request.',
      isAuthError: err instanceof ApiError && err.statusCode === 401,
    });
  }
});

export const submitDecisionThunk = createAsyncThunk<
  { updated: PersonnelRequest; previousSnapshot: PersonnelRequest; undoId: string },
  ApprovalPayload,
  {
    state: { approval: ApprovalState };
    rejectValue:
      | SerializedConflictError
      | { message: string; isAuthError: boolean; snapshot: PersonnelRequest[] };
  }
>('approval/submitDecision', async (payload, { getState, dispatch, rejectWithValue }) => {
  const { requests, simulateError } = getState().approval;
  const target = requests.find((r) => r.id === payload.requestId);
  if (!target) {
    return rejectWithValue({
      message: 'Request not found in local state.',
      isAuthError: false,
      snapshot: requests,
    });
  }

  const optimisticStatus = transitionRequestStatus(
    target,
    payload.decision,
    payload.actorRole
  );
  const snapshot = requests;

  dispatch(
    approvalSlice.actions.applyOptimisticDecision({
      requestId: payload.requestId,
      optimisticStatus,
      actorRole: payload.actorRole,
      remarks: payload.remarks,
    })
  );

  try {
    const updated = await mockApprovalApi.withTokenRefresh(
      () => mockApprovalApi.processApproval(payload, simulateError),
      (refreshing) => {
        dispatch(approvalSlice.actions.setRefreshingSession(refreshing));
        if (refreshing) {
          dispatch(
            approvalSlice.actions.addActivity({
              type: 'API_RETRY',
              summary: 'Silent JWT refresh & auto-retry (401)',
            })
          );
        }
      }
    );

    const undoId = `undo-${Date.now()}`;
    return { updated, previousSnapshot: target, undoId };
  } catch (err) {
    if (err instanceof ApiError && err.statusCode === 409 && err.latestRequest) {
      return rejectWithValue({
        statusCode: 409,
        message: err.message,
        latestRequest: err.latestRequest,
      });
    }
    return rejectWithValue({
      message: err instanceof Error ? err.message : 'API error occurred.',
      isAuthError: err instanceof ApiError && err.statusCode === 401,
      snapshot,
    });
  }
});

export const submitBatchDecisionThunk = createAsyncThunk<
  PersonnelRequest[],
  BatchApprovalPayload,
  {
    state: { approval: ApprovalState };
    rejectValue: { message: string; isAuthError: boolean; snapshot: PersonnelRequest[] };
  }
>(
  'approval/submitBatchDecision',
  async (payload, { getState, dispatch, rejectWithValue }) => {
    const { requests, simulateError } = getState().approval;
    const snapshot = requests;
    const idSet = new Set(payload.requestIds);

    const updates: Record<string, RequestStatus> = {};
    for (const req of snapshot) {
      if (idSet.has(req.id)) {
        updates[req.id] = transitionRequestStatus(
          req,
          payload.decision,
          payload.actorRole
        );
      }
    }

    dispatch(approvalSlice.actions.applyOptimisticBatch(updates));

    try {
      return await mockApprovalApi.withTokenRefresh(
        () => mockApprovalApi.processBatchApproval(payload, simulateError),
        (refreshing) => {
          dispatch(approvalSlice.actions.setRefreshingSession(refreshing));
          if (refreshing) {
            dispatch(
              approvalSlice.actions.addActivity({
                type: 'API_RETRY',
                summary: 'Silent JWT refresh during batch action',
              })
            );
          }
        }
      );
    } catch (err) {
      return rejectWithValue({
        message: err instanceof Error ? err.message : 'Batch action failed.',
        isAuthError: err instanceof ApiError && err.statusCode === 401,
        snapshot,
      });
    }
  }
);

export const undoDecisionThunk = createAsyncThunk<
  { reverted: PersonnelRequest; undoId: string } | null,
  string,
  { state: { approval: ApprovalState } }
>('approval/undoDecision', async (undoId, { getState }) => {
  const entry = getState().approval.undoStack.find((u) => u.id === undoId);
  if (!entry || Date.now() > entry.expiresAt) {
    return null;
  }
  const reverted = await mockApprovalApi.revertDecision(
    entry.previousSnapshot.id,
    entry.previousSnapshot,
    entry.actorRole
  );
  return { reverted, undoId };
});

export const approvalSlice = createSlice({
  name: 'approval',
  initialState: createInitialState,
  reducers: {
    setCurrentRole(state, action: PayloadAction<UserRole>) {
      state.currentRole = action.payload;
      state.activityFeed = [
        makeActivityEvent('ROLE_SWITCH', `Switched active role → ${action.payload}`),
        ...state.activityFeed,
      ].slice(0, 50);
    },
    setSimulateError(state, action: PayloadAction<boolean>) {
      state.simulateError = action.payload;
    },
    setSimulateConflict(state, action: PayloadAction<boolean>) {
      state.simulateConflict = action.payload;
    },
    setRefreshingSession(state, action: PayloadAction<boolean>) {
      state.isRefreshingSession = action.payload;
    },
    clearActionError(state) {
      state.actionError = null;
    },
    clearSessionExpired(state) {
      state.sessionExpired = false;
      state.actionError = null;
    },
    setSearchQuery(state, action: PayloadAction<string>) {
      state.searchQuery = action.payload;
    },
    setStatusFilter(state, action: PayloadAction<RequestStatus | 'ALL'>) {
      state.statusFilter = action.payload;
    },
    setDepartmentFilter(state, action: PayloadAction<string>) {
      state.departmentFilter = action.payload;
    },
    setSlaBreachedOnly(state, action: PayloadAction<boolean>) {
      state.slaBreachedOnly = action.payload;
    },
    resetFilters(state) {
      state.searchQuery = '';
      state.statusFilter = 'ALL';
      state.departmentFilter = 'ALL';
      state.slaBreachedOnly = false;
    },
    toggleSort(state, action: PayloadAction<SortField>) {
      const field = action.payload;
      if (state.sortField === field) {
        state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        state.sortField = field;
        state.sortDirection = field === 'submittedDate' ? 'desc' : 'asc';
      }
    },
    saveFilterPreset(state, action: PayloadAction<string>) {
      const trimmed = action.payload.trim();
      if (!trimmed) return;
      const preset: FilterPreset = {
        id: `preset-${Date.now()}`,
        name: trimmed,
        searchQuery: state.searchQuery,
        statusFilter: state.statusFilter,
        departmentFilter: state.departmentFilter,
        slaBreachedOnly: state.slaBreachedOnly,
      };
      state.filterPresets.push(preset);
      try {
        window.localStorage.setItem(
          PRESETS_STORAGE_KEY,
          JSON.stringify(state.filterPresets)
        );
      } catch {
        // ignore storage quota errors
      }
    },
    applyFilterPreset(state, action: PayloadAction<FilterPreset>) {
      state.searchQuery = action.payload.searchQuery;
      state.statusFilter = action.payload.statusFilter;
      state.departmentFilter = action.payload.departmentFilter;
      state.slaBreachedOnly = Boolean(action.payload.slaBreachedOnly);
    },
    deleteFilterPreset(state, action: PayloadAction<string>) {
      state.filterPresets = state.filterPresets.filter(
        (p) => p.id !== action.payload
      );
      try {
        window.localStorage.setItem(
          PRESETS_STORAGE_KEY,
          JSON.stringify(state.filterPresets)
        );
      } catch {
        // ignore
      }
    },
    addActivity(
      state,
      action: PayloadAction<{
        type: ActivityEvent['type'];
        summary: string;
        detail?: string;
      }>
    ) {
      state.activityFeed = [
        makeActivityEvent(
          action.payload.type,
          action.payload.summary,
          action.payload.detail
        ),
        ...state.activityFeed,
      ].slice(0, 50);
    },
    applyOptimisticDecision(
      state,
      action: PayloadAction<{
        requestId: string;
        optimisticStatus: RequestStatus;
        actorRole: UserRole;
        remarks: string;
      }>
    ) {
      state.actionError = null;
      const target = state.requests.find((r) => r.id === action.payload.requestId);
      if (target) {
        target.status = action.payload.optimisticStatus;
        target.auditTrail.push({
          id: `optimistic-${Date.now()}`,
          actorRole: action.payload.actorRole,
          actorName: action.payload.actorRole,
          action: action.payload.optimisticStatus,
          remarks: action.payload.remarks,
          timestamp: 'Syncing...',
        });
      }
    },
    applyOptimisticBatch(
      state,
      action: PayloadAction<Record<string, RequestStatus>>
    ) {
      state.actionError = null;
      for (const req of state.requests) {
        const nextStatus = action.payload[req.id];
        if (nextStatus) {
          req.status = nextStatus;
        }
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRequestsThunk.pending, (state) => {
        state.fetchStatus = 'loading';
        state.errorMessage = null;
      })
      .addCase(fetchRequestsThunk.fulfilled, (state, action) => {
        state.requests = action.payload;
        state.fetchStatus = 'success';
        state.sessionExpired = false;
      })
      .addCase(fetchRequestsThunk.rejected, (state, action) => {
        state.fetchStatus = 'error';
        state.errorMessage = action.payload?.message ?? 'Unknown API error';
        if (action.payload?.isAuthError) {
          state.sessionExpired = true;
        }
      })
      .addCase(createRequestThunk.pending, (state) => {
        state.actionError = null;
      })
      .addCase(createRequestThunk.fulfilled, (state, action) => {
        const created = action.payload;
        state.requests.unshift(created);
        state.activityFeed = [
          makeActivityEvent(
            'CREATE',
            `Submitted ${created.referenceCode}`,
            `${created.priority} · RM ${created.estimatedBudgetMyr.toLocaleString()}`
          ),
          ...state.activityFeed,
        ].slice(0, 50);
      })
      .addCase(createRequestThunk.rejected, (state, action) => {
        state.actionError = action.payload?.message ?? 'Failed to create request.';
        if (action.payload?.isAuthError) {
          state.sessionExpired = true;
        }
      })
      .addCase(submitDecisionThunk.fulfilled, (state, action) => {
        const { updated, previousSnapshot, undoId } = action.payload;
        const idx = state.requests.findIndex((r) => r.id === updated.id);
        if (idx !== -1) {
          state.requests[idx] = updated;
        }
        state.undoStack = [
          {
            id: undoId,
            previousSnapshot,
            actorRole: updated.auditTrail.at(-1)?.actorRole ?? state.currentRole,
            expiresAt: Date.now() + 10_000,
          },
          ...state.undoStack,
        ].slice(0, 10);
        state.activityFeed = [
          makeActivityEvent(
            'TRANSITION',
            `${updated.referenceCode} → ${updated.status}`,
            updated.auditTrail.at(-1)?.actorRole
          ),
          ...state.activityFeed,
        ].slice(0, 50);
      })
      .addCase(submitDecisionThunk.rejected, (state, action) => {
        const payload = action.payload;
        if (!payload) return;
        if ('latestRequest' in payload) {
          const latest = payload.latestRequest;
          const idx = state.requests.findIndex((r) => r.id === latest.id);
          if (idx !== -1) {
            state.requests[idx] = latest;
          }
          state.activityFeed = [
            makeActivityEvent(
              'API_RETRY',
              `409 Conflict detected on ${latest.referenceCode}`,
              `Server at v${latest.version}`
            ),
            ...state.activityFeed,
          ].slice(0, 50);
        } else if ('snapshot' in payload) {
          state.requests = payload.snapshot;
          state.actionError = `Action rolled back: ${payload.message}`;
          if (payload.isAuthError) {
            state.sessionExpired = true;
          }
        }
      })
      .addCase(submitBatchDecisionThunk.fulfilled, (state, action) => {
        const updatedById = new Map(action.payload.map((u) => [u.id, u]));
        state.requests = state.requests.map((r) => updatedById.get(r.id) ?? r);
        state.activityFeed = [
          makeActivityEvent(
            'TRANSITION',
            `Batch transition (${action.payload.length} items)`
          ),
          ...state.activityFeed,
        ].slice(0, 50);
      })
      .addCase(submitBatchDecisionThunk.rejected, (state, action) => {
        if (action.payload) {
          state.requests = action.payload.snapshot;
          state.actionError = `Batch action rolled back: ${action.payload.message}`;
          if (action.payload.isAuthError) {
            state.sessionExpired = true;
          }
        }
      })
      .addCase(undoDecisionThunk.fulfilled, (state, action) => {
        if (!action.payload) return;
        const { reverted, undoId } = action.payload;
        const idx = state.requests.findIndex((r) => r.id === reverted.id);
        if (idx !== -1) {
          state.requests[idx] = reverted;
        }
        state.undoStack = state.undoStack.filter((u) => u.id !== undoId);
        state.activityFeed = [
          makeActivityEvent(
            'UNDO',
            `Reverted ${reverted.referenceCode} → ${reverted.status}`,
            '10-second undo applied'
          ),
          ...state.activityFeed,
        ].slice(0, 50);
      });
  },
});

export const {
  setCurrentRole,
  setSimulateError,
  setSimulateConflict,
  clearActionError,
  clearSessionExpired,
  setSearchQuery,
  setStatusFilter,
  setDepartmentFilter,
  setSlaBreachedOnly,
  resetFilters,
  toggleSort,
  saveFilterPreset,
  applyFilterPreset,
  deleteFilterPreset,
  addActivity,
} = approvalSlice.actions;

export default approvalSlice.reducer;
