import React from 'react';
import { ShieldCheck, UserCheck, User, Lock } from 'lucide-react';
import type { UserRole } from '../types/approval';

interface RoleSwitcherProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
}

const ROLES: { id: UserRole; label: string; desc: string; icon: React.ReactNode }[] = [
  {
    id: 'REQUESTER',
    label: 'Requester',
    desc: 'Submit requests & track status',
    icon: <User className="w-3.5 h-3.5" aria-hidden="true" />,
  },
  {
    id: 'UNIT_REVIEWER',
    label: 'Unit Reviewer',
    desc: 'Verify pending requests (Tier 1)',
    icon: <UserCheck className="w-3.5 h-3.5" aria-hidden="true" />,
  },
  {
    id: 'SECURITY_OFFICER',
    label: 'Security Officer',
    desc: 'Clear CRITICAL or >RM 50k requests (Tier 2)',
    icon: <Lock className="w-3.5 h-3.5" aria-hidden="true" />,
  },
  {
    id: 'COMMAND_APPROVER',
    label: 'Command Approver',
    desc: 'Final sign-off & rejection authority (Tier 3)',
    icon: <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />,
  },
];

export const RoleSwitcher: React.FC<RoleSwitcherProps> = ({
  currentRole,
  onRoleChange,
}) => {
  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    idx: number,
    roleId: UserRole
  ) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      onRoleChange(roleId);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      const next = ROLES[(idx + 1) % ROLES.length];
      onRoleChange(next.id);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prev = ROLES[(idx - 1 + ROLES.length) % ROLES.length];
      onRoleChange(prev.id);
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label="Active user role"
      className="flex flex-wrap items-center gap-1 bg-slate-100/90 p-1 rounded-xl ring-1 ring-slate-900/5"
    >
      {ROLES.map((role, idx) => {
        const active = currentRole === role.id;
        return (
          <button
            key={role.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onRoleChange(role.id)}
            onKeyDown={(e) => handleKeyDown(e, idx, role.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-[0.98] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              active
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
            }`}
            title={role.desc}
          >
            {role.icon}
            <span>{role.label}</span>
          </button>
        );
      })}
    </div>
  );
};
