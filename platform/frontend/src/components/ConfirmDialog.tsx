import { useState, useCallback, useRef, useEffect } from 'react';
import { CyberButton } from './CyberButton';

// Confirm dialog types
type ConfirmType = 'danger' | 'warning' | 'info';

interface ConfirmConfig {
  title: string;
  message: string;
  type?: ConfirmType;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
}

interface ConfirmState extends ConfirmConfig {
  id: string;
  isOpen: boolean;
  isLoading: boolean;
}

// Global state for confirm dialog
let confirmId = 0;
let openConfirmFn: ((config: ConfirmConfig) => string) | null = null;

export function useConfirm() {
  const [confirms, setConfirms] = useState<ConfirmState[]>([]);
  const confirmRef = useRef<Map<string, ConfirmState>>(new Map());

  const openConfirm = useCallback((config: ConfirmConfig): string => {
    const id = `confirm-${++confirmId}`;
    const newConfirm: ConfirmState = {
      ...config,
      id,
      isOpen: true,
      isLoading: false,
      type: config.type || 'info',
      confirmText: config.confirmText || '确认',
      cancelText: config.cancelText || '取消',
    };
    
    confirmRef.current.set(id, newConfirm);
    setConfirms(prev => [...prev, newConfirm]);
    
    return id;
  }, []);

  const closeConfirm = useCallback((id: string) => {
    confirmRef.current.delete(id);
    setConfirms(prev => prev.filter(c => c.id !== id));
  }, []);

  const handleConfirm = useCallback(async (id: string) => {
    const confirm = confirmRef.current.get(id);
    if (!confirm) return;

    // Set loading state
    const updatedConfirm = { ...confirm, isLoading: true };
    confirmRef.current.set(id, updatedConfirm);
    setConfirms(prev => prev.map(c => c.id === id ? updatedConfirm : c));

    try {
      if (confirm.onConfirm) {
        await confirm.onConfirm();
      }
    } finally {
      closeConfirm(id);
    }
  }, [closeConfirm]);

  const handleCancel = useCallback((id: string) => {
    const confirm = confirmRef.current.get(id);
    if (confirm?.onCancel) {
      confirm.onCancel();
    }
    closeConfirm(id);
  }, [closeConfirm]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && confirms.length > 0) {
        const lastConfirm = confirms[confirms.length - 1];
        if (!lastConfirm.isLoading) {
          handleCancel(lastConfirm.id);
        }
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [confirms, handleCancel]);

  // Register global function
  useEffect(() => {
    openConfirmFn = openConfirm;
    return () => {
      openConfirmFn = null;
    };
  }, [openConfirm]);

  const ConfirmDialog = confirms.length > 0 ? (
    <>
      {confirms.map(confirm => (
        <ConfirmDialogItem
          key={confirm.id}
          confirm={confirm}
          onConfirm={() => handleConfirm(confirm.id)}
          onCancel={() => handleCancel(confirm.id)}
        />
      ))}
    </>
  ) : null;

  return { openConfirm, ConfirmDialog };
}

// Global helper function (optional, for imperative usage)
export function confirm(config: ConfirmConfig): string {
  if (!openConfirmFn) {
    console.error('useConfirm hook is not mounted');
    return '';
  }
  return openConfirmFn(config);
}

interface ConfirmDialogItemProps {
  confirm: ConfirmState;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialogItem({ confirm, onConfirm, onCancel }: ConfirmDialogItemProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === modalRef.current && !confirm.isLoading) {
      onCancel();
    }
  };

  const getTypeStyles = () => {
    switch (confirm.type) {
      case 'danger':
        return {
          border: 'border-cyber-error/40',
          icon: 'text-cyber-error',
          glow: 'shadow-error-glow',
        };
      case 'warning':
        return {
          border: 'border-cyber-warning/40',
          icon: 'text-cyber-warning',
          glow: 'shadow-yellow-glow',
        };
      case 'info':
      default:
        return {
          border: 'border-cyber-cyan/40',
          icon: 'text-cyber-cyan',
          glow: 'shadow-cyber-glow',
        };
    }
  };

  const getIcon = () => {
    switch (confirm.type) {
      case 'danger':
        return (
          <svg className={`w-8 h-8 ${getTypeStyles().icon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
      case 'warning':
        return (
          <svg className={`w-8 h-8 ${getTypeStyles().icon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'info':
      default:
        return (
          <svg className={`w-8 h-8 ${getTypeStyles().icon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  const styles = getTypeStyles();

  return (
    <div
      ref={modalRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
    >
      <div
        className={`
          relative w-full max-w-md
          bg-cyber-dark-card border-2 ${styles.border}
          rounded-xl shadow-2xl ${styles.glow}
          transform transition-all duration-300
          animate-in fade-in zoom-in-95
        `}
      >
        {/* Corner accents */}
        <div className={`absolute -top-px -left-px w-6 h-6 border-t-2 border-l-2 ${styles.icon} rounded-tl-xl`} />
        <div className={`absolute -top-px -right-px w-6 h-6 border-t-2 border-r-2 ${styles.icon} rounded-tr-xl`} />
        <div className={`absolute -bottom-px -left-px w-6 h-6 border-b-2 border-l-2 ${styles.icon} rounded-bl-xl`} />
        <div className={`absolute -bottom-px -right-px w-6 h-6 border-b-2 border-r-2 ${styles.icon} rounded-br-xl`} />

        {/* Content */}
        <div className="flex flex-col items-center px-6 py-6">
          {getIcon()}
          <h2 className="mt-4 text-xl font-display font-bold text-cyber-white text-center">
            {confirm.title}
          </h2>
          <p className="mt-2 text-cyber-muted text-center">
            {confirm.message}
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-3 px-6 py-4 border-t border-cyber-cyan/20">
          <CyberButton
            variant="ghost"
            onClick={onCancel}
            disabled={confirm.isLoading}
          >
            {confirm.cancelText}
          </CyberButton>
          <CyberButton
            variant={confirm.type === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            disabled={confirm.isLoading}
          >
            {confirm.isLoading ? '处理中...' : confirm.confirmText}
          </CyberButton>
        </div>
      </div>
    </div>
  );
}
