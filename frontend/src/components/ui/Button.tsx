'use client';

import * as React from 'react';
import clsx from 'clsx';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  isLoading?: boolean;
};

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  leftIcon,
  rightIcon,
  isLoading,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed';

  const sizes: Record<Size, string> = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-base',
  };

  const variants: Record<Variant, string> = {
    primary:
      'bg-brand-600 text-white shadow-sm shadow-brand-600/20 hover:bg-brand-700 focus:ring-brand-500 focus:ring-offset-white dark:focus:ring-offset-ink-950',
    secondary:
      'bg-white text-gray-800 border border-gray-200 shadow-sm hover:bg-gray-50 focus:ring-brand-500 focus:ring-offset-white dark:bg-white/5 dark:text-white dark:border-white/10 dark:hover:bg-white/10 dark:focus:ring-offset-ink-950',
    danger:
      'bg-red-600 text-white shadow-sm shadow-red-600/20 hover:bg-red-700 focus:ring-red-500 focus:ring-offset-white dark:focus:ring-offset-ink-950',
    ghost:
      'bg-transparent text-gray-700 hover:bg-gray-100 focus:ring-brand-500 focus:ring-offset-white dark:text-white/80 dark:hover:bg-white/10 dark:focus:ring-offset-ink-950',
  };

  return (
    <button
      className={clsx(base, sizes[size], variants[variant], className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="inline-flex items-center gap-2">
          <span className="h-4 w-4 rounded-full border-2 border-white/60 border-t-transparent animate-spin" />
          <span className="opacity-90">Please wait</span>
        </span>
      ) : (
        <>
          {leftIcon}
          {children}
          {rightIcon}
        </>
      )}
    </button>
  );
}

