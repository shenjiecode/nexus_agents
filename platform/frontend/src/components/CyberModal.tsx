import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { CyberButton } from './CyberButton';

interface CyberModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export function CyberModal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
}: CyberModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === modalRef.current) {
      onClose();
    }
  };

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
  };

  if (!isOpen) return null;

  return (
    <div
      ref={modalRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
    >
      <div 
        className={`
          relative w-full ${sizeClasses[size]}
          bg-cyber-dark-card border border-cyber-cyan/30
          rounded-xl shadow-2xl shadow-cyber-cyan/10
          transform transition-all duration-300
          animate-in fade-in zoom-in-95
        `}
      >
        {/* Corner accents */}
        <div className="absolute -top-px -left-px w-6 h-6 border-t-2 border-l-2 border-cyber-cyan rounded-tl-xl" />
        <div className="absolute -top-px -right-px w-6 h-6 border-t-2 border-r-2 border-cyber-cyan rounded-tr-xl" />
        <div className="absolute -bottom-px -left-px w-6 h-6 border-b-2 border-l-2 border-cyber-cyan rounded-bl-xl" />
        <div className="absolute -bottom-px -right-px w-6 h-6 border-b-2 border-r-2 border-cyber-cyan rounded-br-xl" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-cyber-cyan/20">
          <h2 className="text-xl font-display font-bold text-cyber-white">
            {title}
          </h2>
          <CyberButton
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="!p-1"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </CyberButton>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-cyber-cyan/20">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
