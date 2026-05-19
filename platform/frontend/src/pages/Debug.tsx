import { useState } from 'react';
import { CyberCard } from '../components/CyberCard';
import { CyberButton } from '../components/CyberButton';
import { StatusDot } from '../components/StatusDot';
import { useApi } from '../hooks/useApi';
import type { PicoClawWorkspace } from '../types';
import { FileEditor } from '../components/debug/FileEditor';
import { ChatPanel } from '../components/debug/ChatPanel';

type ContainerVariant = 'base' | 'full' | 'heavy';
type ContainerStatus = 'stopped' | 'running' | 'error' | 'pending';

interface ContainerState {
  id: string;
  name: string;
  variant: ContainerVariant;
  status: ContainerStatus;
  port: number | null;
  logs: string[];
}

// Icons
function PlayIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function StopIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
    </svg>
  );
}

function TerminalIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function ChevronDownIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function ChevronUpIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
    </svg>
  );
}

function ContainerIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  );
}

function BugIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2a2 2 0 100 4 2 2 0 000-4z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 12v.01" />
    </svg>
  );
}

function RefreshIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

const variantLabels: Record<ContainerVariant, string> = {
  base: '基础版 (Base)',
  full: '完整版 (Full)',
  heavy: '重型版 (Heavy)',
};

const variantDescriptions: Record<ContainerVariant, string> = {
  base: '轻量级环境，适合快速测试',
  full: '标准开发环境，预装常用工具',
  heavy: '完整开发环境，包含所有依赖',
};

export function Debug() {
  const [selectedVariant, setSelectedVariant] = useState<ContainerVariant>('base');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [logsExpanded, setLogsExpanded] = useState(false);
  const [containers, setContainers] = useState<ContainerState[]>([
    {
      id: 'debug-01',
      name: 'Debug Container',
      variant: 'base',
      status: 'stopped',
      port: null,
      logs: [],
    },
  ]);
  const [operationLoading, setOperationLoading] = useState(false);
  const [workspaceId] = useState('debug-workspace');
  const [exporting, setExporting] = useState(false);

  const { data: _workspaces, loading: _workspacesLoading, refetch } = useApi<PicoClawWorkspace[]>('/api/workspaces');

  const activeContainer = containers[0];

  const handleStartContainer = async () => {
    setOperationLoading(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setContainers(prev => [
      {
        ...prev[0],
        status: 'running',
        port: 10000 + Math.floor(Math.random() * 1000),
        logs: [
          '[INFO] Initializing container...',
          `[INFO] Selected variant: ${selectedVariant}`,
          '[INFO] Pulling image...',
          '[INFO] Starting container...',
          '[INFO] Container started successfully',
          `[INFO] Listening on port ${10000 + Math.floor(Math.random() * 1000)}`,
        ],
      },
    ]);
    
    setOperationLoading(false);
  };

  const handleStopContainer = async () => {
    setOperationLoading(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    setContainers(prev => [
      {
        ...prev[0],
        status: 'stopped',
        port: null,
        logs: [
          ...prev[0].logs,
          '[INFO] Stopping container...',
          '[INFO] Container stopped',
        ],
      },
    ]);
    
    setOperationLoading(false);
  };

  const handleRefresh = () => {
    refetch();
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:13207';
      const response = await fetch(`${apiBaseUrl}/api/picoclaw/${workspaceId}/export`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      // Create blob and trigger download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${workspaceId}-config.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setExporting(false);
    }
  };

  const getStatusDotStatus = (status: ContainerStatus) => {
    switch (status) {
      case 'running':
        return 'running';
      case 'stopped':
        return 'stopped';
      case 'error':
        return 'error';
      case 'pending':
        return 'pending';
      default:
        return 'stopped';
    }
  };

  return (
    <div className="page-transition space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-cyber-white glitch" data-text="调试面板">
            调试面板
          </h1>
          <p className="text-cyber-muted mt-1">容器管理与调试工具</p>
        </div>
        <div className="flex gap-2">
          <CyberButton
            variant="ghost"
            size="sm"
            onClick={handleExport}
            disabled={exporting}
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            }
          >
            {exporting ? '导出中...' : '导出配置'}
          </CyberButton>
          <CyberButton
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            icon={<RefreshIcon className="w-4 h-4" />}
          >
            刷新
          </CyberButton>
        </div>
      </div>

      {/* Container Management Panel */}
      <CyberCard cornerAccent>
        <div className="p-6">
          {/* Panel Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-cyber-cyan/10 text-cyber-cyan">
              <ContainerIcon className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-display font-semibold text-cyber-white">
                容器管理
              </h2>
              <p className="text-cyber-muted text-sm">启动和调试开发容器</p>
            </div>
          </div>

          {/* Variant Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-cyber-white mb-2">
              选择容器类型
            </label>
            <div className="relative">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                disabled={activeContainer.status === 'running'}
                className={`
                  w-full flex items-center justify-between px-4 py-3 rounded-lg
                  border transition-all duration-300
                  ${activeContainer.status === 'running'
                    ? 'bg-cyber-dark-lighter border-cyber-cyan/10 text-cyber-muted cursor-not-allowed'
                    : 'bg-cyber-dark-lighter border-cyber-cyan/30 text-cyber-white hover:border-cyber-cyan hover:shadow-cyber-glow-hover'
                  }
                `}
              >
                <div className="flex items-center gap-3">
                  <BugIcon className="w-5 h-5 text-cyber-cyan" />
                  <div className="text-left">
                    <div className="font-medium">{variantLabels[selectedVariant]}</div>
                    <div className="text-xs text-cyber-muted">{variantDescriptions[selectedVariant]}</div>
                  </div>
                </div>
                {isDropdownOpen ? (
                  <ChevronUpIcon className="w-5 h-5 text-cyber-muted" />
                ) : (
                  <ChevronDownIcon className="w-5 h-5 text-cyber-muted" />
                )}
              </button>

              {/* Dropdown Menu */}
              {isDropdownOpen && activeContainer.status !== 'running' && (
                <div className="absolute top-full left-0 right-0 mt-2 z-20">
                  <CyberCard hoverEffect={false}>
                    <div className="py-1">
                      {(Object.keys(variantLabels) as ContainerVariant[]).map((variant) => (
                        <button
                          key={variant}
                          onClick={() => {
                            setSelectedVariant(variant);
                            setIsDropdownOpen(false);
                          }}
                          className={`
                            w-full flex items-center gap-3 px-4 py-3 text-left
                            transition-colors duration-200
                            ${selectedVariant === variant
                              ? 'bg-cyber-cyan/10 text-cyber-cyan'
                              : 'text-cyber-white hover:bg-cyber-cyan/5'
                            }
                          `}
                        >
                          <BugIcon className={`w-5 h-5 ${selectedVariant === variant ? 'text-cyber-cyan' : 'text-cyber-muted'}`} />
                          <div>
                            <div className="font-medium">{variantLabels[variant]}</div>
                            <div className="text-xs text-cyber-muted">{variantDescriptions[variant]}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </CyberCard>
                </div>
              )}
            </div>
          </div>

          {/* Status Display */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-cyber-dark-lighter rounded-lg p-4 border border-cyber-cyan/10">
              <div className="text-xs text-cyber-muted uppercase tracking-wider mb-1">状态</div>
              <div className="flex items-center gap-2">
                <StatusDot status={getStatusDotStatus(activeContainer.status)} showLabel />
              </div>
            </div>
            <div className="bg-cyber-dark-lighter rounded-lg p-4 border border-cyber-cyan/10">
              <div className="text-xs text-cyber-muted uppercase tracking-wider mb-1">端口</div>
              <div className="font-mono text-cyber-cyan">
                {activeContainer.port || '—'}
              </div>
            </div>
            <div className="bg-cyber-dark-lighter rounded-lg p-4 border border-cyber-cyan/10">
              <div className="text-xs text-cyber-muted uppercase tracking-wider mb-1">类型</div>
              <div className="text-cyber-white">
                {variantLabels[activeContainer.variant]}
              </div>
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex flex-wrap gap-3 mb-6">
            {activeContainer.status === 'stopped' ? (
              <CyberButton
                variant="primary"
                size="lg"
                onClick={handleStartContainer}
                disabled={operationLoading}
                icon={<PlayIcon className="w-5 h-5" />}
              >
                {operationLoading ? '启动中...' : '启动容器'}
              </CyberButton>
            ) : (
              <CyberButton
                variant="danger"
                size="lg"
                onClick={handleStopContainer}
                disabled={operationLoading}
                icon={<StopIcon className="w-5 h-5" />}
              >
                {operationLoading ? '停止中...' : '停止容器'}
              </CyberButton>
            )}
          </div>

          {/* Logs Viewer */}
          <div className="border-t border-cyber-cyan/20 pt-4">
            <button
              onClick={() => setLogsExpanded(!logsExpanded)}
              className="flex items-center justify-between w-full text-left group"
            >
              <div className="flex items-center gap-2">
                <TerminalIcon className="w-5 h-5 text-cyber-cyan" />
                <span className="font-medium text-cyber-white">容器日志</span>
                <span className="text-xs text-cyber-muted bg-cyber-dark-lighter px-2 py-0.5 rounded">
                  {activeContainer.logs.length} 条
                </span>
              </div>
              {logsExpanded ? (
                <ChevronUpIcon className="w-5 h-5 text-cyber-muted group-hover:text-cyber-cyan transition-colors" />
              ) : (
                <ChevronDownIcon className="w-5 h-5 text-cyber-muted group-hover:text-cyber-cyan transition-colors" />
              )}
            </button>

            {logsExpanded && (
              <div className="mt-4">
                <div className="bg-cyber-dark-lighter rounded-lg border border-cyber-cyan/20 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2 bg-cyber-dark-card border-b border-cyber-cyan/10">
                    <span className="text-xs text-cyber-muted font-mono">terminal</span>
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-cyber-error/50" />
                      <div className="w-2.5 h-2.5 rounded-full bg-cyber-warning/50" />
                      <div className="w-2.5 h-2.5 rounded-full bg-cyber-success/50" />
                    </div>
                  </div>
                  <div className="p-4 max-h-64 overflow-y-auto font-mono text-sm space-y-1">
                    {activeContainer.logs.length === 0 ? (
                      <div className="text-cyber-muted italic">暂无日志...</div>
                    ) : (
                      activeContainer.logs.map((log, index) => (
                        <div key={index} className="flex gap-3">
                          <span className="text-cyber-muted text-xs select-none">
                            {(index + 1).toString().padStart(3, '0')}
                          </span>
                          <span className={`
                            ${log.includes('ERROR') ? 'text-cyber-error' : ''}
                            ${log.includes('WARN') ? 'text-cyber-warning' : ''}
                            ${log.includes('INFO') ? 'text-cyber-cyan' : 'text-cyber-white'}
                          `}>
                            {log}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </CyberCard>

      {/* Three Panel Layout: Container + FileEditor + Chat */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Panel: Container Management */}
        <div className="lg:col-span-3">
          <CyberCard cornerAccent>
            <div className="p-4">
              <h3 className="font-display font-semibold text-cyber-white mb-4 flex items-center gap-2">
                <ContainerIcon className="w-5 h-5 text-cyber-cyan" />
                容器管理
              </h3>
              <div className="space-y-3">
                <div className="bg-cyber-dark-lighter rounded-lg p-3 border border-cyber-cyan/10">
                  <div className="text-xs text-cyber-muted mb-1">状态</div>
                  <StatusDot status={getStatusDotStatus(activeContainer.status)} showLabel />
                </div>
                <div className="bg-cyber-dark-lighter rounded-lg p-3 border border-cyber-cyan/10">
                  <div className="text-xs text-cyber-muted mb-1">端口</div>
                  <div className="font-mono text-cyber-cyan">{activeContainer.port || '—'}</div>
                </div>
                <div className="bg-cyber-dark-lighter rounded-lg p-3 border border-cyber-cyan/10">
                  <div className="text-xs text-cyber-muted mb-1">类型</div>
                  <div className="text-cyber-white text-sm">{variantLabels[activeContainer.variant]}</div>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                {activeContainer.status === 'stopped' ? (
                  <CyberButton
                    variant="primary"
                    size="sm"
                    onClick={handleStartContainer}
                    disabled={operationLoading}
                    icon={<PlayIcon className="w-4 h-4" />}
                  >
                    启动
                  </CyberButton>
                ) : (
                  <CyberButton
                    variant="danger"
                    size="sm"
                    onClick={handleStopContainer}
                    disabled={operationLoading}
                    icon={<StopIcon className="w-4 h-4" />}
                  >
                    停止
                  </CyberButton>
                )}
              </div>
            </div>
          </CyberCard>
        </div>

        {/* Middle Panel: File Editor */}
        <div className="lg:col-span-5">
          <FileEditor workspaceId={workspaceId} />
        </div>

        {/* Right Panel: Chat */}
        <div className="lg:col-span-4">
          <ChatPanel workspaceId={workspaceId} />
        </div>
      </div>
    </div>
  );
}