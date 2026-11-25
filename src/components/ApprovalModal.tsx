import React, { useRef, useState } from 'react';
import {
  X,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Check,
  Clock,
  GitCompareArrows,
  RefreshCw,
} from 'lucide-react';
import type {
  ApprovalPayload,
  AsyncStatus,
  PersonnelRequest,
  UserRole,
  WorkflowDecision,
} from '../types/approval';
import { useModalA11y } from '../hooks/useModalA11y';
import { containsUnsafeMarkup, sanitizeTextInput } from '../utils/sanitize';
import {
  getAllowedDecisions,
  getWorkflowGates,
  requiresSecurityClearance,
} from '../domain/workflowMachine';
import { ApiError } from '../services/mockApprovalApi';

const REMARKS_MIN = 8;
const REMARKS_MAX = 300;

interface ApprovalModalProps {
  request: PersonnelRequest;
  currentRole: UserRole;
  onClose: () => void;
  onReloadRequest?: (latest: PersonnelRequest) => void;
  onSubmit: (payload: ApprovalPayload) => Promise<void>;
}

const ROLE_AVATAR_STYLES: Record<
  UserRole,
  { bg: string; initials: string; label: string }
> = {
  REQUESTER: {
    bg: 'bg-indigo-100 text-indigo-700 ring-indigo-200',
    initials: 'RQ',
    label: 'Requester',
  },
  UNIT_REVIEWER: {
    bg: 'bg-blue-100 text-blue-700 ring-blue-200',
    initials: 'UR',
    label: 'Unit Reviewer',
  },
  SECURITY_OFFICER: {
    bg: 'bg-purple-100 text-purple-700 ring-purple-200',
    initials: 'SO',
    label: 'Security Officer',
  },
  COMMAND_APPROVER: {
    bg: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
    initials: 'CA',
    label: 'Command Approver',
  },
};

const DECISION_META: Record<
  WorkflowDecision,
  { title: string; desc: string; activeRing: string; titleColor: string }
> = {
  VERIFY: {
    title: 'Verify & Forward',
    desc: 'Confirm unit compliance and route to the next approval gate.',
    activeRing: 'ring-2 ring-blue-600 bg-blue-50/70',
    titleColor: 'text-blue-700',
  },
  CLEAR_SECURITY: {
    title: 'Grant Security Clearance',
    desc: 'Authorize high-priority / >RM 50k request for Command Approval.',
    activeRing: 'ring-2 ring-purple-600 bg-purple-50/70',
    titleColor: 'text-purple-700',
  },
  APPROVE: {
    title: 'Final Approve',
    desc: 'Authorize request for immediate operational execution.',
    activeRing: 'ring-2 ring-emerald-600 bg-emerald-50/70',
    titleColor: 'text-emerald-700',
  },
  REJECT: {
    title: 'Reject Request',
    desc: 'Return request with mandatory deficiency remarks.',
    activeRing: 'ring-2 ring-rose-600 bg-rose-50/70',
    titleColor: 'text-rose-700',
  },
};

export const ApprovalModal: React.FC<ApprovalModalProps> = ({
  request,
  currentRole,
  onClose,
  onReloadRequest,
  onSubmit,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  useModalA11y(modalRef, onClose);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [decision, setDecision] = useState<WorkflowDecision | null>(null);
  const [remarks, setRemarks] = useState('');
  const [submitState, setSubmitState] = useState<AsyncStatus>('idle');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [conflictLatest, setConflictLatest] = useState<PersonnelRequest | null>(
    null
  );

  const allowedDecisions = getAllowedDecisions(request, currentRole);
  const hasActionPermission = allowedDecisions.length > 0;
  const gates = getWorkflowGates(request);
  const threeTier = requiresSecurityClearance(request);

  const trimmedRemarks = remarks.trim();
  const hasUnsafeRemarks = containsUnsafeMarkup(remarks);
  const remarksValid =
    trimmedRemarks.length >= REMARKS_MIN &&
    trimmedRemarks.length <= REMARKS_MAX &&
    !hasUnsafeRemarks;

  const submitWithVersion = async (forceOverride = false) => {
    if (!decision || !remarksValid) return;
    setSubmitState('loading');
    setSubmitError(null);
    setConflictLatest(null);
    try {
      await onSubmit({
        requestId: request.id,
        decision,
        remarks: sanitizeTextInput(remarks, REMARKS_MAX),
        actorRole: currentRole,
        expectedVersion: request.version,
        forceOverride,
      });
      setSubmitState('success');
      setTimeout(onClose, 900);
    } catch (err) {
      setSubmitState('error');
      if (err instanceof ApiError && err.statusCode === 409 && err.latestRequest) {
        setConflictLatest(err.latestRequest);
      }
      setSubmitError(err instanceof Error ? err.message : 'Submission failed.');
    }
  };

  const handleReloadLatest = () => {
    if (!conflictLatest) return;
    onReloadRequest?.(conflictLatest);
    setConflictLatest(null);
    setSubmitState('idle');
    setSubmitError(null);
    setStep(1);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/35 backdrop-blur-xs transition-opacity"
      role="dialog"
      aria-modal="true"
      aria-labelledby="approval-modal-title"
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className="bg-white h-full w-full max-w-xl shadow-2xl ring-1 ring-slate-900/10 flex flex-col outline-none animate-slide-in-right"
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-slate-200/80 bg-slate-50/70">
          <div className="pr-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono font-semibold text-blue-600 tabular-nums">
                {request.referenceCode}
              </span>
              <span className="text-[11px] text-slate-400 tabular-nums">
                {request.submittedDate} · v{request.version}
              </span>
              {threeTier && (
                <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 ring-1 ring-purple-200 text-[10px] font-semibold">
                  3-Tier Gate
                </span>
              )}
            </div>
            <h3
              id="approval-modal-title"
              className="text-base font-semibold tracking-tight text-slate-900 mt-1"
            >
              {request.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close approval modal"
            className="text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 p-1.5 rounded-lg transition-all active:scale-[0.98] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper Indicator */}
        <div className="grid grid-cols-3 border-b border-slate-200/80 bg-white text-xs font-medium shrink-0">
          {[
            { num: 1, label: '1. Inspect & Audit' },
            { num: 2, label: '2. Decision & Remarks' },
            { num: 3, label: '3. Sign-Off' },
          ].map((s) => (
            <div
              key={s.num}
              className={`py-2.5 text-center border-b-2 transition-colors ${
                step === s.num
                  ? 'border-blue-600 text-blue-600 bg-blue-50/40'
                  : step > s.num
                  ? 'border-emerald-500 text-emerald-700'
                  : 'border-transparent text-slate-400'
              }`}
            >
              {s.label}
            </div>
          ))}
        </div>

        {/* Scrollable Body */}
        <div className="p-6 flex-1 overflow-y-auto">
          {step === 1 && (
            <div className="space-y-6">
              {/* Visual Workflow Gate Indicator */}
              <div className="bg-slate-50/80 rounded-xl p-4 ring-1 ring-slate-900/5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Required Workflow Path ({threeTier ? '3-Tier' : '2-Tier'})
                  </span>
                  <span className="text-[11px] font-medium text-slate-500 tabular-nums">
                    RM {request.estimatedBudgetMyr.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-1.5">
                  {gates.map((gate, idx) => (
                    <React.Fragment key={gate.key}>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0 ${
                            gate.state === 'rejected'
                              ? 'bg-rose-600 text-white'
                              : gate.state === 'completed'
                              ? 'bg-emerald-600 text-white'
                              : gate.state === 'current'
                              ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                              : 'bg-slate-200 text-slate-500'
                          }`}
                        >
                          {gate.state === 'rejected' ? (
                            <X className="w-3.5 h-3.5" />
                          ) : gate.state === 'completed' ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : (
                            <Clock className="w-3 h-3" />
                          )}
                        </span>
                        <span
                          className={`text-[11px] font-medium truncate ${
                            gate.state === 'rejected'
                              ? 'text-rose-700'
                              : gate.state === 'completed' || gate.state === 'current'
                              ? 'text-slate-900'
                              : 'text-slate-400'
                          }`}
                        >
                          {gate.label}
                        </span>
                      </div>
                      {idx < gates.length - 1 && (
                        <div
                          className={`h-px flex-1 min-w-2 ${
                            gates[idx + 1].state === 'completed' ||
                            gates[idx + 1].state === 'current'
                              ? 'bg-blue-300'
                              : 'bg-slate-200'
                          }`}
                        />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* Request Metadata */}
              <div className="grid grid-cols-2 gap-4 text-sm bg-white p-4 rounded-xl ring-1 ring-slate-900/5 shadow-2xs">
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                    Submitted By
                  </span>
                  <span className="font-medium text-slate-900 text-xs mt-0.5 block">
                    {request.submittedBy}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                    Department &amp; Budget
                  </span>
                  <span className="font-medium text-slate-900 text-xs mt-0.5 block tabular-nums">
                    {request.department} · RM {request.estimatedBudgetMyr.toLocaleString()}
                  </span>
                </div>
                <div className="col-span-2 pt-2 border-t border-slate-100">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                    Operational Justification
                  </span>
                  <p className="text-slate-700 text-xs leading-relaxed mt-1">
                    {request.justification}
                  </p>
                </div>
              </div>

              {/* Vertical Connected Audit Timeline */}
              <div>
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-3">
                  Approval Audit Trail
                </h4>
                {request.auditTrail.length === 0 ? (
                  <p className="text-xs text-slate-400 italic bg-slate-50 rounded-lg p-3 ring-1 ring-slate-900/5">
                    No prior audit entries recorded.
                  </p>
                ) : (
                  <div className="relative pl-5 space-y-4">
                    <div
                      aria-hidden="true"
                      className="absolute left-[13px] top-2 bottom-2 w-px bg-slate-200"
                    />
                    {request.auditTrail.map((log) => {
                      const avatar = ROLE_AVATAR_STYLES[log.actorRole];
                      return (
                        <div key={log.id} className="relative flex gap-3 items-start">
                          <span
                            className={`-ml-5 w-7 h-7 rounded-full ring-2 flex items-center justify-center text-[10px] font-bold shrink-0 z-10 ${avatar.bg}`}
                          >
                            {avatar.initials}
                          </span>
                          <div className="flex-1 bg-white ring-1 ring-slate-900/5 rounded-xl p-3 shadow-2xs">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-xs">
                                <span className="font-semibold text-slate-900">
                                  {log.actorName}
                                </span>{' '}
                                <span className="text-[11px] text-slate-500">
                                  · {avatar.label}
                                </span>
                              </div>
                              <span className="text-[11px] font-mono text-slate-400 tabular-nums shrink-0">
                                {log.timestamp}
                              </span>
                            </div>
                            <div className="mt-1.5 flex items-center gap-2">
                              <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-100 text-slate-700">
                                {log.action}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                              {log.remarks}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Select Workflow Action ({currentRole.replace('_', ' ')})
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {allowedDecisions.map((opt) => {
                  const meta = DECISION_META[opt];
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setDecision(opt)}
                      className={`p-3.5 rounded-xl ring-1 text-left transition-all active:scale-[0.98] cursor-pointer ${
                        decision === opt
                          ? meta.activeRing
                          : 'ring-slate-200 hover:ring-slate-300 bg-white'
                      }`}
                    >
                      <div className={`font-semibold text-sm ${meta.titleColor}`}>
                        {meta.title}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">{meta.desc}</div>
                    </button>
                  );
                })}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Official Remarks <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[11px] text-slate-400 tabular-nums">
                    {trimmedRemarks.length}/{REMARKS_MAX}
                  </span>
                </div>
                <textarea
                  rows={4}
                  maxLength={REMARKS_MAX}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Enter verification notes or rejection reason (min 8 characters)..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {hasUnsafeRemarks && (
                  <p className="text-xs text-rose-600 mt-1">
                    HTML tags, scripts, and inline event handlers are not permitted in audit remarks.
                  </p>
                )}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="bg-amber-50 ring-1 ring-amber-200 rounded-xl p-4 flex gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900">
                  <p className="font-semibold">Confirm State Transition</p>
                  <p className="mt-1">
                    You are about to mark{' '}
                    <strong className="tabular-nums">{request.referenceCode}</strong>{' '}
                    (v{request.version}) as <strong>{decision}</strong>. This action will be appended to the immutable audit log.
                  </p>
                </div>
              </div>

              <div className="text-sm ring-1 ring-slate-900/5 rounded-xl p-4 space-y-3 bg-slate-50/50">
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                    Acting Role
                  </span>
                  <span className="font-mono text-xs font-semibold text-slate-800">
                    {currentRole}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                    Recorded Remarks
                  </span>
                  <p className="text-slate-800 text-xs mt-0.5">{remarks}</p>
                </div>
              </div>

              {/* 409 Optimistic Concurrency Conflict Diff & Resolve Banner */}
              {conflictLatest && (
                <div
                  role="alert"
                  className="bg-rose-50/90 ring-1 ring-rose-300 rounded-xl p-4 space-y-3"
                >
                  <div className="flex items-start gap-2.5 text-xs text-rose-900">
                    <GitCompareArrows className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">
                        Concurrent Edit Conflict (409) — Diff &amp; Resolve
                      </p>
                      <p className="text-rose-700 mt-0.5">
                        Another session modified this record while your drawer was open.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="bg-white rounded-lg p-2.5 ring-1 ring-rose-200">
                      <span className="font-semibold text-slate-500 block uppercase text-[10px]">
                        Your Snapshot (v{request.version})
                      </span>
                      <p className="mt-1 text-slate-800 tabular-nums">
                        Budget: RM {request.estimatedBudgetMyr.toLocaleString()}
                      </p>
                      <p className="text-slate-600">Status: {request.status}</p>
                    </div>
                    <div className="bg-white rounded-lg p-2.5 ring-1 ring-amber-300">
                      <span className="font-semibold text-amber-700 block uppercase text-[10px]">
                        Server Latest (v{conflictLatest.version})
                      </span>
                      <p className="mt-1 text-slate-900 font-medium tabular-nums">
                        Budget: RM {conflictLatest.estimatedBudgetMyr.toLocaleString()}
                      </p>
                      <p className="text-slate-600">
                        {conflictLatest.auditTrail.at(-1)?.remarks ?? 'Updated'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleReloadLatest}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white ring-1 ring-slate-300 text-xs font-medium text-slate-800 hover:bg-slate-50 active:scale-[0.98] transition-all cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Reload Latest Version
                    </button>
                    <button
                      type="button"
                      onClick={() => submitWithVersion(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-medium hover:bg-rose-700 active:scale-[0.98] transition-all cursor-pointer"
                    >
                      Force Override
                    </button>
                  </div>
                </div>
              )}

              {submitState === 'error' && !conflictLatest && (
                <div className="flex items-center gap-2 text-xs text-rose-700 bg-rose-50 ring-1 ring-rose-200 p-3 rounded-xl">
                  <XCircle className="w-4 h-4 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              {submitState === 'success' && (
                <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200 p-3 rounded-xl">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Workflow updated successfully. Syncing table...</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-200/80 flex items-center justify-between shrink-0">
          {step > 1 ? (
            <button
              type="button"
              disabled={submitState === 'loading'}
              onClick={() => setStep((s) => (s === 3 ? 2 : 1))}
              className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 active:scale-[0.98] transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          ) : (
            <span className="text-xs text-slate-500">
              {!hasActionPermission && 'Read-only view for current role/status'}
            </span>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200/70 rounded-lg active:scale-[0.98] transition-all cursor-pointer"
            >
              Close
            </button>

            {step === 1 && hasActionPermission && (
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:scale-[0.98] transition-all cursor-pointer"
              >
                Proceed to Review <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {step === 2 && (
              <button
                type="button"
                disabled={!decision || !remarksValid}
                onClick={() => setStep(3)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 active:scale-[0.98] transition-all cursor-pointer"
              >
                Review Summary <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {step === 3 && !conflictLatest && (
              <button
                type="button"
                disabled={submitState === 'loading' || submitState === 'success'}
                onClick={() => submitWithVersion(false)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 active:scale-[0.98] transition-all cursor-pointer"
              >
                {submitState === 'loading' && <Loader2 className="w-4 h-4 animate-spin" />}
                {submitState === 'loading' ? 'Submitting...' : 'Confirm & Submit'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
