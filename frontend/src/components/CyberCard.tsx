import type { ReactNode } from 'react';

interface CyberCardProps {
  children: ReactNode;
  className?: string;
  hoverEffect?: boolean;
  cornerAccent?: boolean;
  gradient?: boolean;
}

export function CyberCard({ 
  children, 
  className = '', 
  hoverEffect = true,
  cornerAccent = false,
  gradient = true
}: CyberCardProps) {
  return (
    <div 
      className={`
        relative rounded-lg overflow-hidden
        ${gradient ? 'bg-card-gradient bg-cyber-dark-card' : 'bg-cyber-dark-card'}
        ${hoverEffect ? 'border-glow hover:scale-[1.01] transition-all duration-300' : 'border border-cyber-cyan/20'}
        ${cornerAccent ? 'corner-accent' : ''}
        ${className}
      `}
    >
      <div className="relative z-10">
        {children}
      </div>
      {gradient && (
        <div className="absolute inset-0 bg-gradient-to-b from-cyber-cyan/5 to-transparent pointer-events-none" />
      )}
    </div>
  );
}
