import React from 'react';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: ModalSize;
  /** Disable closing via overlay click / Escape (e.g. unsaved form data). */
  dismissable?: boolean;
}

const sizeClasses: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

/** Shared modal shell with overlay, sticky header/footer and scroll lock. */
export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
  dismissable = true,
}) => {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissable) onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, dismissable, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="overlay absolute inset-0 cursor-default"
        onClick={dismissable ? onClose : undefined}
        aria-hidden="true"
      />
      {/* Dialog — must stack ABOVE the overlay. The .overlay component class
          carries z-50; a plain `relative` card would paint BELOW it (backdrop
          dims the modal and steals its clicks). `z-50` ties with the overlay
          and later DOM order wins, putting the dialog on top. */}
      <div
        className={`modal-card relative z-50 w-full ${sizeClasses[size]} max-h-[90vh] flex flex-col`}
      >
        {title && (
          <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
            <div className="min-w-0">
              <h2 className="page-title">{title}</h2>
              {subtitle && <p className="page-subtitle mt-0.5">{subtitle}</p>}
            </div>
            {dismissable && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="btn-ghost shrink-0 -mr-1.5 -mt-0.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}
        <div className="px-5 py-4 overflow-y-auto min-h-0">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 flex-wrap px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

Modal.displayName = 'Modal';

export default Modal;
