import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  UserCheck,
  AlertTriangle,
  RotateCcw,
  FileText,
  CornerDownLeft,
} from 'lucide-react';
import type { PersonnelRequest, UserRole } from '../types/approval';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  requests: PersonnelRequest[];
  onSelectRequest: (req: PersonnelRequest) => void;
  onSwitchRole: (role: UserRole) => void;
  onJumpSlaBreached: () => void;
  onResetDemo: () => void;
}

interface PaletteItem {
  id: string;
  group: 'Quick Actions' | 'Switch Role' | 'Requests';
  label: string;
  subtitle: string;
  icon: React.ReactNode;
  run: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  requests,
  onSelectRequest,
  onSwitchRole,
  onJumpSlaBreached,
  onResetDemo,
}) => {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const items = useMemo<PaletteItem[]>(() => {
    const actions: PaletteItem[] = [
      {
        id: 'act-sla',
        group: 'Quick Actions',
        label: 'Jump to SLA-Breached Requests',
        subtitle: 'Filter table to active overdue items',
        icon: <AlertTriangle className="w-4 h-4 text-rose-500" />,
        run: () => {
          onJumpSlaBreached();
          onClose();
        },
      },
      {
        id: 'act-reset',
        group: 'Quick Actions',
        label: 'Reset Demo Data',
        subtitle: 'Restore initial operational records',
        icon: <RotateCcw className="w-4 h-4 text-slate-500" />,
        run: () => {
          onResetDemo();
          onClose();
        },
      },
      {
        id: 'role-req',
        group: 'Switch Role',
        label: 'Switch Role: Requester',
        subtitle: 'Submit new requests & view audit status',
        icon: <UserCheck className="w-4 h-4 text-indigo-500" />,
        run: () => {
          onSwitchRole('REQUESTER');
          onClose();
        },
      },
      {
        id: 'role-unit',
        group: 'Switch Role',
        label: 'Switch Role: Unit Reviewer',
        subtitle: 'Verify PENDING_REVIEW requests (Tier 1)',
        icon: <UserCheck className="w-4 h-4 text-blue-500" />,
        run: () => {
          onSwitchRole('UNIT_REVIEWER');
          onClose();
        },
      },
      {
        id: 'role-sec',
        group: 'Switch Role',
        label: 'Switch Role: Security Officer',
        subtitle: 'Clear CRITICAL / >RM 50k requests (Tier 2)',
        icon: <UserCheck className="w-4 h-4 text-purple-500" />,
        run: () => {
          onSwitchRole('SECURITY_OFFICER');
          onClose();
        },
      },
      {
        id: 'role-cmd',
        group: 'Switch Role',
        label: 'Switch Role: Command Approver',
        subtitle: 'Final approval & rejection authority (Tier 3)',
        icon: <UserCheck className="w-4 h-4 text-emerald-500" />,
        run: () => {
          onSwitchRole('COMMAND_APPROVER');
          onClose();
        },
      },
      ...requests.map((req) => ({
        id: `req-${req.id}`,
        group: 'Requests' as const,
        label: `${req.referenceCode} — ${req.title}`,
        subtitle: `${req.department} · ${req.status} · ${req.priority}`,
        icon: <FileText className="w-4 h-4 text-blue-500" />,
        run: () => {
          onSelectRequest(req);
          onClose();
        },
      })),
    ];

    const q = query.trim().toLowerCase();
    if (!q) return actions;
    return actions.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        item.group.toLowerCase().includes(q)
    );
  }, [
    query,
    requests,
    onJumpSlaBreached,
    onResetDemo,
    onSwitchRole,
    onSelectRequest,
    onClose,
  ]);

  const safeIndex = Math.min(activeIndex, Math.max(0, items.length - 1));

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(items.length - 1, i + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 1));
      } else if (e.key === 'Enter' && items[safeIndex]) {
        e.preventDefault();
        items[safeIndex].run();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, items, safeIndex, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] bg-slate-900/40 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-lg rounded-2xl shadow-2xl ring-1 ring-slate-900/10 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            placeholder="Search requests, switch role, or run a command..."
            className="w-full text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-100 text-slate-500 rounded">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {items.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-400">
              No matching commands or requests.
            </p>
          ) : (
            items.map((item, idx) => {
              const active = idx === safeIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={item.run}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-left transition-colors cursor-pointer ${
                    active ? 'bg-blue-50 text-slate-900' : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="shrink-0">{item.icon}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate">{item.label}</p>
                      <p className="text-[11px] text-slate-400 truncate">
                        {item.subtitle}
                      </p>
                    </div>
                  </div>
                  {active && (
                    <CornerDownLeft className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
