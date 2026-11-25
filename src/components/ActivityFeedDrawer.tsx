import React, { useRef } from 'react';
import { X, Activity, GitCommit, UserCheck, RefreshCw, RotateCcw, Plus } from 'lucide-react';
import type { ActivityEvent } from '../types/approval';
import { useModalA11y } from '../hooks/useModalA11y';

interface ActivityFeedDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  events: ActivityEvent[];
}

const EVENT_ICON: Record<ActivityEvent['type'], React.ReactNode> = {
  TRANSITION: <GitCommit className="w-3.5 h-3.5 text-blue-600" />,
  ROLE_SWITCH: <UserCheck className="w-3.5 h-3.5 text-purple-600" />,
  API_RETRY: <RefreshCw className="w-3.5 h-3.5 text-amber-600" />,
  UNDO: <RotateCcw className="w-3.5 h-3.5 text-rose-600" />,
  CREATE: <Plus className="w-3.5 h-3.5 text-emerald-600" />,
};

export const ActivityFeedDrawer: React.FC<ActivityFeedDrawerProps> = ({
  isOpen,
  onClose,
  events,
}) => {
  const drawerRef = useRef<HTMLDivElement>(null);
  useModalA11y(drawerRef, onClose);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/30 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="Session Activity Feed"
    >
      <div
        ref={drawerRef}
        tabIndex={-1}
        className="bg-white h-full w-full max-w-md shadow-2xl ring-1 ring-slate-900/10 flex flex-col outline-none animate-slide-in-right"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200/80 bg-slate-50/70">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-semibold tracking-tight text-slate-900">
              Session Activity Feed
            </h3>
            <span className="px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-semibold tabular-nums">
              {events.length}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close activity feed"
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {events.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-12">
              No session events recorded yet. Switch roles, filter, or process an approval to see live telemetry.
            </p>
          ) : (
            events.map((ev) => (
              <div
                key={ev.id}
                className="flex items-start gap-3 p-3 rounded-xl bg-slate-50/70 ring-1 ring-slate-900/5 text-xs"
              >
                <span className="w-7 h-7 rounded-lg bg-white ring-1 ring-slate-900/5 flex items-center justify-center shrink-0">
                  {EVENT_ICON[ev.type]}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900 truncate">
                      {ev.summary}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 tabular-nums shrink-0">
                      {ev.timestamp}
                    </span>
                  </div>
                  {ev.detail && (
                    <p className="text-[11px] text-slate-500 mt-0.5">{ev.detail}</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
