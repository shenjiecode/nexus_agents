import type { ReactNode, MouseEventHandler } from 'react';

interface CyberButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  type?: 'button' | 'submit' | 'reset';
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  className?: string;
  icon?: ReactNode;
}

export function CyberButton({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  size = 'md',
  disabled = false,
  className = '',
  icon,
  ...props
}: CyberButtonProps) {
  const baseStyles = `
    relative font-display font-medium
    transition-all duration-150
    flex items-center justify-center gap-2
    disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none
  `;

  const sizeStyles = {
    sm: 'px-4 py-1.5 text-sm',
    md: 'px-6 py-2.5 text-base',
    lg: 'px-8 py-3.5 text-lg',
  };

  // Industrial cyberpunk 2077 style variants
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return `
          btn-industrial
          bg-cyber-dark-lighter
          border-2 border-cyber-cyan/60
          text-cyber-cyan
          box-glow-cyan
          hover:border-cyber-cyan hover:shadow-cyber-glow-intense
          hover:text-white
          active:scale-[0.98]
        `;
      case 'secondary':
        return `
          btn-industrial
          bg-cyber-dark-lighter
          border-2 border-cyber-purple/60
          text-cyber-purple
          box-glow-cyan
          hover:border-cyber-purple hover:shadow-purple-glow
          hover:text-white
          active:scale-[0.98]
        `;
      case 'danger':
        return `
          btn-industrial
          bg-cyber-dark-lighter
          border-2 border-cyber-red/60
          text-cyber-red
          box-glow-red
          hover:border-cyber-red hover:shadow-red-glow
          hover:text-white
          active:scale-[0.98]
        `;
      case 'ghost':
        return `
          btn-industrial
          bg-transparent
          border-2 border-transparent
          text-cyber-muted
          hover:border-cyber-cyan/40 hover:text-cyber-cyan
          hover:shadow-cyber-glow
          active:scale-[0.98]
        `;
      default:
        return '';
    }
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${sizeStyles[size]} ${getVariantStyles()} ${className}`}
      {...props}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span className="relative z-10">{children}</span>
    </button>
  );
}
