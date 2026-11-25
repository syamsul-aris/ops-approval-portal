import React, { useRef, useState } from 'react';
import { X, CheckCircle2, XCircle, AlertTriangle, Loader2, ArrowRight, ArrowLeft } from 'lucide-react';
import type { ApprovalPayload, AsyncStatus, PersonnelRequest, UserRole } from '../types/approval';
import { useModalA11y } from '../hooks/useModalA11y';
import { containsUnsafeMarkup, sanitizeTextInput } from '../utils/sanitize';

const REMARKS_MIN = 8;
const REMARKS_MAX = 300;

interface ApprovalModalProps {
  request: PersonnelRequest;
  currentRole: UserRole;
  onClose: () => void;
  onSubmit: (payload: ApprovalPayload) => Promise<void>;
}

export const ApprovalModal: React.FC<ApprovalModalProps> = ({
  request,
  currentRole,
  onClose,
  onSubmit,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  useModalA11y(modalRef, onClose);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [decision, setDecision] = useState<'VERIFY' | 'APPROVE' | 'REJECT' | null>(null);
  const [remarks, setRemarks] = useState('');
  const [submitState, setSubmitState] = useState<AsyncStatus>('idle');
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Determine allowed action based on Role + Current Request Status
  const canVerify = currentRole === 'UNIT_REVIEWER' && request.status === 'PENDING_REVIEW';
  const canApprove = currentRole === 'COMMAND_APPROVER' && request.status === 'VERIFIED';
  const canReject =
    (currentRole === 'UNIT_REVIEWER' && request.status === 'PENDING_REVIEW') ||
    (currentRole === 'COMMAND_APPROVER' && ['PENDING_REVIEW', 'VERIFIED'].includes(request.status));
  const hasActionPermission = canVerify || canApprove || canReject;

  const trimmedRemarks = remarks.trim();
  const hasUnsafeRemarks = containsUnsafeMarkup(remarks);
  const remarksValid =
    trimmedRemarks.length >= REMARKS_MIN &&
    trimmedRemarks.length <= REMARKS_MAX &&
    !hasUnsafeRemarks;

  const handleConfirmSubmit = async () => {
    if (!decision || !remarksValid) return;
    setSubmitState('loading');
    setSubmitError(null);
    try {
      await onSubmit({
        requestId: request.id,
        decision,
        remarks: sanitizeTextInput(remarks, REMARKS_MAX),
        actorRole: currentRole,
      });
      setSubmitState('success');
      setTimeout(onClose, 900);
    } catch (err) {
      setSubmitState('error');
      setSubmitError(err instanceof Error ? err.message : 'Submission failed.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="approval-modal-title"
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div>
            <span className="text-xs font-mono font-semibold text-blue-600">
              {request.referenceCode}
            </span>
            <h3 id="approval-modal-title" className="text-base font-semibold text-slate-900">
              {request.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close approval modal"
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper Indicator */}
        <div className="grid grid-cols-3 border-b border-slate-200 bg-white text-xs font-medium">
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

        {/* Body */}
        <div className="p-6 min-h-[260px]">
          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div>
                  <span className="text-slate-500 block text-xs">Submitted By</span>
                  <span className="font-medium text-slate-900">{request.submittedBy}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-xs">Department</span>
                  <span className="font-medium text-slate-900">{request.department}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-500 block text-xs">Operational Justification</span>
                  <p className="text-slate-800 mt-0.5">{request.justification}</p>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                  Approval Audit Trail
                </h4>
                {request.auditTrail.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No prior audit entries recorded.</p>
                ) : (
                  <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                    {request.auditTrail.map((log) => (
                      <div
                        key={log.id}
                        className="text-xs bg-white border border-slate-200 rounded-md p-2.5 flex justify-between items-start"
                      >
                        <div>
                          <span className="font-semibold text-slate-800">{log.actorName}</span>{' '}
                          <span className="text-slate-500">({log.actorRole})</span>
                          <p className="text-slate-600 mt-0.5">{log.remarks}</p>
                        </div>
                        <span className="text-[11px] font-mono text-slate-400 shrink-0">
                          {log.timestamp}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <label className="block text-sm font-medium text-slate-800">
                Select Workflow Action ({currentRole.replace('_', ' ')})
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {canVerify && (
                  <button
                    type="button"
                    onClick={() => setDecision('VERIFY')}
                    className={`p-3.5 rounded-lg border text-left transition-all cursor-pointer ${
                      decision === 'VERIFY'
                        ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-600/20'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-semibold text-sm text-blue-700">Verify & Forward</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Confirm compliance and route to Command Approver.
                    </div>
                  </button>
                )}

                {canApprove && (
                  <button
                    type="button"
                    onClick={() => setDecision('APPROVE')}
                    className={`p-3.5 rounded-lg border text-left transition-all cursor-pointer ${
                      decision === 'APPROVE'
                        ? 'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-600/20'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-semibold text-sm text-emerald-700">Final Approve</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Authorize request for immediate execution.
                    </div>
                  </button>
                )}

                {canReject && (
                  <button
                    type="button"
                    onClick={() => setDecision('REJECT')}
                    className={`p-3.5 rounded-lg border text-left transition-all cursor-pointer ${
                      decision === 'REJECT'
                        ? 'border-rose-600 bg-rose-50 ring-2 ring-rose-600/20'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-semibold text-sm text-rose-700">Reject Request</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Return request with mandatory deficiency remarks.
                    </div>
                  </button>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-slate-800">
                    Official Remarks <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[11px] text-slate-400">
                    {trimmedRemarks.length}/{REMARKS_MAX}
                  </span>
                </div>
                <textarea
                  rows={3}
                  maxLength={REMARKS_MAX}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Enter verification notes or rejection reason (min 8 characters)..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900">
                  <p className="font-semibold">Confirm State Transition</p>
                  <p className="mt-1">
                    You are about to mark <strong>{request.referenceCode}</strong> as{' '}
                    <strong>{decision}</strong>. This action will be appended to the immutable audit log.
                  </p>
                </div>
              </div>

              <div className="text-sm border border-slate-200 rounded-lg p-4 space-y-2">
                <div>
                  <span className="text-slate-500 text-xs block">Acting Role</span>
                  <span className="font-mono text-xs font-semibold">{currentRole}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-xs block">Recorded Remarks</span>
                  <p className="text-slate-800">{remarks}</p>
                </div>
              </div>

              {submitState === 'error' && (
                <div className="flex items-center gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 p-3 rounded-lg">
                  <XCircle className="w-4 h-4 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              {submitState === 'success' && (
                <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 p-3 rounded-lg">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Workflow updated successfully. Syncing table...</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          {step > 1 ? (
            <button
              type="button"
              disabled={submitState === 'loading'}
              onClick={() => setStep((s) => (s === 3 ? 2 : 1))}
              className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
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
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200/70 rounded-lg cursor-pointer"
            >
              Close
            </button>

            {step === 1 && hasActionPermission && (
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer"
              >
                Proceed to Review <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {step === 2 && (
              <button
                type="button"
                disabled={!decision || !remarksValid}
                onClick={() => setStep(3)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 cursor-pointer"
              >
                Review Summary <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {step === 3 && (
              <button
                type="button"
                disabled={submitState === 'loading' || submitState === 'success'}
                onClick={handleConfirmSubmit}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
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