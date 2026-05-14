import { useState } from 'react';
import { CyberCard } from '../components/CyberCard';
import { CyberButton } from '../components/CyberButton';
import { StatusDot } from '../components/StatusDot';
import { useApi, apiRequest } from '../hooks/useApi';
import type { Container, Organization } from '../types';

function TrashIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

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

function SearchIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

export function Containers() {
  const { data: containers, loading, error, refetch } = useApi<Container[]>('/api/containers');
  const { data: organizations } = useApi<Organization[]>('/api/organizations');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [orgFilter, setOrgFilter] = useState<string>('all');
  const [containerToRemove, setContainerToRemove] = useState<Container | null>(null);

  const filteredContainers = containers?.filter(container => {
    const matchesSearch =
      container.roleName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      container.organizationName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      container.containerId.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || container.status === statusFilter;
    const matchesOrg = orgFilter === 'all' || container.organizationSlug === orgFilter;

    return matchesSearch && matchesStatus && matchesOrg;
  });

  const handleRemoveContainer = async () => {
    if (!containerToRemove) return;

    try {
      await apiRequest<void>(`/api/containers/${containerToRemove.id}`, {
        method: 'DELETE',
      });
      setContainerToRemove(null);
      refetch();
    } catch (err) {
      console.error('删除 Container 失败:', err);
    }
  };

  const runningCount = containers?.filter(c => c.status === 'running').length || 0;
  const stoppedCount = containers?.filter(c => c.status === 'stopped').length || 0;
  const errorCount = containers?.filter(c => c.status === 'error').length || 0;

  return (
    <div className="page-transition space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-cyber-white glitch" data-text="Containers">
            Containers
          </h1>
          <p className="text-cyber-muted mt-1">管理运行中的 AI 代理实例</p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyber-cyan status-pulse" />
            <span className="text-cyber-muted">{runningCount} 运行中</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyber-muted" />
            <span className="text-cyber-muted">{stoppedCount} 已停止</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyber-error status-pulse-error" />
            <span className="text-cyber-muted">{errorCount} 错误</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <CyberCard>
        <div className="p-4 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-cyber-muted" />
            <input
              type="text"
              placeholder="搜索 Container..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-cyber-dark border border-cyber-cyan/20 text-cyber-white placeholder-cyber-muted focus:border-cyber-cyan focus:outline-none"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-lg bg-cyber-dark border border-cyber-cyan/20 text-cyber-white focus:border-cyber-cyan focus:outline-none"
            >
              <option value="all">所有状态</option>
              <option value="running">运行中</option>
              <option value="stopped">已停止</option>
              <option value="error">错误</option>
              <option value="pending">等待中</option>
            </select>

            <select
              value={orgFilter}
              onChange={(e) => setOrgFilter(e.target.value)}
              className="px-3 py-2 rounded-lg bg-cyber-dark border border-cyber-cyan/20 text-cyber-white focus:border-cyber-cyan focus:outline-none"
            >
              <option value="all">所有组织</option>
              {organizations?.map(org => (
                <option key={org.id} value={org.slug}>{org.name}</option>
              ))}
            </select>
          </div>
        </div>
      </CyberCard>

      {/* Containers Table */}
      <CyberCard>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-cyber-cyan/20">
                <th className="text-left py-4 px-6 font-display font-semibold text-cyber-cyan">组织</th>
                <th className="text-left py-4 px-6 font-display font-semibold text-cyber-cyan">Role</th>
                <th className="text-left py-4 px-6 font-display font-semibold text-cyber-cyan">版本</th>
                <th className="text-left py-4 px-6 font-display font-semibold text-cyber-cyan">状态</th>
                <th className="text-left py-4 px-6 font-display font-semibold text-cyber-cyan">端口</th>
                <th className="text-left py-4 px-6 font-display font-semibold text-cyber-cyan">Container ID</th>
                <th className="text-left py-4 px-6 font-display font-semibold text-cyber-cyan">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-cyber-cyan/10">
                    <td colSpan={7} className="py-4 px-6">
                      <div className="skeleton h-8 rounded" />
                    </td>
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={7} className="py-8 px-6 text-center text-cyber-error">
                    加载 Container 失败：{error}
                  </td>
                </tr>
              ) : filteredContainers?.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 px-6 text-center text-cyber-muted">
                    未找到 Container
                  </td>
                </tr>
              ) : (
                filteredContainers?.map((container) => (
                  <tr
                    key={container.id}
                    className="border-b border-cyber-cyan/10 hover:bg-cyber-cyan/5 transition-colors"
                  >
                    <td className="py-4 px-6">
                      <div>
                        <span className="font-medium text-cyber-white">{container.organizationName}</span>
                        <code className="block text-xs text-cyber-muted font-mono">{container.organizationSlug}</code>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="font-medium text-cyber-white">{container.roleName}</span>
                    </td>
                    <td className="py-4 px-6">
                      <code className="font-mono text-sm text-cyber-purple">{container.roleVersion}</code>
                    </td>
                    <td className="py-4 px-6">
                      <StatusDot status={container.status} showLabel />
                    </td>
                    <td className="py-4 px-6">
                      <span className="font-mono text-cyber-cyan">{container.port}</span>
                    </td>
                    <td className="py-4 px-6">
                      <code className="font-mono text-xs text-cyber-muted bg-cyber-dark px-2 py-1 rounded">
                        {container.containerId.slice(0, 12)}...
                      </code>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        {container.status === 'running' ? (
                          <CyberButton variant="ghost" size="sm" className="!p-1" aria-label="停止">
                            <StopIcon className="w-4 h-4 text-cyber-warning" />
                          </CyberButton>
                        ) : (
                          <CyberButton variant="ghost" size="sm" className="!p-1" aria-label="启动">
                            <PlayIcon className="w-4 h-4 text-cyber-success" />
                          </CyberButton>
                        )}
                        <CyberButton
                          variant="ghost"
                          size="sm"
                          className="!p-1"
                          onClick={() => setContainerToRemove(container)}
                          aria-label="移除"
                        >
                          <TrashIcon className="w-4 h-4 text-cyber-error" />
                        </CyberButton>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CyberCard>

      {/* Remove Confirmation Modal */}
      {containerToRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-cyber-dark-card border border-cyber-cyan/30 rounded-xl shadow-2xl p-6">
            <h3 className="text-xl font-display font-bold text-cyber-white mb-4">移除 Container</h3>
            <p className="text-cyber-muted mb-6">
              确定要移除 <strong className="text-cyber-white">{containerToRemove.roleName}</strong> 的 Container 吗？
              此操作不可撤销。
            </p>
            <div className="flex justify-end gap-3">
              <CyberButton variant="ghost" onClick={() => setContainerToRemove(null)}>
                取消
              </CyberButton>
              <CyberButton variant="danger" onClick={handleRemoveContainer}>
                移除
              </CyberButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
