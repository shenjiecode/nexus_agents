import type { ReactNode, ButtonHTMLAttributes } from 'react';

interface CyberButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  onClick?: () => void;
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
    relative font-display font-medium rounded-lg
    transition-all duration-300 btn-ripple
    flex items-center justify-center gap-2
    disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none
  `;

  const variantStyles = {
    primary: `
      bg-gradient-to-r from-cyber-cyan/20 to-cyber-purple/20
      border border-cyber-cyan/40
      text-cyber-cyan
      hover:border-cyber-cyan hover:shadow-cyber-glow-hover
      hover:from-cyber-cyan/30 hover:to-cyber-purple/30
    `,
    secondary: `
      bg-cyber-dark-lighter
      border border-cyber-purple/40
      text-cyber-purple
      hover:border-cyber-purple hover:shadow-purple-glow
      hover:bg-cyber-purple/10
    `,
    danger: `
      bg-cyber-error/10
      border border-cyber-error/40
      text-cyber-error
      hover:border-cyber-error hover:shadow-error-glow
      hover:bg-cyber-error/20
    `,
    ghost: `
      bg-transparent
      border border-transparent
      text-cyber-muted
      hover:text-cyber-cyan hover:border-cyber-cyan/20
    `,
  };

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </button>
  );
}
