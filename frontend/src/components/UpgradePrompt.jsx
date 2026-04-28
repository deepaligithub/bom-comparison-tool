import React, { useEffect, useRef, useCallback } from 'react';

const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Modal when a feature is not available (e.g. licensing managed by Microsoft Store).
 * Focus trap, Escape closes, ARIA labels, focus restored on close.
 */
export default function UpgradePrompt({ open, onClose, featureName = 'This feature', message }) {
  const dialogRef = useRef(null);
  const previousActiveRef = useRef(null);

  const close = useCallback(() => {
    onClose?.();
    if (previousActiveRef.current && typeof previousActiveRef.current.focus === 'function') {
      previousActiveRef.current.focus();
    }
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    previousActiveRef.current = document.activeElement;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (e) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, close]);

  useEffect(() => {
    if (!open || !dialogRef.current) return;
    const focusables = dialogRef.current.querySelectorAll(FOCUSABLE_SELECTOR);
    const first = focusables[0];
    if (first) first.focus();
  }, [open]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open]);

  const handleKeyDown = (e) => {
    if (e.key !== 'Tab' || !dialogRef.current) return;
    const focusables = [...dialogRef.current.querySelectorAll(FOCUSABLE_SELECTOR)].filter(
      (el) => !el.hasAttribute('disabled') && el.tabIndex !== -1
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  if (!open) return null;

  const defaultMessage = `${featureName} is available in the full version from the Microsoft Store.`;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={close}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-dialog-title"
        aria-describedby="upgrade-dialog-desc"
        className="bg-white rounded-lg shadow-xl p-6 max-w-sm mx-4"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <h2 id="upgrade-dialog-title" className="text-lg font-semibold text-gray-800 mb-2">
          Feature not available
        </h2>
        <p id="upgrade-dialog-desc" className="text-gray-600 text-sm mb-4">
          {message != null ? message : defaultMessage}
        </p>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={close}
            className="px-4 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
            autoFocus
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
