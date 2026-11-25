import { useCallback, useEffect, useState } from 'react';
import {
  RefreshCw,
  Bug,
  RotateCcw,
  Plus,
  AlertTriangle,
  X,
  KeyRound,
  Download,
  Loader2,
  ShieldAlert,
  Command,
  Activity,
  GitCompareArrows,
} from 'lucide-react';
import type {
  ApprovalPayload,
  BatchApprovalPayload,
  CreateRequestPayload,
  PersonnelRequest,
  RequestStatus,
  ToastAction,
  ToastMessage,
  ToastVariant,
  UserRole,
} from './types/approval';
import { useApprovalRequests } from './hooks/useApprovalRequests';
import { useSlaClock } from './hooks/useSlaTracker';
import { RoleSwitcher } from './components/RoleSwitcher';
import { RequestTable } from './components/RequestTable';
import { ApprovalModal } from './components/ApprovalModal';
import { NewRequestModal } from './components/NewRequestModal';
import { ToastContainer } from './components/ToastContainer';
import { ErrorBoundary } from './components/ErrorBoundary';
import { BottlenecksPanel } from './components/BottlenecksPanel';
import { CommandPalette } from './components/CommandPalette';
import { ActivityFeedDrawer } from './components/ActivityFeedDrawer';
import { ApiError, mockApprovalApi } from './services/mockApprovalApi';
import { exportRequestsToCsv } from './utils/exportCsv';

export function App() {
  const [selectedRequest, setSelectedRequest] = useState<PersonnelRequest | null>(
    null
  );
  const [isNewRequestOpen, setIsNewRequestOpen] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const nowMs = useSlaClock();

  const {
    requests,
    filteredRequests,
    currentRole,
    setCurrentRole,
    fetchStatus,
    errorMessage,
    actionError,
    clearActionError,
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
    resetAllFilters,
    filterPresets,
    saveFilterPreset,
    applyFilterPreset,
    deleteFilterPreset,
    sortField,
    sortDirection,
    toggleSort,
    activityFeed,
    undoDecision,
    reload,
    createRequest,
    submitDecision,
    submitBatchDecision,
  } = useApprovalRequests();

  // Global Cmd+K / Ctrl+K shortcut for Command Palette
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    (
      variant: ToastVariant,
      title: string,
      description?: string,
      action?: ToastAction,
      durationMs = 4500
    ) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev, { id, variant, title, description, action }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, durationMs);
    },
    []
  );

  const handleRoleChange = useCallback(
    (nextRole: UserRole) => {
      setCurrentRole(nextRole);
    },
    [setCurrentRole]
  );

  const handleSelectRequest = useCallback(
    (req: PersonnelRequest) => {
      setSelectedRequest(req);
      if (simulateConflict) {
        mockApprovalApi.simulateConcurrentEdit(req.id);
      }
    },
    [simulateConflict]
  );

  const handleCreateRequest = useCallback(
    async (payload: CreateRequestPayload): Promise<PersonnelRequest> => {
      try {
        const created = await createRequest(payload);
        pushToast(
          'success',
          'Request submitted',
          `${created.referenceCode} queued for Unit Reviewer verification.`
        );
        return created;
      } catch (err) {
        pushToast(
          'error',
          'Submission failed',
          err instanceof Error ? err.message : 'Unable to create request.'
        );
        throw err;
      }
    },
    [createRequest, pushToast]
  );

  const handleSubmitDecision = useCallback(
    async (payload: ApprovalPayload): Promise<void> => {
      try {
        const { updated, undoId } = await submitDecision(payload);
        pushToast(
          payload.decision === 'REJECT' ? 'info' : 'success',
          `${updated.referenceCode} → ${updated.status}`,
          'Audit log updated. You have 10s to undo.',
          {
            label: 'Undo Last Decision',
            onClick: () => {
              void undoDecision(undoId).then((reverted) => {
                if (reverted) {
                  pushToast(
                    'info',
                    'Decision reverted',
                    `${reverted.referenceCode} restored to ${reverted.status}.`
                  );
                }
              });
            },
          },
          10_000
        );
      } catch (err) {
        if (err instanceof ApiError && err.statusCode === 409) {
          pushToast(
            'error',
            '409 Concurrent Edit Conflict',
            'Review the side-by-side diff in the drawer.'
          );
          throw err;
        }
        pushToast(
          'error',
          'Optimistic update rolled back',
          err instanceof Error ? err.message : 'API error occurred.'
        );
        throw err;
      }
    },
    [submitDecision, undoDecision, pushToast]
  );

  const handleBatchDecision = useCallback(
    async (payload: BatchApprovalPayload): Promise<void> => {
      try {
        const updated = await submitBatchDecision(payload);
        pushToast(
          payload.decision === 'REJECT' ? 'info' : 'success',
          `Batch ${payload.decision.toLowerCase()} complete`,
          `${updated.length} request${updated.length > 1 ? 's' : ''} updated.`
        );
      } catch (err) {
        pushToast(
          'error',
          'Batch update rolled back',
          err instanceof Error ? err.message : 'API error occurred.'
        );
        throw err;
      }
    },
    [submitBatchDecision, pushToast]
  );

  const handleArmTokenExpiry = useCallback(() => {
    mockApprovalApi.armTokenExpiry(false);
    pushToast(
      'info',
      'JWT expiry armed (401)',
      'Next API action will trigger silent token refresh and automatic retry.'
    );
  }, [pushToast]);

  const handleExportCsv = useCallback(() => {
    exportRequestsToCsv(filteredRequests);
    pushToast(
      'success',
      'CSV report exported',
      `Downloaded ${filteredRequests.length} filtered record${filteredRequests.length === 1 ? '' : 's'}.`
    );
  }, [filteredRequests, pushToast]);

  const handleResetFilters = useCallback(() => {
    resetAllFilters();
  }, [resetAllFilters]);

  const handleResetDemo = useCallback(() => {
    mockApprovalApi.resetDemoData();
    setSimulateError(false);
    setSimulateConflict(false);
    clearActionError();
    reload();
    pushToast('info', 'Demo data reset', 'Restored initial operational records.');
  }, [setSimulateError, setSimulateConflict, clearActionError, reload, pushToast]);

  const handleKpiClick = useCallback(
    (target: RequestStatus | 'ALL') => {
      if (target === 'ALL') {
        setStatusFilter('ALL');
      } else {
        setStatusFilter(statusFilter === target ? 'ALL' : target);
      }
    },
    [statusFilter, setStatusFilter]
  );

  const kpiCards: {
    key: RequestStatus | 'ALL';
    label: string;
    count: number;
    valueClass: string;
    activeRing: string;
    dotClass: string;
  }[] = [
    {
      key: 'ALL',
      label: 'Total Records',
      count: requests.length,
      valueClass: 'text-slate-900',
      activeRing: 'ring-2 ring-slate-900/20 bg-white',
      dotClass: 'bg-slate-600',
    },
    {
      key: 'PENDING_REVIEW',
      label: 'Pending Review',
      count: requests.filter((r) => r.status === 'PENDING_REVIEW').length,
      valueClass: 'text-amber-600',
      activeRing: 'ring-2 ring-amber-500/70 bg-amber-50/30',
      dotClass: 'bg-amber-500',
    },
    {
      key: 'UNIT_VERIFIED',
      label: 'Unit Verified',
      count: requests.filter((r) => r.status === 'UNIT_VERIFIED').length,
      valueClass: 'text-blue-600',
      activeRing: 'ring-2 ring-blue-500/70 bg-blue-50/30',
      dotClass: 'bg-blue-500',
    },
    {
      key: 'COMMAND_APPROVED',
      label: 'Approved',
      count: requests.filter((r) => r.status === 'COMMAND_APPROVED').length,
      valueClass: 'text-emerald-600',
      activeRing: 'ring-2 ring-emerald-500/70 bg-emerald-50/30',
      dotClass: 'bg-emerald-500',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900">
      {/* Top Navbar */}
      <header className="bg-white/95 backdrop-blur-xs border-b border-slate-200/80 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider bg-blue-600 text-white rounded-md">
                Architectural Sample
              </span>
              <h1 className="text-lg font-bold tracking-tight text-slate-900">
                Operational Workflow &amp; Approval Portal
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Explicit FSM routing, 409 optimistic concurrency, live SLA tracking, and session telemetry
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {isRefreshingSession && (
              <span
                role="status"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 ring-1 ring-amber-200 text-amber-800 text-xs font-medium"
              >
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Refreshing session token...
              </span>
            )}

            <button
              type="button"
              onClick={() => setIsPaletteOpen(true)}
              aria-label="Open command palette"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100/90 ring-1 ring-slate-900/5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 active:scale-[0.98] transition-all cursor-pointer"
            >
              <Command className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Palette</span>
              <kbd className="px-1 py-0.2 bg-white rounded text-[10px] font-mono text-slate-500 ring-1 ring-slate-900/5">
                ⌘K
              </kbd>
            </button>

            <button
              type="button"
              onClick={() => setIsActivityOpen(true)}
              aria-label="Open session activity feed"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100/90 ring-1 ring-slate-900/5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 active:scale-[0.98] transition-all cursor-pointer"
            >
              <Activity className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden sm:inline">Activity</span>
              <span className="px-1.5 py-0.2 rounded-full bg-white text-[10px] font-semibold tabular-nums ring-1 ring-slate-900/5">
                {activityFeed.length}
              </span>
            </button>

            <RoleSwitcher currentRole={currentRole} onRoleChange={handleRoleChange} />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <ErrorBoundary>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
          {/* Screen-reader live region for API status updates */}
          <div className="sr-only" aria-live="polite" aria-atomic="true">
            {fetchStatus === 'loading'
              ? 'Loading operational requests.'
              : fetchStatus === 'error'
              ? `Error loading requests: ${errorMessage ?? 'Unknown error'}`
              : `${filteredRequests.length} operational requests displayed.`}
          </div>
          {/* Session Expired Banner */}
          {sessionExpired && (
            <div
              role="alert"
              className="bg-amber-50 ring-1 ring-amber-300 text-amber-950 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
                <span>
                  <strong>Session Expired (401):</strong> Refresh token could not be renewed. Re-authenticate to continue.
                </span>
              </div>
              <button
                type="button"
                onClick={reauthenticateSession}
                className="px-3 py-1.5 rounded-lg bg-amber-900 text-white font-medium hover:bg-amber-800 active:scale-[0.98] transition-all cursor-pointer"
              >
                Re-authenticate Session
              </button>
            </div>
          )}

          {/* Optimistic Rollback Error Banner */}
          {actionError && (
            <div
              role="alert"
              className="bg-rose-50 ring-1 ring-rose-200 text-rose-900 rounded-xl px-4 py-3 flex items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>
                  <strong>Sync Failed:</strong> {actionError}
                </span>
              </div>
              <button
                type="button"
                onClick={clearActionError}
                aria-label="Dismiss error banner"
                className="text-rose-500 hover:text-rose-800 p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Interactive KPI Summary Cards */}
          <section
            aria-label="Request summary metrics"
            className="grid grid-cols-2 lg:grid-cols-4 gap-3"
          >
            {kpiCards.map((card) => {
              const isActive = statusFilter === card.key;
              return (
                <button
                  key={card.key}
                  type="button"
                  onClick={() => handleKpiClick(card.key)}
                  aria-pressed={isActive}
                  className={`text-left rounded-xl p-4 transition-all active:scale-[0.98] cursor-pointer shadow-xs ${
                    isActive
                      ? card.activeRing
                      : 'bg-white ring-1 ring-slate-900/5 hover:ring-slate-900/15'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      {card.label}
                    </span>
                    {isActive && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-600">
                        <span className={`w-1.5 h-1.5 rounded-full ${card.dotClass}`} />
                        Active
                      </span>
                    )}
                  </div>
                  <span
                    className={`mt-1.5 block text-2xl font-bold tracking-tight tabular-nums ${card.valueClass}`}
                  >
                    {card.count}
                  </span>
                </button>
              );
            })}
          </section>

          {/* Collapsible Operational Bottlenecks Panel */}
          <BottlenecksPanel requests={requests} nowMs={nowMs} />

          {/* Controls Toolbar */}
          <div className="bg-white rounded-xl ring-1 ring-slate-900/5 px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Operations &amp; Simulation Controls
            </span>

            <div className="flex flex-wrap items-center gap-2">
              {currentRole === 'REQUESTER' && (
                <button
                  type="button"
                  onClick={() => setIsNewRequestOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:scale-[0.98] transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> New Request
                </button>
              )}

              <button
                type="button"
                onClick={handleExportCsv}
                disabled={filteredRequests.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white ring-1 ring-slate-900/10 rounded-lg hover:bg-slate-50 disabled:opacity-40 active:scale-[0.98] transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> Export Filtered CSV
              </button>

              <button
                type="button"
                onClick={handleArmTokenExpiry}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-50 text-amber-900 ring-1 ring-amber-200 rounded-lg hover:bg-amber-100 active:scale-[0.98] transition-all cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5 text-amber-600" /> Simulate Token Expiry (401)
              </button>

              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 bg-purple-50/70 px-3 py-1.5 rounded-lg ring-1 ring-purple-200 cursor-pointer">
                <GitCompareArrows className="w-3.5 h-3.5 text-purple-600" />
                <input
                  type="checkbox"
                  checked={simulateConflict}
                  onChange={(e) => setSimulateConflict(e.target.checked)}
                  className="rounded text-purple-600"
                />
                Simulate Concurrent Edit Conflict (409)
              </label>

              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 bg-slate-100/80 px-3 py-1.5 rounded-lg ring-1 ring-slate-900/5 cursor-pointer">
                <Bug className="w-3.5 h-3.5 text-rose-500" />
                <input
                  type="checkbox"
                  checked={simulateError}
                  onChange={(e) => setSimulateError(e.target.checked)}
                  className="rounded text-blue-600"
                />
                Simulate API 503/422 Error
              </label>

              <button
                type="button"
                onClick={reload}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white ring-1 ring-slate-900/10 rounded-lg hover:bg-slate-50 active:scale-[0.98] transition-all cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Re-fetch
              </button>

              <button
                type="button"
                onClick={handleResetDemo}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white ring-1 ring-slate-900/10 rounded-lg hover:bg-slate-50 active:scale-[0.98] transition-all cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset Data
              </button>
            </div>
          </div>

          {/* Filterable Data Table */}
          <RequestTable
            requests={filteredRequests}
            fetchStatus={fetchStatus}
            errorMessage={errorMessage}
            currentRole={currentRole}
            nowMs={nowMs}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            departmentFilter={departmentFilter}
            onDepartmentFilterChange={setDepartmentFilter}
            slaBreachedOnly={slaBreachedOnly}
            onSlaBreachedOnlyChange={setSlaBreachedOnly}
            filterPresets={filterPresets}
            onApplyPreset={applyFilterPreset}
            onSavePreset={saveFilterPreset}
            onDeletePreset={deleteFilterPreset}
            onResetFilters={handleResetFilters}
            sortField={sortField}
            sortDirection={sortDirection}
            onToggleSort={toggleSort}
            onRetry={reload}
            onSelectRequest={handleSelectRequest}
            onBatchDecision={handleBatchDecision}
          />
        </main>
      </ErrorBoundary>

      {/* Slide-Over Approval Drawer */}
      {selectedRequest && (
        <ApprovalModal
          request={selectedRequest}
          currentRole={currentRole}
          onClose={() => setSelectedRequest(null)}
          onReloadRequest={(latest) => setSelectedRequest(latest)}
          onSubmit={handleSubmitDecision}
        />
      )}

      {/* New Request Modal (Requester) */}
      {isNewRequestOpen && (
        <NewRequestModal
          onClose={() => setIsNewRequestOpen(false)}
          onCreate={handleCreateRequest}
        />
      )}

      {/* Command Palette (Cmd+K / Ctrl+K) */}
      {isPaletteOpen && (
        <CommandPalette
          isOpen={isPaletteOpen}
          onClose={() => setIsPaletteOpen(false)}
          requests={requests}
          onSelectRequest={handleSelectRequest}
          onSwitchRole={handleRoleChange}
          onJumpSlaBreached={() => {
            handleResetFilters();
            setSlaBreachedOnly(true);
          }}
          onResetDemo={handleResetDemo}
        />
      )}

      {/* Session Activity Feed Drawer */}
      <ActivityFeedDrawer
        isOpen={isActivityOpen}
        onClose={() => setIsActivityOpen(false)}
        events={activityFeed}
      />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default App;
