'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { X } from 'lucide-react';

function useLockBodyScroll(locked: boolean) {
  React.useEffect(() => {
    if (!locked) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [locked]);
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
  size = 'md',
  'aria-label': ariaLabel,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  'aria-label'?: string;
}) {
  const [mounted, setMounted] = React.useState(false);
  const dialogRef = React.useRef<HTMLDivElement | null>(null);

  useLockBodyScroll(open);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key !== 'Tab') return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = dialog.querySelectorAll<HTMLElement>(
        'a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  React.useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const focusTarget = dialog?.querySelector<HTMLElement>('[data-autofocus]') ?? dialog;
    focusTarget?.focus?.();
  }, [open]);

  if (!mounted) return null;
  if (!open) return null;

  const sizes: Record<string, string> = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
  };

  return createPortal(
    <div className="fixed inset-0 z-[80]">
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px] animate-fade-in"
        onMouseDown={onClose}
        aria-hidden="true"
      />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel}
          ref={dialogRef}
          tabIndex={-1}
          className={clsx(
            'w-full rounded-2xl border border-white/20 bg-white/75 backdrop-blur-lg shadow-2xl shadow-black/15 animate-slide-up outline-none',
            'dark:bg-white/5 dark:text-white dark:border-white/10 dark:shadow-black/50',
            sizes[size],
            className
          )}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-start gap-3 px-5 py-4 border-b border-gray-100 dark:border-white/10">
            <div className="min-w-0 flex-1">
              {title && <div className="text-base font-semibold text-gray-900 dark:text-white">{title}</div>}
              {description && (
                <div className="mt-1 text-sm text-gray-500 dark:text-white/60">{description}</div>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-white/10 dark:hover:text-white transition-colors"
              aria-label="Close modal"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="px-5 py-4">{children}</div>

          {footer && (
            <div className="px-5 py-4 border-t border-gray-100 dark:border-white/10 bg-gray-50/50 dark:bg-white/5 rounded-b-2xl">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

