interface StatusDotProps {
  status: 'running' | 'stopped' | 'error' | 'pending' | 'active' | 'inactive';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const statusConfig = {
  running: {
    color: 'bg-cyber-cyan',
    glow: 'shadow-cyber-glow',
    pulse: true,
    label: 'Running',
  },
  active: {
    color: 'bg-cyber-success',
    glow: 'shadow-success-glow',
    pulse: true,
    label: 'Active',
  },
  stopped: {
    color: 'bg-cyber-muted',
    glow: '',
    pulse: false,
    label: 'Stopped',
  },
  inactive: {
    color: 'bg-cyber-muted',
    glow: '',
    pulse: false,
    label: 'Inactive',
  },
  error: {
    color: 'bg-cyber-error',
    glow: 'shadow-error-glow',
    pulse: true,
    label: 'Error',
  },
  pending: {
    color: 'bg-cyber-warning',
    glow: '',
    pulse: true,
    label: 'Pending',
  },
};

export function StatusDot({ status, size = 'md', showLabel = false }: StatusDotProps) {
  const config = statusConfig[status];
  
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  };

  return (
    <div className="flex items-center gap-2">
      <div
        className={`
          rounded-full ${sizeClasses[size]} ${config.color} ${config.glow}
          ${config.pulse ? (status === 'error' ? 'status-pulse-error' : 'status-pulse') : ''}
        `}
      />
      {showLabel && (
        <span className={`text-sm ${status === 'running' || status === 'active' ? 'text-cyber-cyan' : 'text-cyber-muted'}`}>
          {config.label}
        </span>
      )}
    </div>
  );
}
