import type { ReactNode } from 'react';

interface CyberCardProps {
  children: ReactNode;
  className?: string;
  hoverEffect?: boolean;
  cornerAccent?: boolean;
  gradient?: boolean;
  onClick?: () => void;
}

export function CyberCard({ 
  children, 
  className = '', 
  hoverEffect = true,
  cornerAccent = false,
  gradient = true,
  onClick
}: CyberCardProps) {
  return (
    <div 
      className={`
        card-industrial industrial-corners
        ${hoverEffect ? 'hover:box-glow-cyan transition-all duration-300' : ''}
        ${cornerAccent ? 'industrial-corners' : ''}
        ${className}
      `}
      onClick={onClick}
    >
      {/* Top warning stripe overlay */}
      <div className="absolute top-0 left-0 right-0 h-[6px] z-20 pointer-events-none">
        <div 
          className="w-full h-full"
          style={{
            background: `repeating-linear-gradient(
              45deg,
              var(--cyber-cyan) 0,
              var(--cyber-cyan) 10px,
              var(--cyber-dark) 10px,
              var(--cyber-dark) 20px
            )`
          }}
        />
      </div>
      
      {/* Content wrapper */}
      <div className="relative z-10 pt-2 pb-2">
        {children}
      </div>
      
      {/* Bottom warning stripe overlay */}
      <div className="absolute bottom-0 left-0 right-0 h-[6px] z-20 pointer-events-none">
        <div 
          className="w-full h-full opacity-60"
          style={{
            background: `repeating-linear-gradient(
              -45deg,
              var(--cyber-yellow) 0,
              var(--cyber-yellow) 10px,
              var(--cyber-dark) 10px,
              var(--cyber-dark) 20px
            )`
          }}
        />
      </div>
      
      {/* Gradient overlay */}
      {gradient && (
        <div className="absolute inset-0 bg-gradient-to-b from-cyber-cyan/5 to-transparent pointer-events-none z-0" />
      )}
    </div>
  );
}
