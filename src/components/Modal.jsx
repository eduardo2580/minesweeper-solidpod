import { useEffect, useRef } from 'react';

export default function Modal({ isOpen, onClose, title, children, size = 'md' }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const el = dialogRef.current;
    if (!el) return;

    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    el.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className={`modal-box modal-${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
      >
        <div className="modal-header">
          <h2 id="modal-title" className="modal-title">{title}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close dialog">
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="currentColor"/>
            </svg>
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
