import React, { useMemo, useState } from 'react';
import { BarChart3, ChevronDown, ChevronRight } from 'lucide-react';
import type { PersonnelRequest } from '../types/approval';
import {
  SLA_HOURS_BY_PRIORITY,
  computeSlaSnapshot,
  formatDurationShort,
} from '../hooks/useSlaTracker';

interface BottlenecksPanelProps {
  requests: PersonnelRequest[];
  nowMs: number;
}

const DEPARTMENTS: PersonnelRequest['department'][] = [
  'Operations',
  'Engineering',
  'Communications',
  'Logistics',
];

export const BottlenecksPanel: React.FC<BottlenecksPanelProps> = ({
  requests,
  nowMs,
}) => {
  const [open, setOpen] = useState(false);

  const metrics = useMemo(() => {
    return DEPARTMENTS.map((dept) => {
      const deptReqs = requests.filter((r) => r.department === dept);
      if (deptReqs.length === 0) {
        return {
          dept,
          total: 0,
          avgTurnaround: '—',
          compliancePct: 100,
          breachedCount: 0,
        };
      }

      let resolvedCount = 0;
      let totalElapsedMs = 0;
      let compliantCount = 0;
      let breachedCount = 0;

      for (const req of deptReqs) {
        const snap = computeSlaSnapshot(req, nowMs);
        if (snap.health === 'BREACHED') {
          breachedCount += 1;
        } else {
          compliantCount += 1;
        }

        if (req.resolvedAtIso) {
          resolvedCount += 1;
          totalElapsedMs += Math.max(
            0,
            new Date(req.resolvedAtIso).getTime() -
              new Date(req.createdAtIso).getTime()
          );
        } else {
          // For active items, measure elapsed time toward SLA
          const targetMs = SLA_HOURS_BY_PRIORITY[req.priority] * 3600 * 1000;
          const elapsed = Math.max(0, nowMs - new Date(req.createdAtIso).getTime());
          if (elapsed > targetMs && snap.health === 'BREACHED') {
            // tracked in breachedCount
          }
        }
      }

      const avgTurnaround =
        resolvedCount > 0
          ? formatDurationShort(totalElapsedMs / resolvedCount)
          : 'In flight';
      const compliancePct = Math.round((compliantCount / deptReqs.length) * 100);

      return {
        dept,
        total: deptReqs.length,
        avgTurnaround,
        compliancePct,
        breachedCount,
      };
    });
  }, [requests, nowMs]);

  return (
    <div className="bg-white rounded-xl ring-1 ring-slate-900/5 shadow-xs overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50/70 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-blue-600" />
          <span className="text-xs font-semibold tracking-tight text-slate-900">
            Operational Bottlenecks &amp; SLA Compliance by Department
          </span>
        </div>
        {open ? (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 border-t border-slate-100">
          {metrics.map((m) => (
            <div
              key={m.dept}
              className="rounded-xl bg-slate-50/80 ring-1 ring-slate-900/5 p-3 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-800">{m.dept}</span>
                <span className="text-[10px] font-medium text-slate-400 tabular-nums">
                  {m.total} req{m.total === 1 ? '' : 's'}
                </span>
              </div>
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-slate-500">Avg Turnaround</span>
                <span className="font-semibold text-slate-900 tabular-nums">
                  {m.avgTurnaround}
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">SLA Compliance</span>
                  <span
                    className={`font-semibold tabular-nums ${
                      m.compliancePct >= 80
                        ? 'text-emerald-600'
                        : m.compliancePct >= 50
                        ? 'text-amber-600'
                        : 'text-rose-600'
                    }`}
                  >
                    {m.compliancePct}%
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      m.compliancePct >= 80
                        ? 'bg-emerald-500'
                        : m.compliancePct >= 50
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                    }`}
                    style={{ width: `${m.compliancePct}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
