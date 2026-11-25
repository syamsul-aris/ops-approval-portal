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
    icon: <User className="w-3.5 h-3.5" />,
  },
  {
    id: 'UNIT_REVIEWER',
    label: 'Unit Reviewer',
    desc: 'Verify pending requests (Tier 1)',
    icon: <UserCheck className="w-3.5 h-3.5" />,
  },
  {
    id: 'SECURITY_OFFICER',
    label: 'Security Officer',
    desc: 'Clear CRITICAL or >RM 50k requests (Tier 2)',
    icon: <Lock className="w-3.5 h-3.5" />,
  },
  {
    id: 'COMMAND_APPROVER',
    label: 'Command Approver',
    desc: 'Final sign-off & rejection authority (Tier 3)',
    icon: <ShieldCheck className="w-3.5 h-3.5" />,
  },
];

export const RoleSwitcher: React.FC<RoleSwitcherProps> = ({
  currentRole,
  onRoleChange,
}) => {
  return (
    <div
      role="group"
      aria-label="Active user role"
      className="flex flex-wrap items-center gap-1 bg-slate-100/90 p-1 rounded-xl ring-1 ring-slate-900/5"
    >
      {ROLES.map((role) => {
        const active = currentRole === role.id;
        return (
          <button
            key={role.id}
            type="button"
            onClick={() => onRoleChange(role.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-[0.98] cursor-pointer ${
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
