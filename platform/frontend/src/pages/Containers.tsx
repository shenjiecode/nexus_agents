import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CyberCard } from '../components/CyberCard';
import { CyberButton } from '../components/CyberButton';
import { CyberModal } from '../components/CyberModal';
import { StatusDot } from '../components/StatusDot';
import { useApi, apiRequest } from '../hooks/useApi';
import type { Container, ContainerStatus } from '../types/container';
import type { Role } from '../types';

function PlusIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
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

function CubeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
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

function TrashIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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

interface StoredUser {
  id: string;
  name: string;
  slug: string;
  role: 'admin' | 'user';
}

const statusOptions: { value: ContainerStatus | 'all'; label: string }[] = [
  { value: 'all', label: '全部状态' },
  { value: 'running', label: '运行中' },
  { value: 'stopped', label: '已停止' },
  { value: 'error', label: '错误' },
  { value: 'creating', label: '创建中' },
];

// variantOptions removed - all containers use sipeed/picoclaw:latest

export function Containers() {
  const navigate = useNavigate();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [, setUser] = useState<StoredUser | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ContainerStatus | 'all'>('all');
  const [containerToDelete, setContainerToDelete] = useState<Container | null>(null);

  // Create form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    variant: 'base',
    roleId: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Action states
  const [actionLoading, setActionLoading] = useState<{
    containerId: string;
    action: 'start' | 'stop' | 'delete';
  } | null>(null);

  // Get user from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('nexus_user');
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        setUser(null);
      }
    }
  }, []);

  // Fetch containers
  const { data: containers, loading, error, refetch } = useApi<Container[]>('/api/containers');
  
  // Fetch user roles for dropdown
  const { data: userRoles } = useApi<Role[]>('/api/roles/mine');

  // Filter containers
  const filteredContainers = useMemo(() => {
    if (!containers) return [];
    return containers.filter(container => {
      const matchesSearch = container.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        container.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || container.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [containers, searchQuery, statusFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    // Validate name
    if (!formData.name.trim()) {
      setSubmitError('容器名称不能为空');
      setIsSubmitting(false);
      return;
    }
    if (formData.name.length > 64) {
      setSubmitError('容器名称最多64个字符');
      setIsSubmitting(false);
      return;
    }

    try {
      await apiRequest<Container>('/api/containers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || undefined,
          variant: formData.variant || 'base',
          roleId: formData.roleId || undefined,
        }),
      });
      setIsCreateModalOpen(false);
      setFormData({ name: '', description: '', variant: 'base', roleId: '' });
      refetch();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : '创建失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStart = async (container: Container) => {
    setActionLoading({ containerId: container.id, action: 'start' });
    try {
      await apiRequest<void>(`/api/containers/${container.id}/start`, {
        method: 'POST',
      });
      refetch();
    } catch (err) {
      console.error('Start failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleStop = async (container: Container) => {
    setActionLoading({ containerId: container.id, action: 'stop' });
    try {
      await apiRequest<void>(`/api/containers/${container.id}/stop`, {
        method: 'POST',
      });
      refetch();
    } catch (err) {
      console.error('Stop failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!containerToDelete) return;

    setActionLoading({ containerId: containerToDelete.id, action: 'delete' });
    try {
      await apiRequest<void>(`/api/containers/${containerToDelete.id}`, {
        method: 'DELETE',
      });
      setIsDeleteModalOpen(false);
      setContainerToDelete(null);
      refetch();
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const openDeleteModal = (container: Container) => {
    setContainerToDelete(container);
    setIsDeleteModalOpen(true);
  };

  const getStatusDotStatus = (status: ContainerStatus): 'running' | 'stopped' | 'error' | 'pending' => {
    switch (status) {
      case 'running':
        return 'running';
      case 'stopped':
        return 'stopped';
      case 'error':
        return 'error';
      case 'creating':
        return 'pending';
      default:
        return 'stopped';
    }
  };

  const getStatusLabel = (status: ContainerStatus): string => {
    switch (status) {
      case 'running':
        return '运行中';
      case 'stopped':
        return '已停止';
      case 'error':
        return '错误';
      case 'creating':
        return '创建中';
      default:
        return status;
    }
  };

  return (
    <div className="page-transition space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-cyber-white glitch-cp2077 neon-glow-cyan" data-text="Containers">
            Containers
          </h1>
          <p className="text-cyber-muted mt-1">管理和监控您的容器</p>
        </div>
        <CyberButton
          onClick={() => setIsCreateModalOpen(true)}
          icon={<PlusIcon className="w-5 h-5" />}
        >
          创建容器
        </CyberButton>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Status Filter */}
        <div className="relative">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as ContainerStatus | 'all')}
            className="appearance-none w-40 px-4 py-2 rounded-lg bg-cyber-dark-card border border-cyber-cyan/20 text-cyber-white focus:border-cyber-cyan focus:outline-none focus:ring-1 focus:ring-cyber-cyan cursor-pointer"
          >
            {statusOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-cyber-muted pointer-events-none" />
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-cyber-muted" />
          <input
            type="text"
            placeholder="搜索容器..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-cyber-dark-card border border-cyber-cyan/20 text-cyber-white placeholder-cyber-muted focus:border-cyber-cyan focus:outline-none focus:ring-1 focus:ring-cyber-cyan"
          />
        </div>
      </div>

      {/* Containers Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <CyberCard key={i} className="h-48">
              <div className="p-6 skeleton h-full" />
            </CyberCard>
          ))}
        </div>
      ) : error ? (
        <CyberCard>
          <div className="p-8 text-center text-cyber-error">加载失败：{error}</div>
        </CyberCard>
      ) : filteredContainers.length === 0 ? (
        <CyberCard>
          <div className="p-8 text-center text-cyber-muted">
            {searchQuery || statusFilter !== 'all' ? '没有找到匹配的容器' : '暂无容器'}
          </div>
        </CyberCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredContainers.map(container => (
            <CyberCard
              key={container.id}
              className="hover:border-cyber-cyan/50 transition-colors group"
            >
              <div className="p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="p-3 rounded-lg bg-cyber-cyan/10 text-cyber-cyan group-hover:bg-cyber-cyan/20 transition-colors">
                    <CubeIcon className="w-6 h-6" />
                  </div>
                  <div className="flex items-center gap-1">
                    {/* Start Button - only when stopped */}
                    {container.status === 'stopped' && (
                      <CyberButton
                        size="sm"
                        variant="ghost"
                        disabled={actionLoading?.containerId === container.id && actionLoading.action === 'start'}
                        onClick={() => handleStart(container)}
                        icon={<PlayIcon className="w-4 h-4" />}
                      >
                        {actionLoading?.containerId === container.id && actionLoading.action === 'start' ? '启动中...' : '启动'}
                      </CyberButton>
                    )}
                    {/* Stop Button - only when running */}
                    {container.status === 'running' && (
                      <>
                        <CyberButton
                          size="sm"
                          variant="ghost"
                          disabled={actionLoading?.containerId === container.id && actionLoading.action === 'stop'}
                          onClick={() => handleStop(container)}
                          icon={<StopIcon className="w-4 h-4" />}
                        >
                          {actionLoading?.containerId === container.id && actionLoading.action === 'stop' ? '停止中...' : '停止'}
                        </CyberButton>
                        {/* Debug Button */}
                        <CyberButton
                          size="sm"
                          variant="primary"
                          onClick={() => navigate(`/containers/${container.id}/debug`)}
                        >
                          调试
                        </CyberButton>
                      </>
                    )}
                    {/* Delete Button - always visible */}
                    <CyberButton
                      size="sm"
                      variant="ghost"
                      disabled={actionLoading?.containerId === container.id && actionLoading.action === 'delete'}
                      onClick={() => openDeleteModal(container)}
                      icon={<TrashIcon className="w-4 h-4" />}
                    >
                      删除
                    </CyberButton>
                  </div>
                </div>

                {/* Container Name */}
                <h3 className="text-lg font-display font-semibold text-cyber-white group-hover:text-cyber-cyan transition-colors mb-1">
                  {container.name}
                </h3>

                {/* Description */}
                <p className="mt-2 text-sm text-cyber-muted line-clamp-2">
                  {container.description || '暂无描述'}
                </p>

                {/* Tags */}
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-cyber-cyan/10 text-cyber-cyan">
                    {container.variant}
                  </span>
                  <StatusDot
                    status={getStatusDotStatus(container.status)}
                    size="sm"
                    showLabel={false}
                  />
                  <span className="text-xs text-cyber-muted">
                    {getStatusLabel(container.status)}
                  </span>
                </div>

                {/* Footer Info */}
                <div className="mt-4 flex items-center justify-between text-xs text-cyber-muted font-mono">
                  <div className="flex items-center gap-2">
                    <span>端口: {container.port}</span>
                    {container.roleId && (
                      <span className="text-cyber-cyan/70">关联Role</span>
                    )}
                  </div>
                  <span>{new Date(container.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </CyberCard>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <CyberModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setSubmitError(null);
          setFormData({ name: '', description: '', variant: 'base', roleId: '' });
        }}
        title="创建容器"
        footer={
          <>
            <CyberButton
              variant="ghost"
              onClick={() => {
                setIsCreateModalOpen(false);
                setSubmitError(null);
                setFormData({ name: '', description: '', variant: 'base', roleId: '' });
              }}
            >
              取消
            </CyberButton>
            <CyberButton
              type="submit"
              form="container-create-form"
              disabled={isSubmitting || !formData.name}
            >
              {isSubmitting ? '创建中...' : '创建'}
            </CyberButton>
          </>
        }
      >
        <form id="container-create-form" onSubmit={handleCreate} className="space-y-4">
          {submitError && (
            <div className="p-3 rounded-lg bg-cyber-error/10 border border-cyber-error/30 text-cyber-error text-sm">
              {submitError}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-cyber-muted mb-1">
              名称 <span className="text-cyber-error">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="容器名称"
              maxLength={64}
              className="w-full px-3 py-2 rounded-lg bg-cyber-dark border border-cyber-cyan/20 text-cyber-white placeholder-cyber-muted focus:border-cyber-cyan focus:outline-none"
              required
            />
            <p className="text-xs text-cyber-muted mt-1">
              最多64个字符
            </p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-cyber-muted mb-1">描述</label>
            <textarea
              value={formData.description}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="描述此容器的用途..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-cyber-dark border border-cyber-cyan/20 text-cyber-white placeholder-cyber-muted focus:border-cyber-cyan focus:outline-none resize-none"
            />
          </div>

          {/* Variant: fixed to standard */}
          <div>
            <label className="block text-sm font-medium text-cyber-muted mb-1">镜像</label>
            <input
              type="text"
              value="sipeed/picoclaw:latest"
              disabled
              className="w-full px-3 py-2 rounded-lg bg-cyber-dark/50 border border-cyber-cyan/20 text-cyber-muted cursor-not-allowed"
            />
          </div>

          {/* Role Dropdown */}
          {userRoles && userRoles.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-cyber-muted mb-1">关联 Role（可选）</label>
              <div className="relative">
                <select
                  value={formData.roleId}
                  onChange={e => setFormData(prev => ({ ...prev, roleId: e.target.value }))}
                  className="appearance-none w-full px-3 py-2 rounded-lg bg-cyber-dark border border-cyber-cyan/20 text-cyber-white focus:border-cyber-cyan focus:outline-none cursor-pointer"
                >
                  <option value="">不关联</option>
                  {userRoles.map(role => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
                <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-cyber-muted pointer-events-none" />
              </div>
            </div>
          )}
        </form>
      </CyberModal>

      {/* Delete Confirmation Modal */}
      <CyberModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setContainerToDelete(null);
        }}
        title="确认删除"
        footer={
          <>
            <CyberButton
              variant="ghost"
              onClick={() => {
                setIsDeleteModalOpen(false);
                setContainerToDelete(null);
              }}
            >
              取消
            </CyberButton>
            <CyberButton
              variant="danger"
              onClick={handleDelete}
              disabled={actionLoading?.containerId === containerToDelete?.id && actionLoading?.action === 'delete'}
            >
              {actionLoading?.containerId === containerToDelete?.id && actionLoading?.action === 'delete'
                ? '删除中...'
                : '删除'}
            </CyberButton>
          </>
        }
      >
        <p className="text-cyber-white">
          确定要删除容器 <span className="text-cyber-cyan font-semibold">{containerToDelete?.name}</span> 吗？
        </p>
        <p className="text-cyber-muted text-sm mt-2">
          此操作不可撤销，容器中的所有数据将被永久删除。
        </p>
      </CyberModal>
    </div>
  );
}
