import React, { useCallback, useMemo, useState } from 'react';
import {
  Search,
  AlertCircle,
  Loader2,
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
} from 'lucide-react';
import type {
  AsyncStatus,
  BatchApprovalPayload,
  PersonnelRequest,
  PriorityLevel,
  RequestStatus,
  SortDirection,
  SortField,
  UserRole,
} from '../types/approval';

interface RequestTableProps {
  requests: PersonnelRequest[];
  fetchStatus: AsyncStatus;
  errorMessage: string | null;
  currentRole: UserRole;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: RequestStatus | 'ALL';
  onStatusFilterChange: (status: RequestStatus | 'ALL') => void;
  departmentFilter: string;
  onDepartmentFilterChange: (dept: string) => void;
  sortField: SortField;
  sortDirection: SortDirection;
  onToggleSort: (field: SortField) => void;
  onRetry: () => void;
  onSelectRequest: (request: PersonnelRequest) => void;
  onBatchDecision: (payload: BatchApprovalPayload) => Promise<void>;
}

const STATUS_BADGE: Record<RequestStatus, { label: string; className: string }> = {
  PENDING_REVIEW: {
    label: 'Pending Review',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  VERIFIED: {
    label: 'Verified',
    className: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  APPROVED: {
    label: 'Approved',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  REJECTED: {
    label: 'Rejected',
    className: 'bg-rose-50 text-rose-700 border-rose-200',
  },
};

const PRIORITY_BADGE: Record<PriorityLevel, { label: string; className: string }> = {
  ROUTINE: {
    label: 'Routine',
    className: 'bg-slate-100 text-slate-700',
  },
  PRIORITY: {
    label: 'Priority',
    className: 'bg-orange-100 text-orange-700',
  },
  CRITICAL: {
    label: 'Critical',
    className: 'bg-rose-100 text-rose-700',
  },
};

const DEPARTMENTS = ['Operations', 'Engineering', 'Communications', 'Logistics'];

function isRowEligible(req: PersonnelRequest, role: UserRole): boolean {
  if (role === 'UNIT_REVIEWER' && req.status === 'PENDING_REVIEW') return true;
  if (
    role === 'COMMAND_APPROVER' &&
    (req.status === 'PENDING_REVIEW' || req.status === 'VERIFIED')
  ) {
    return true;
  }
  return false;
}

interface RequestRowProps {
  req: PersonnelRequest;
  showSelectionColumn: boolean;
  actionable: boolean;
  checked: boolean;
  onToggleRow: (id: string) => void;
  onSelectRequest: (request: PersonnelRequest) => void;
}

const RequestRow = React.memo<RequestRowProps>(
  ({ req, showSelectionColumn, actionable, checked, onToggleRow, onSelectRequest }) => {
    const statusInfo = STATUS_BADGE[req.status];
    const priorityInfo = PRIORITY_BADGE[req.priority];

    return (
      <tr
        className={`transition-colors ${
          checked ? 'bg-blue-50/40' : 'hover:bg-slate-50/80'
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
        <td className="py-3.5 px-4 font-mono text-xs font-semibold text-blue-600 whitespace-nowrap">
          {req.referenceCode}
        </td>
        <td className="py-3.5 px-4">
          <div className="font-medium text-slate-900">{req.title}</div>
          <div className="text-xs text-slate-400 mt-0.5">{req.submittedDate}</div>
        </td>
        <td className="py-3.5 px-4 text-xs text-slate-700 whitespace-nowrap">
          {req.department}
        </td>
        <td className="py-3.5 px-4 text-xs text-slate-700 whitespace-nowrap">
          {req.submittedBy}
        </td>
        <td className="py-3.5 px-4 whitespace-nowrap">
          <span
            aria-label={`Priority: ${priorityInfo.label}`}
            className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold ${priorityInfo.className}`}
          >
            {priorityInfo.label}
          </span>
        </td>
        <td className="py-3.5 px-4 whitespace-nowrap">
          <span
            aria-label={`Status: ${statusInfo.label}`}
            className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${statusInfo.className}`}
          >
            {statusInfo.label}
          </span>
        </td>
        <td className="py-3.5 px-4 text-right whitespace-nowrap">
          <button
            type="button"
            onClick={() => onSelectRequest(req)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              actionable
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
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
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  departmentFilter,
  onDepartmentFilterChange,
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

  const totalPages = Math.max(1, Math.ceil(requests.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const paginatedRequests = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return requests.slice(start, start + pageSize);
  }, [requests, safePage, pageSize]);

  const showSelectionColumn = currentRole !== 'REQUESTER';

  const eligibleOnPage = useMemo(
    () => paginatedRequests.filter((r) => isRowEligible(r, currentRole)),
    [paginatedRequests, currentRole]
  );

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedRequests = useMemo(
    () => requests.filter((r) => selectedSet.has(r.id) && isRowEligible(r, currentRole)),
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

  const canBatchApprove =
    currentRole === 'COMMAND_APPROVER' &&
    selectedRequests.length > 0 &&
    selectedRequests.every((r) => r.status === 'VERIFIED');

  const canBatchReject = selectedRequests.length > 0;

  const handleBatch = async (decision: 'VERIFY' | 'APPROVE' | 'REJECT') => {
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

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
      {/* Filter Toolbar */}
      <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-slate-50/60">
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
            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            className="px-3 py-2 text-xs font-medium bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING_REVIEW">Pending Review</option>
            <option value="VERIFIED">Verified</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>

          <select
            aria-label="Filter by department"
            value={departmentFilter}
            onChange={(e) => {
              onDepartmentFilterChange(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-xs font-medium bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
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
        <div className="px-4 py-2.5 bg-blue-50 border-b border-blue-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-blue-900">
            {selectedRequests.length} eligible request{selectedRequests.length > 1 ? 's' : ''} selected
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {canBatchVerify && (
              <button
                type="button"
                disabled={batchSubmitting}
                onClick={() => handleBatch('VERIFY')}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" /> Batch Verify
              </button>
            )}
            {canBatchApprove && (
              <button
                type="button"
                disabled={batchSubmitting}
                onClick={() => handleBatch('APPROVE')}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" /> Batch Approve
              </button>
            )}
            {canBatchReject && (
              <button
                type="button"
                disabled={batchSubmitting}
                onClick={() => handleBatch('REJECT')}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-600 text-white font-medium hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
              >
                <XCircle className="w-3.5 h-3.5" /> Batch Reject
              </button>
            )}
            <button
              type="button"
              disabled={batchSubmitting}
              onClick={() => setSelectedIds([])}
              className="px-2.5 py-1.5 rounded-lg text-slate-600 hover:bg-blue-100 cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Content States */}
      {fetchStatus === 'loading' ? (
        <div className="py-16 flex flex-col items-center justify-center text-slate-500 gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="text-sm">Loading operational requests...</span>
        </div>
      ) : fetchStatus === 'error' ? (
        <div className="py-14 px-4 flex flex-col items-center justify-center text-center gap-3">
          <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-rose-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Failed to fetch requests</p>
            <p className="text-xs text-rose-600 mt-0.5">{errorMessage}</p>
          </div>
          <button
            type="button"
            onClick={onRetry}
            className="px-4 py-1.5 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            Retry Request
          </button>
        </div>
      ) : requests.length === 0 ? (
        <div className="py-16 px-4 flex flex-col items-center justify-center text-center text-slate-500 gap-2">
          <FileSearch className="w-7 h-7 text-slate-300" />
          <p className="text-sm font-medium text-slate-700">No matching requests found</p>
          <p className="text-xs text-slate-400">
            Try adjusting your search query or filter selections.
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
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
                      Request & Date {renderSortIcon('submittedDate')}
                    </button>
                  </th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Submitted By</th>
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
              <tbody className="divide-y divide-slate-200 text-sm">
                {paginatedRequests.map((req) => {
                  const actionable = isRowEligible(req, currentRole);
                  const checked = selectedSet.has(req.id) && actionable;
                  return (
                    <RequestRow
                      key={req.id}
                      req={req}
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
          <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/60 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-2">
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
                className="px-2 py-1 bg-white border border-slate-300 rounded-md text-xs cursor-pointer"
              >
                <option value={5}>5 / page</option>
                <option value={10}>10 / page</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                aria-label="Previous page"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-300 rounded-md hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
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
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-300 rounded-md hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
