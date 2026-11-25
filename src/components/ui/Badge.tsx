import React from 'react';

export type BadgeVariant =
  | 'neutral'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger'
  | 'purple';

export interface BadgeProps {
  /** Semantic color variant for the badge. */
  variant?: BadgeVariant;
  /** Optional status indicator dot rendered before the label. */
  dot?: boolean;
  /** Accessible label announced by screen readers. */
  ariaLabel?: string;
  /** Additional utility classes. */
  className?: string;
  /** Badge content. */
  children: React.ReactNode;
}

const BADGE_CLASSES: Record<BadgeVariant, { pill: string; dot: string }> = {
  neutral: {
    pill: 'bg-slate-100 text-slate-600',
    dot: 'bg-slate-500',
  },
  info: {
    pill: 'bg-blue-50/80 text-blue-700 ring-1 ring-blue-600/20',
    dot: 'bg-blue-500',
  },
  success: {
    pill: 'bg-emerald-50/80 text-emerald-700 ring-1 ring-emerald-600/20',
    dot: 'bg-emerald-500',
  },
  warning: {
    pill: 'bg-amber-50/80 text-amber-700 ring-1 ring-amber-600/20',
    dot: 'bg-amber-500',
  },
  danger: {
    pill: 'bg-rose-50/80 text-rose-700 ring-1 ring-rose-600/20',
    dot: 'bg-rose-500',
  },
  purple: {
    pill: 'bg-purple-50/80 text-purple-700 ring-1 ring-purple-600/20',
    dot: 'bg-purple-500',
  },
};

/**
 * Reusable status/priority pill primitive with optional semantic indicator dot.
 */
export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  dot = false,
  ariaLabel,
  className = '',
  children,
}) => {
  const styles = BADGE_CLASSES[variant];
  return (
    <span
      aria-label={ariaLabel}
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${styles.pill} ${className}`}
    >
      {dot && (
        <span
          aria-hidden="true"
          className={`w-1.5 h-1.5 rounded-full ${styles.dot}`}
        />
      )}
      {children}
    </span>
  );
};
