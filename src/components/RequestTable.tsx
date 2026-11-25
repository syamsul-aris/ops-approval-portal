import React, { useCallback, useMemo, useState } from 'react';
import {
  Search,
  AlertCircle,
  Eye,
  CheckSquare,
  FileSearch,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  CheckCheck,
  XCircle,
  X,
  RotateCcw,
  Bookmark,
  Clock,
} from 'lucide-react';
import type {
  AsyncStatus,
  BatchApprovalPayload,
  FilterPreset,
  PersonnelRequest,
  PriorityLevel,
  RequestStatus,
  SortDirection,
  SortField,
  UserRole,
} from '../types/approval';
import {
  canRoleActOnRequest,
  requiresSecurityClearance,
} from '../domain/workflowMachine';
import { computeSlaSnapshot } from '../hooks/useSlaTracker';

interface RequestTableProps {
  requests: PersonnelRequest[];
  fetchStatus: AsyncStatus;
  errorMessage: string | null;
  currentRole: UserRole;
  nowMs: number;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: RequestStatus | 'ALL';
  onStatusFilterChange: (status: RequestStatus | 'ALL') => void;
  departmentFilter: string;
  onDepartmentFilterChange: (dept: string) => void;
  slaBreachedOnly: boolean;
  onSlaBreachedOnlyChange: (val: boolean) => void;
  filterPresets: FilterPreset[];
  onApplyPreset: (preset: FilterPreset) => void;
  onSavePreset: (name: string) => void;
  onDeletePreset: (id: string) => void;
  onResetFilters: () => void;
  sortField: SortField;
  sortDirection: SortDirection;
  onToggleSort: (field: SortField) => void;
  onRetry: () => void;
  onSelectRequest: (request: PersonnelRequest) => void;
  onBatchDecision: (payload: BatchApprovalPayload) => Promise<void>;
}

const STATUS_BADGE: Record<
  RequestStatus,
  { label: string; className: string; dotClass: string }
> = {
  PENDING_REVIEW: {
    label: 'Pending Review',
    className: 'bg-amber-50/80 text-amber-700 ring-1 ring-amber-600/20',
    dotClass: 'bg-amber-500',
  },
  UNIT_VERIFIED: {
    label: 'Unit Verified',
    className: 'bg-blue-50/80 text-blue-700 ring-1 ring-blue-600/20',
    dotClass: 'bg-blue-500',
  },
  SECURITY_CLEARED: {
    label: 'Security Cleared',
    className: 'bg-purple-50/80 text-purple-700 ring-1 ring-purple-600/20',
    dotClass: 'bg-purple-500',
  },
  COMMAND_APPROVED: {
    label: 'Approved',
    className: 'bg-emerald-50/80 text-emerald-700 ring-1 ring-emerald-600/20',
    dotClass: 'bg-emerald-500',
  },
  REJECTED: {
    label: 'Rejected',
    className: 'bg-rose-50/80 text-rose-700 ring-1 ring-rose-600/20',
    dotClass: 'bg-rose-500',
  },
};

const PRIORITY_BADGE: Record<PriorityLevel, { label: string; className: string }> = {
  ROUTINE: {
    label: 'Routine',
    className: 'bg-slate-100 text-slate-600',
  },
  PRIORITY: {
    label: 'Priority',
    className: 'bg-orange-50 text-orange-700 ring-1 ring-orange-600/15',
  },
  CRITICAL: {
    label: 'Critical',
    className: 'bg-rose-50 text-rose-700 ring-1 ring-rose-600/15',
  },
};

const DEPARTMENTS = ['Operations', 'Engineering', 'Communications', 'Logistics'];

interface RequestRowProps {
  req: PersonnelRequest;
  nowMs: number;
  showSelectionColumn: boolean;
  actionable: boolean;
  checked: boolean;
  onToggleRow: (id: string) => void;
  onSelectRequest: (request: PersonnelRequest) => void;
}

const RequestRow = React.memo<RequestRowProps>(
  ({
    req,
    nowMs,
    showSelectionColumn,
    actionable,
    checked,
    onToggleRow,
    onSelectRequest,
  }) => {
    const statusInfo = STATUS_BADGE[req.status];
    const priorityInfo = PRIORITY_BADGE[req.priority];
    const sla = computeSlaSnapshot(req, nowMs);

    const slaBadgeClass =
      sla.health === 'BREACHED'
        ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-300 animate-pulse'
        : sla.health === 'WARNING'
        ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-300'
        : sla.health === 'ON_TRACK'
        ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
        : 'bg-slate-100 text-slate-500';

    return (
      <tr
        className={`transition-all ${
          checked
            ? 'bg-blue-50/50 shadow-[inset_2px_0_0_0_#2563eb]'
            : 'hover:bg-slate-50/90 hover:shadow-[inset_2px_0_0_0_#3b82f6]'
        }`}
      >
        {showSelectionColumn && (
          <td className="py-3.5 pl-4 pr-2">
            <input
              type="checkbox"
              aria-label={`Select ${req.referenceCode}`}
              checked={checked}
              disabled={!actionable}
              onChange={() => onToggleRow(req.id)}
              className="rounded border-slate-300 text-blue-600 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            />
          </td>
        )}
        <td className="py-3.5 px-4 whitespace-nowrap">
          <div className="font-mono text-xs font-semibold text-blue-600 tabular-nums">
            {req.referenceCode}
          </div>
          <div className="text-[10px] text-slate-400 tabular-nums">
            v{req.version} · RM {req.estimatedBudgetMyr.toLocaleString()}
          </div>
        </td>
        <td className="py-3.5 px-4">
          <div className="font-medium text-slate-900">{req.title}</div>
          <div className="text-xs text-slate-400 mt-0.5 tabular-nums">
            {req.submittedDate} · {req.submittedBy}
          </div>
        </td>
        <td className="py-3.5 px-4 text-xs text-slate-600 whitespace-nowrap">
          {req.department}
        </td>
        <td className="py-3.5 px-4 whitespace-nowrap">
          <span
            aria-label={`Priority: ${priorityInfo.label}`}
            className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold ${priorityInfo.className}`}
          >
            {priorityInfo.label}
          </span>
        </td>
        <td className="py-3.5 px-4 whitespace-nowrap">
          <span
            aria-label={`SLA: ${sla.label}`}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold tabular-nums ${slaBadgeClass}`}
          >
            <Clock className="w-3 h-3" />
            {sla.label}
          </span>
        </td>
        <td className="py-3.5 px-4 whitespace-nowrap">
          <span
            aria-label={`Status: ${statusInfo.label}`}
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${statusInfo.className}`}
          >
            <span
              aria-hidden="true"
              className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotClass}`}
            />
            {statusInfo.label}
          </span>
        </td>
        <td className="py-3.5 px-4 text-right whitespace-nowrap">
          <button
            type="button"
            onClick={() => onSelectRequest(req)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-[0.98] cursor-pointer ${
              actionable
                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-2xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
            }`}
          >
            {actionable ? (
              <>
                <CheckSquare className="w-3.5 h-3.5" /> Review
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5" /> Inspect
              </>
            )}
          </button>
        </td>
      </tr>
    );
  }
);

RequestRow.displayName = 'RequestRow';

export const RequestTable: React.FC<RequestTableProps> = ({
  requests,
  fetchStatus,
  errorMessage,
  currentRole,
  nowMs,
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  departmentFilter,
  onDepartmentFilterChange,
  slaBreachedOnly,
  onSlaBreachedOnlyChange,
  filterPresets,
  onApplyPreset,
  onSavePreset,
  onDeletePreset,
  onResetFilters,
  sortField,
  sortDirection,
  onToggleSort,
  onRetry,
  onSelectRequest,
  onBatchDecision,
}) => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchSubmitting, setBatchSubmitting] = useState(false);
  const [savingPreset, setSavingPreset] = useState(false);
  const [presetName, setPresetName] = useState('');

  const totalPages = Math.max(1, Math.ceil(requests.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const paginatedRequests = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return requests.slice(start, start + pageSize);
  }, [requests, safePage, pageSize]);

  const showSelectionColumn = currentRole !== 'REQUESTER';

  const eligibleOnPage = useMemo(
    () => paginatedRequests.filter((r) => canRoleActOnRequest(r, currentRole)),
    [paginatedRequests, currentRole]
  );

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedRequests = useMemo(
    () =>
      requests.filter(
        (r) => selectedSet.has(r.id) && canRoleActOnRequest(r, currentRole)
      ),
    [requests, selectedSet, currentRole]
  );

  const allEligibleSelected =
    eligibleOnPage.length > 0 &&
    eligibleOnPage.every((r) => selectedSet.has(r.id));

  const toggleSelectAllOnPage = useCallback(() => {
    if (allEligibleSelected) {
      const pageIds = new Set(eligibleOnPage.map((r) => r.id));
      setSelectedIds((prev) => prev.filter((id) => !pageIds.has(id)));
    } else {
      setSelectedIds((prev) => {
        const merged = new Set(prev);
        eligibleOnPage.forEach((r) => merged.add(r.id));
        return Array.from(merged);
      });
    }
  }, [allEligibleSelected, eligibleOnPage]);

  const toggleRow = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }, []);

  const canBatchVerify =
    currentRole === 'UNIT_REVIEWER' &&
    selectedRequests.length > 0 &&
    selectedRequests.every((r) => r.status === 'PENDING_REVIEW');

  const canBatchSecurityClear =
    currentRole === 'SECURITY_OFFICER' &&
    selectedRequests.length > 0 &&
    selectedRequests.every(
      (r) => r.status === 'UNIT_VERIFIED' && requiresSecurityClearance(r)
    );

  const canBatchApprove =
    currentRole === 'COMMAND_APPROVER' &&
    selectedRequests.length > 0 &&
    selectedRequests.every((r) =>
      requiresSecurityClearance(r)
        ? r.status === 'SECURITY_CLEARED'
        : r.status === 'UNIT_VERIFIED'
    );

  const canBatchReject = selectedRequests.length > 0;

  const handleBatch = async (
    decision: 'VERIFY' | 'CLEAR_SECURITY' | 'APPROVE' | 'REJECT'
  ) => {
    if (selectedRequests.length === 0) return;
    setBatchSubmitting(true);
    try {
      await onBatchDecision({
        requestIds: selectedRequests.map((r) => r.id),
        decision,
        remarks: `Batch ${decision.toLowerCase()} executed via portal (${selectedRequests.length} items).`,
        actorRole: currentRole,
      });
      setSelectedIds([]);
    } catch {
      // Rollback & error notification handled by hook/App
    } finally {
      setBatchSubmitting(false);
    }
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-blue-600" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
    );
  };

  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    statusFilter !== 'ALL' ||
    departmentFilter !== 'ALL' ||
    slaBreachedOnly;

  return (
    <div className="space-y-3">
      {/* Saved Filter Preset Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mr-1">
            Presets:
          </span>
          {filterPresets.map((preset) => {
            const isPresetActive =
              searchQuery === preset.searchQuery &&
              statusFilter === preset.statusFilter &&
              departmentFilter === preset.departmentFilter &&
              slaBreachedOnly === Boolean(preset.slaBreachedOnly);

            return (
              <div
                key={preset.id}
                className={`inline-flex items-center rounded-lg text-xs transition-all ${
                  isPresetActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white text-slate-600 ring-1 ring-slate-900/10 hover:bg-slate-50'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    onApplyPreset(preset);
                    setPage(1);
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 font-medium cursor-pointer"
                >
                  <Bookmark className="w-3 h-3 opacity-70" />
                  {preset.name}
                </button>
                {!preset.isDefault && (
                  <button
                    type="button"
                    aria-label={`Delete preset ${preset.name}`}
                    onClick={() => onDeletePreset(preset.id)}
                    className="pr-2 pl-0.5 opacity-60 hover:opacity-100 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {hasActiveFilters && !savingPreset && (
          <button
            type="button"
            onClick={() => setSavingPreset(true)}
            className="text-xs font-medium text-blue-600 hover:text-blue-700 cursor-pointer"
          >
            + Save Current Filters
          </button>
        )}

        {savingPreset && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!presetName.trim()) return;
              onSavePreset(presetName);
              setPresetName('');
              setSavingPreset(false);
            }}
            className="flex items-center gap-1.5"
          >
            <input
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Preset name..."
              className="px-2.5 py-1 text-xs bg-white rounded-md ring-1 ring-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="px-2.5 py-1 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 cursor-pointer"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setSavingPreset(false)}
              className="px-2 py-1 text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
            >
              Cancel
            </button>
          </form>
        )}
      </div>

      {/* Quick-Clear Filter Chips */}
      {hasActiveFilters && (
        <div
          aria-label="Active filters"
          className="flex flex-wrap items-center gap-2 text-xs"
        >
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Active Filters:
          </span>

          {searchQuery.trim() && (
            <button
              type="button"
              onClick={() => {
                onSearchChange('');
                setPage(1);
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white ring-1 ring-slate-900/10 text-slate-700 hover:bg-slate-50 active:scale-[0.98] transition-all cursor-pointer"
            >
              <span>Search: &ldquo;{searchQuery.trim()}&rdquo;</span>
              <X className="w-3 h-3 text-slate-400" />
            </button>
          )}

          {statusFilter !== 'ALL' && (
            <button
              type="button"
              onClick={() => {
                onStatusFilterChange('ALL');
                setPage(1);
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white ring-1 ring-slate-900/10 text-slate-700 hover:bg-slate-50 active:scale-[0.98] transition-all cursor-pointer"
            >
              <span>Status: {STATUS_BADGE[statusFilter].label}</span>
              <X className="w-3 h-3 text-slate-400" />
            </button>
          )}

          {departmentFilter !== 'ALL' && (
            <button
              type="button"
              onClick={() => {
                onDepartmentFilterChange('ALL');
                setPage(1);
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white ring-1 ring-slate-900/10 text-slate-700 hover:bg-slate-50 active:scale-[0.98] transition-all cursor-pointer"
            >
              <span>Dept: {departmentFilter}</span>
              <X className="w-3 h-3 text-slate-400" />
            </button>
          )}

          {slaBreachedOnly && (
            <button
              type="button"
              onClick={() => {
                onSlaBreachedOnlyChange(false);
                setPage(1);
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 ring-1 ring-rose-200 text-rose-700 hover:bg-rose-100 active:scale-[0.98] transition-all cursor-pointer"
            >
              <span>SLA: Breached Only</span>
              <X className="w-3 h-3" />
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              onResetFilters();
              setPage(1);
            }}
            className="text-xs font-medium text-blue-600 hover:text-blue-700 px-1.5 py-1 cursor-pointer"
          >
            Clear all
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl ring-1 ring-slate-900/5 overflow-hidden shadow-xs">
        {/* Filter Toolbar */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-slate-50/50">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              aria-label="Search requests by reference, title, or requester"
              value={searchQuery}
              onChange={(e) => {
                onSearchChange(e.target.value);
                setPage(1);
              }}
              placeholder="Search by reference, title, or requester..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-white rounded-lg ring-1 ring-slate-900/10 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) => {
                onStatusFilterChange(e.target.value as RequestStatus | 'ALL');
                setPage(1);
              }}
              className="px-3 py-2 text-xs font-medium bg-white rounded-lg ring-1 ring-slate-900/10 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING_REVIEW">Pending Review</option>
              <option value="UNIT_VERIFIED">Unit Verified</option>
              <option value="SECURITY_CLEARED">Security Cleared</option>
              <option value="COMMAND_APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>

            <select
              aria-label="Filter by department"
              value={departmentFilter}
              onChange={(e) => {
                onDepartmentFilterChange(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 text-xs font-medium bg-white rounded-lg ring-1 ring-slate-900/10 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="ALL">All Departments</option>
              {DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Batch Action Bar */}
        {showSelectionColumn && selectedRequests.length > 0 && (
          <div className="px-4 py-2.5 bg-blue-50/80 border-b border-blue-100 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-blue-900 tabular-nums">
              {selectedRequests.length} eligible request{selectedRequests.length > 1 ? 's' : ''} selected
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {canBatchVerify && (
                <button
                  type="button"
                  disabled={batchSubmitting}
                  onClick={() => handleBatch('VERIFY')}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 active:scale-[0.98] transition-all cursor-pointer"
                >
                  <CheckCheck className="w-3.5 h-3.5" /> Batch Verify
                </button>
              )}
              {canBatchSecurityClear && (
                <button
                  type="button"
                  disabled={batchSubmitting}
                  onClick={() => handleBatch('CLEAR_SECURITY')}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-700 disabled:opacity-50 active:scale-[0.98] transition-all cursor-pointer"
                >
                  <CheckCheck className="w-3.5 h-3.5" /> Batch Security Clear
                </button>
              )}
              {canBatchApprove && (
                <button
                  type="button"
                  disabled={batchSubmitting}
                  onClick={() => handleBatch('APPROVE')}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50 active:scale-[0.98] transition-all cursor-pointer"
                >
                  <CheckCheck className="w-3.5 h-3.5" /> Batch Approve
                </button>
              )}
              {canBatchReject && (
                <button
                  type="button"
                  disabled={batchSubmitting}
                  onClick={() => handleBatch('REJECT')}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-600 text-white font-medium hover:bg-rose-700 disabled:opacity-50 active:scale-[0.98] transition-all cursor-pointer"
                >
                  <XCircle className="w-3.5 h-3.5" /> Batch Reject
                </button>
              )}
              <button
                type="button"
                disabled={batchSubmitting}
                onClick={() => setSelectedIds([])}
                className="px-2.5 py-1.5 rounded-lg text-slate-600 hover:bg-blue-100 active:scale-[0.98] transition-all cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Content States */}
        {fetchStatus === 'loading' ? (
          <div className="overflow-x-auto" aria-label="Loading operational requests">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {showSelectionColumn && <th className="py-3 pl-4 pr-2 w-10" />}
                  <th className="py-3 px-4">Reference</th>
                  <th className="py-3 px-4">Request &amp; Submitter</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">SLA</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    {showSelectionColumn && (
                      <td className="py-4 pl-4 pr-2">
                        <div className="w-4 h-4 rounded bg-slate-200" />
                      </td>
                    )}
                    <td className="py-4 px-4">
                      <div className="h-3.5 w-24 rounded bg-slate-200" />
                    </td>
                    <td className="py-4 px-4 space-y-1.5">
                      <div className="h-3.5 w-56 rounded bg-slate-200" />
                      <div className="h-2.5 w-28 rounded bg-slate-100" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-3.5 w-20 rounded bg-slate-200" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-5 w-16 rounded-md bg-slate-200" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-5 w-20 rounded-md bg-slate-200" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-5 w-24 rounded-full bg-slate-200" />
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="h-7 w-20 rounded-lg bg-slate-200 ml-auto" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : fetchStatus === 'error' ? (
          <div className="py-14 px-4 flex flex-col items-center justify-center text-center gap-3">
            <div className="w-10 h-10 rounded-full bg-rose-50 ring-1 ring-rose-200 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight text-slate-900">
                Failed to fetch requests
              </p>
              <p className="text-xs text-rose-600 mt-0.5">{errorMessage}</p>
            </div>
            <button
              type="button"
              onClick={onRetry}
              className="px-4 py-1.5 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 active:scale-[0.98] transition-all cursor-pointer"
            >
              Retry Request
            </button>
          </div>
        ) : requests.length === 0 ? (
          <div className="py-16 px-4 flex flex-col items-center justify-center text-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 ring-1 ring-slate-900/5 flex items-center justify-center">
              <FileSearch className="w-6 h-6 text-slate-400" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight text-slate-900">
                No matching requests found
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">
                No operational records match your current search or filter criteria.
              </p>
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  onResetFilters();
                  setPage(1);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 active:scale-[0.98] transition-all cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset All Filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    {showSelectionColumn && (
                      <th className="py-3 pl-4 pr-2 w-10">
                        <input
                          type="checkbox"
                          aria-label="Select all eligible requests on page"
                          checked={allEligibleSelected}
                          disabled={eligibleOnPage.length === 0}
                          onChange={toggleSelectAllOnPage}
                          className="rounded border-slate-300 text-blue-600 cursor-pointer disabled:opacity-40"
                        />
                      </th>
                    )}
                    <th className="py-3 px-4">Reference</th>
                    <th className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => onToggleSort('submittedDate')}
                        aria-label="Sort by submitted date"
                        className="inline-flex items-center gap-1 hover:text-slate-800 cursor-pointer"
                      >
                        Request &amp; Submitter {renderSortIcon('submittedDate')}
                      </button>
                    </th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => onToggleSort('priority')}
                        aria-label="Sort by priority"
                        className="inline-flex items-center gap-1 hover:text-slate-800 cursor-pointer"
                      >
                        Priority {renderSortIcon('priority')}
                      </button>
                    </th>
                    <th className="py-3 px-4">SLA</th>
                    <th className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => onToggleSort('status')}
                        aria-label="Sort by status"
                        className="inline-flex items-center gap-1 hover:text-slate-800 cursor-pointer"
                      >
                        Status {renderSortIcon('status')}
                      </button>
                    </th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {paginatedRequests.map((req) => {
                    const actionable = canRoleActOnRequest(req, currentRole);
                    const checked = selectedSet.has(req.id) && actionable;
                    return (
                      <RequestRow
                        key={req.id}
                        req={req}
                        nowMs={nowMs}
                        showSelectionColumn={showSelectionColumn}
                        actionable={actionable}
                        checked={checked}
                        onToggleRow={toggleRow}
                        onSelectRequest={onSelectRequest}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
              <div className="flex items-center gap-2 tabular-nums">
                <span>
                  Showing{' '}
                  <strong className="text-slate-900">
                    {(safePage - 1) * pageSize + 1}
                  </strong>
                  –
                  <strong className="text-slate-900">
                    {Math.min(safePage * pageSize, requests.length)}
                  </strong>{' '}
                  of <strong className="text-slate-900">{requests.length}</strong>
                </span>
                <select
                  aria-label="Rows per page"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="px-2 py-1 bg-white rounded-md ring-1 ring-slate-900/10 text-xs cursor-pointer"
                >
                  <option value={5}>5 / page</option>
                  <option value={10}>10 / page</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 tabular-nums">
                <button
                  type="button"
                  aria-label="Previous page"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-white rounded-md ring-1 ring-slate-900/10 hover:bg-slate-100 disabled:opacity-40 active:scale-[0.98] transition-all cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Prev
                </button>
                <span className="px-2 font-medium text-slate-700">
                  Page {safePage} of {totalPages}
                </span>
                <button
                  type="button"
                  aria-label="Next page"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-white rounded-md ring-1 ring-slate-900/10 hover:bg-slate-100 disabled:opacity-40 active:scale-[0.98] transition-all cursor-pointer"
                >
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
