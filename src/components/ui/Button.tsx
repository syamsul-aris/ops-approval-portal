import React from 'react';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'danger'
  | 'success'
  | 'ghost';

export type ButtonSize = 'sm' | 'md';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style variant of the button. */
  variant?: ButtonVariant;
  /** Size preset controlling padding and typography. */
  size?: ButtonSize;
  /** Optional leading icon rendered before children. */
  leftIcon?: React.ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 shadow-2xs',
  secondary:
    'bg-white text-slate-700 ring-1 ring-slate-900/10 hover:bg-slate-50',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 shadow-2xs',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-2xs',
  ghost: 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
};

/**
 * Reusable accessible button primitive with consistent enterprise variants and press feedback.
 */
export const Button: React.FC<ButtonProps> = ({
  variant = 'secondary',
  size = 'sm',
  leftIcon,
  className = '',
  children,
  type = 'button',
  ...rest
}) => {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center font-medium rounded-lg transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...rest}
    >
      {leftIcon}
      {children}
    </button>
  );
};
