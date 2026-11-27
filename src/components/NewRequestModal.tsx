import React, { useRef, useState } from 'react';
import { X, Loader2, Send, AlertCircle, ShieldAlert } from 'lucide-react';
import type {
  CreateRequestPayload,
  PersonnelRequest,
  PriorityLevel,
} from '../types/approval';
import { useModalA11y } from '../hooks/useModalA11y';
import { containsUnsafeMarkup, sanitizeTextInput } from '../utils/sanitize';
import { HIGH_BUDGET_THRESHOLD_MYR } from '../domain/workflowMachine';

interface NewRequestModalProps {
  onClose: () => void;
  onCreate: (payload: CreateRequestPayload) => Promise<PersonnelRequest>;
}

const TITLE_MIN = 6;
const TITLE_MAX = 100;
const JUSTIFICATION_MIN = 15;
const JUSTIFICATION_MAX = 400;

export const NewRequestModal: React.FC<NewRequestModalProps> = ({
  onClose,
  onCreate,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  useModalA11y(modalRef, onClose);

  const [title, setTitle] = useState('');
  const [department, setDepartment] =
    useState<PersonnelRequest['department']>('Operations');
  const [priority, setPriority] = useState<PriorityLevel>('ROUTINE');
  const [budgetMyr, setBudgetMyr] = useState<string>('15000');
  const [submittedBy, setSubmittedBy] = useState('Lt. Amirul Hakim');
  const [justification, setJustification] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [touched, setTouched] = useState<{ title?: boolean; justification?: boolean }>({});

  const trimmedTitle = title.trim();
  const trimmedJustification = justification.trim();
  const parsedBudget = Number(budgetMyr) || 0;
  const triggersThreeTier =
    priority === 'CRITICAL' || parsedBudget > HIGH_BUDGET_THRESHOLD_MYR;

  const titleError = containsUnsafeMarkup(title)
    ? 'HTML tags or script markup are not permitted.'
    : trimmedTitle.length < TITLE_MIN
    ? `Title must be at least ${TITLE_MIN} characters.`
    : trimmedTitle.length > TITLE_MAX
    ? `Title cannot exceed ${TITLE_MAX} characters.`
    : null;

  const justificationError = containsUnsafeMarkup(justification)
    ? 'HTML tags or script markup are not permitted.'
    : trimmedJustification.length < JUSTIFICATION_MIN
    ? `Justification must be at least ${JUSTIFICATION_MIN} characters.`
    : trimmedJustification.length > JUSTIFICATION_MAX
    ? `Justification cannot exceed ${JUSTIFICATION_MAX} characters.`
    : null;

  const isValid =
    !titleError &&
    !justificationError &&
    submittedBy.trim().length > 0 &&
    parsedBudget >= 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ title: true, justification: true });
    if (!isValid) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      await onCreate({
        title: sanitizeTextInput(title, TITLE_MAX),
        department,
        priority,
        estimatedBudgetMyr: parsedBudget,
        justification: sanitizeTextInput(justification, JUSTIFICATION_MAX),
        submittedBy: sanitizeTextInput(submittedBy, 80),
      });
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/45 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-request-title"
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className="bg-white rounded-xl shadow-2xl ring-1 ring-slate-900/10 w-full max-w-xl overflow-hidden outline-none"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/80 bg-slate-50/70">
          <div>
            <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-blue-600">
              Requester Submission
            </span>
            <h3
              id="new-request-title"
              className="text-base font-semibold tracking-tight text-slate-900"
            >
              Submit New Operational Request
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close new request modal"
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg active:scale-[0.98] transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="req-title" className="text-xs font-semibold text-slate-700">
                Request Title <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-slate-400 tabular-nums">
                {trimmedTitle.length}/{TITLE_MAX}
              </span>
            </div>
            <input
              id="req-title"
              type="text"
              maxLength={TITLE_MAX}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, title: true }))}
              placeholder="e.g., Forward Relay Antenna Maintenance Window"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {touched.title && titleError && (
              <p className="text-xs text-rose-600 mt-1">{titleError}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="req-dept" className="block text-xs font-semibold text-slate-700 mb-1">
                Department <span className="text-rose-500">*</span>
              </label>
              <select
                id="req-dept"
                value={department}
                onChange={(e) =>
                  setDepartment(e.target.value as PersonnelRequest['department'])
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Operations">Operations</option>
                <option value="Engineering">Engineering</option>
                <option value="Communications">Communications</option>
                <option value="Logistics">Logistics</option>
              </select>
            </div>

            <div>
              <label htmlFor="req-priority" className="block text-xs font-semibold text-slate-700 mb-1">
                Priority Level <span className="text-rose-500">*</span>
              </label>
              <select
                id="req-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as PriorityLevel)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ROUTINE">Routine (72h SLA)</option>
                <option value="PRIORITY">Priority (24h SLA)</option>
                <option value="CRITICAL">Critical (4h SLA)</option>
              </select>
            </div>

            <div>
              <label htmlFor="req-budget" className="block text-xs font-semibold text-slate-700 mb-1">
                Est. Budget (RM)
              </label>
              <input
                id="req-budget"
                type="number"
                min={0}
                step={500}
                value={budgetMyr}
                onChange={(e) => setBudgetMyr(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {triggersThreeTier && (
            <div className="flex items-center gap-2 text-xs text-indigo-800 bg-indigo-50 ring-1 ring-indigo-200 px-3 py-2 rounded-lg">
              <ShieldAlert className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>
                <strong>3-Tier Routing Active:</strong> CRITICAL priority or budget &gt; RM 50,000 requires Security Officer clearance before Command Approval.
              </span>
            </div>
          )}

          <div>
            <label htmlFor="req-submitter" className="block text-xs font-semibold text-slate-700 mb-1">
              Submitted By <span className="text-rose-500">*</span>
            </label>
            <input
              id="req-submitter"
              type="text"
              value={submittedBy}
              onChange={(e) => setSubmittedBy(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="req-justification" className="text-xs font-semibold text-slate-700">
                Operational Justification <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-slate-400 tabular-nums">
                {trimmedJustification.length}/{JUSTIFICATION_MAX}
              </span>
            </div>
            <textarea
              id="req-justification"
              rows={3}
              maxLength={JUSTIFICATION_MAX}
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, justification: true }))}
              placeholder="Provide operational context, scope, and timeline (min 15 characters)..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {touched.justification && justificationError && (
              <p className="text-xs text-rose-600 mt-1">{justificationError}</p>
            )}
          </div>

          {submitError && (
            <div className="flex items-center gap-2 text-xs text-rose-700 bg-rose-50 ring-1 ring-rose-200 p-3 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg active:scale-[0.98] transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !isValid}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 active:scale-[0.98] transition-all cursor-pointer"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
