import React from 'react';
import { ShieldCheck, UserCheck, User } from 'lucide-react';
import type { UserRole } from '../types/approval';

interface RoleSwitcherProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
}

const ROLES: { id: UserRole; label: string; desc: string; icon: React.ReactNode }[] = [
  {
    id: 'REQUESTER',
    label: 'Requester',
    desc: 'Read-only status tracking',
    icon: <User className="w-4 h-4" />,
  },
  {
    id: 'UNIT_REVIEWER',
    label: 'Unit Reviewer',
    desc: 'Can verify pending requests',
    icon: <UserCheck className="w-4 h-4" />,
  },
  {
    id: 'COMMAND_APPROVER',
    label: 'Command Approver',
    desc: 'Final sign-off & rejection authority',
    icon: <ShieldCheck className="w-4 h-4" />,
  },
];

export const RoleSwitcher: React.FC<RoleSwitcherProps> = ({
  currentRole,
  onRoleChange,
}) => {
  return (
    <div className="flex flex-wrap items-center gap-2 bg-slate-100 p-1.5 rounded-lg border border-slate-200">
      {ROLES.map((role) => {
        const active = currentRole === role.id;
        return (
          <button
            key={role.id}
            onClick={() => onRoleChange(role.id)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
              active
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
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