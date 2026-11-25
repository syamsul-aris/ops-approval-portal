import React from 'react';

export interface EmptyStateProps {
  /** Icon rendered inside the centered emblem. */
  icon: React.ReactNode;
  /** Primary heading text. */
  title: string;
  /** Supporting description explaining why the view is empty. */
  description: string;
  /** Optional primary call-to-action element (e.g., a Reset Filters button). */
  action?: React.ReactNode;
}

/**
 * Reusable illustrated empty-state container for tables and lists.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
}) => {
  return (
    <div className="py-16 px-4 flex flex-col items-center justify-center text-center gap-3">
      <div className="w-12 h-12 rounded-2xl bg-slate-100 ring-1 ring-slate-900/5 flex items-center justify-center">
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold tracking-tight text-slate-900">
          {title}
        </p>
        <p className="text-xs text-slate-500 mt-1 max-w-xs">{description}</p>
      </div>
      {action}
    </div>
  );
};
