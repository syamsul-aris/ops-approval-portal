import { useCallback, useState } from 'react';
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
} from 'lucide-react';
import type {
  ApprovalPayload,
  BatchApprovalPayload,
  CreateRequestPayload,
  PersonnelRequest,
  ToastMessage,
  ToastVariant,
  UserRole,
} from './types/approval';
import { useApprovalRequests } from './hooks/useApprovalRequests';
import { RoleSwitcher } from './components/RoleSwitcher';
import { RequestTable } from './components/RequestTable';
import { ApprovalModal } from './components/ApprovalModal';
import { NewRequestModal } from './components/NewRequestModal';
import { ToastContainer } from './components/ToastContainer';
import { ErrorBoundary } from './components/ErrorBoundary';
import { mockApprovalApi } from './services/mockApprovalApi';
import { exportRequestsToCsv } from './utils/exportCsv';

export function App() {
  const [currentRole, setCurrentRole] = useState<UserRole>('UNIT_REVIEWER');
  const [selectedRequest, setSelectedRequest] = useState<PersonnelRequest | null>(null);
  const [isNewRequestOpen, setIsNewRequestOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const {
    requests,
    filteredRequests,
    fetchStatus,
    errorMessage,
    actionError,
    clearActionError,
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
    reload,
    createRequest,
    submitDecision,
    submitBatchDecision,
  } = useApprovalRequests();

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    (variant: ToastVariant, title: string, description?: string) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev, { id, variant, title, description }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4200);
    },
    []
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
        await submitDecision(payload);
        const actionLabel =
          payload.decision === 'VERIFY'
            ? 'verified'
            : payload.decision === 'APPROVE'
            ? 'approved'
            : 'rejected';
        pushToast(
          payload.decision === 'REJECT' ? 'info' : 'success',
          `Request ${actionLabel}`,
          'Audit log updated and synchronized.'
        );
      } catch (err) {
        pushToast(
          'error',
          'Optimistic update rolled back',
          err instanceof Error ? err.message : 'API error occurred.'
        );
        throw err;
      }
    },
    [submitDecision, pushToast]
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

  const handleResetDemo = useCallback(() => {
    mockApprovalApi.resetDemoData();
    setSimulateError(false);
    clearActionError();
    reload();
    pushToast('info', 'Demo data reset', 'Restored initial operational records.');
  }, [setSimulateError, clearActionError, reload, pushToast]);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider bg-blue-600 text-white rounded">
                Architectural Sample
              </span>
              <h1 className="text-lg font-bold text-slate-900">
                Operational Workflow & Approval Portal
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Sanitized demonstration of RBAC state transitions, TypeScript domain modeling, and async API handling
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {isRefreshingSession && (
              <span
                role="status"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium"
              >
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Refreshing session token...
              </span>
            )}
            <RoleSwitcher currentRole={currentRole} onRoleChange={setCurrentRole} />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <ErrorBoundary>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {/* Session Expired Banner */}
          {sessionExpired && (
            <div
              role="alert"
              className="bg-amber-50 border border-amber-300 text-amber-950 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs"
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
                className="px-3 py-1.5 rounded-lg bg-amber-900 text-white font-medium hover:bg-amber-800 cursor-pointer"
              >
                Re-authenticate Session
              </button>
            </div>
          )}

          {/* Optimistic Rollback Error Banner */}
          {actionError && (
            <div
              role="alert"
              className="bg-rose-50 border border-rose-200 text-rose-900 rounded-xl px-4 py-3 flex items-center justify-between gap-3 text-xs"
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

          {/* Developer / Interviewer Controls */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap gap-6 text-xs">
              <div>
                <span className="text-slate-400 block">Total Records</span>
                <span className="text-base font-bold text-slate-900">{requests.length}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Pending Review</span>
                <span className="text-base font-bold text-amber-600">
                  {requests.filter((r) => r.status === 'PENDING_REVIEW').length}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Verified (Awaiting Final)</span>
                <span className="text-base font-bold text-blue-600">
                  {requests.filter((r) => r.status === 'VERIFIED').length}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Approved</span>
                <span className="text-base font-bold text-emerald-600">
                  {requests.filter((r) => r.status === 'APPROVED').length}
                </span>
              </div>
            </div>

            {/* API Simulation, Export & Requester Controls */}
            <div className="flex flex-wrap items-center gap-2">
              {currentRole === 'REQUESTER' && (
                <button
                  type="button"
                  onClick={() => setIsNewRequestOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> New Request
                </button>
              )}

              <button
                type="button"
                onClick={handleExportCsv}
                disabled={filteredRequests.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> Export Filtered CSV
              </button>

              <button
                type="button"
                onClick={handleArmTokenExpiry}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-50 text-amber-900 border border-amber-200 rounded-lg hover:bg-amber-100 cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5 text-amber-600" /> Simulate Token Expiry (401)
              </button>

              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 cursor-pointer">
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
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Re-fetch
              </button>

              <button
                type="button"
                onClick={handleResetDemo}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
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
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            departmentFilter={departmentFilter}
            onDepartmentFilterChange={setDepartmentFilter}
            sortField={sortField}
            sortDirection={sortDirection}
            onToggleSort={toggleSort}
            onRetry={reload}
            onSelectRequest={setSelectedRequest}
            onBatchDecision={handleBatchDecision}
          />
        </main>
      </ErrorBoundary>

      {/* Multi-Step Approval Modal */}
      {selectedRequest && (
        <ApprovalModal
          request={selectedRequest}
          currentRole={currentRole}
          onClose={() => setSelectedRequest(null)}
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

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default App;
