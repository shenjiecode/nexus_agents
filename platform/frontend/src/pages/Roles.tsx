import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CyberCard } from '../components/CyberCard';
import { CyberButton } from '../components/CyberButton';
import { CyberModal } from '../components/CyberModal';
import { StatusDot } from '../components/StatusDot';
import { useApi, apiRequest } from '../hooks/useApi';
import type { Role } from '../types';

interface StoredUser {
  id: string;
  name: string;
  slug: string;
  role: 'admin' | 'org';
  orgId?: string;
}

function PlusIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function UserGroupIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
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


function GlobeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function OrganizationIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  );
}




export function Roles() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [activeTab, setActiveTab] = useState<'public' | 'my'>('public');
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  // Create form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Get user from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('nexus_org');
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        setUser(null);
      }
    }
  }, []);

  // Fetch roles based on context
  const endpoint = useMemo(() => {
    return '/api/roles';
  }, []);

  const { data: roles, loading, error, refetch } = useApi<Role[]>(endpoint);
  const { data: myRoles } = useApi<Role[]>('/api/roles/mine');

  // Filter roles
  const filteredRoles = useMemo(() => {
    if (!roles) return [];
    return roles.filter(role => {
      return role.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        role.description?.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [roles, searchQuery]);

  const isOrg = user?.role === 'org';
  const isAdmin = user?.role === 'admin';
  const canCreate = isOrg || isAdmin;
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await apiRequest<Role>('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          variant: 'base',
          isPublic: 'false',
        }),
      });
      setIsCreateModalOpen(false);
      setFormData({ name: '', description: '' });
      refetch();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : '创建失败');
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <div className="page-transition space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-cyber-white glitch" data-text="Roles">
            Roles
          </h1>
          <p className="text-cyber-muted mt-1">浏览和管理 Marketplace Roles</p>
        </div>
        {canCreate && (
          <CyberButton
            onClick={() => setIsCreateModalOpen(true)}
            icon={<PlusIcon className="w-5 h-5" />}
          >
            创建 Role
          </CyberButton>
        )}
      </div>

      {/* Tabs */}
      {isOrg && (
        <div className="flex gap-2">
          <CyberButton
            variant={activeTab === 'public' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('public')}
            icon={<GlobeIcon className="w-4 h-4" />}
          >
            公共 Roles
          </CyberButton>
          <CyberButton
            variant={activeTab === 'my' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('my')}
            icon={<OrganizationIcon className="w-4 h-4" />}
          >
            我的 Roles
          </CyberButton>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-cyber-muted" />
          <input
            type="text"
            placeholder="搜索 Roles..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-cyber-dark-card border border-cyber-cyan/20 text-cyber-white placeholder-cyber-muted focus:border-cyber-cyan focus:outline-none focus:ring-1 focus:ring-cyber-cyan"
          />
        </div>
      </div>

      {/* Roles Grid */}
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
      ) : activeTab === 'my' && myRoles ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {myRoles.filter(role =>
            role.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            role.description?.toLowerCase().includes(searchQuery.toLowerCase())
          ).map(role => (
            <CyberCard
              key={role.id}
              className="cursor-pointer hover:border-cyber-cyan/50 transition-colors group"
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-3 rounded-lg bg-cyber-cyan/10 text-cyber-cyan group-hover:bg-cyber-cyan/20 transition-colors">
                    <UserGroupIcon className="w-6 h-6" />
                  </div>
                  <CyberButton
                    size="sm"
                    variant="ghost"
                    onClick={() => navigate(`/roles/${role.id}/debug`)}
                  >
                    调试
                  </CyberButton>
                </div>

                <h3 className="text-lg font-display font-semibold text-cyber-white group-hover:text-cyber-cyan transition-colors mb-1">
                  {role.name}
                </h3>

                <p className="mt-2 text-sm text-cyber-muted line-clamp-2">{role.description}</p>

                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <StatusDot
                      status={role.status === 'running' ? 'running' : 'stopped'}
                      size="sm"
                      showLabel={false}
                    />
                    <span className="text-xs text-cyber-muted">
                      {role.status === 'running' ? '运行中' : '已停止'}
                    </span>
                  </div>
                  <span className="text-xs text-cyber-muted font-mono">
                    {new Date(role.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </CyberCard>
          ))}
        </div>
      ) : filteredRoles.length === 0 ? (
        <CyberCard>
          <div className="p-8 text-center text-cyber-muted">
            {searchQuery ? '没有找到匹配的 Roles' : '暂无 Roles'}
          </div>
        </CyberCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRoles.map(role => (
            <CyberCard
              key={role.id}
              className="cursor-pointer hover:border-cyber-cyan/50 transition-colors group"
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-3 rounded-lg bg-cyber-cyan/10 text-cyber-cyan group-hover:bg-cyber-cyan/20 transition-colors">
                    <UserGroupIcon className="w-6 h-6" />
                  </div>
                  <CyberButton
                    size="sm"
                    variant="ghost"
                    onClick={() => navigate(`/roles/${role.id}/debug`)}
                  >
                    调试
                  </CyberButton>
                </div>
                <h3 className="text-lg font-display font-semibold text-cyber-white group-hover:text-cyber-cyan transition-colors mb-1">
                  {role.name}
                </h3>
                <p className="mt-2 text-sm text-cyber-muted line-clamp-2">{role.description}</p>
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-cyber-cyan/10 text-cyber-cyan">
                    {role.variant}
                  </span>
                  <StatusDot
                    status={role.status === 'running' ? 'running' : 'stopped'}
                    size="sm"
                    showLabel={false}
                  />
                  <span className="text-xs text-cyber-muted">
                    {role.status === 'running' ? '运行中' : '已停止'}
                  </span>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-cyber-muted">
                      {role.isPublic === 'true' ? '公共' : '私有'}
                    </span>
                  </div>
                  <span className="text-xs text-cyber-muted font-mono">
                    {new Date(role.createdAt).toLocaleDateString()}
                  </span>
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
          setFormData({ name: '', description: '' });
        }}
        title="创建 Role"
        footer={
          <>
            <CyberButton variant="ghost" onClick={() => {
              setIsCreateModalOpen(false);
              setSubmitError(null);
              setFormData({ name: '', description: '' });
            }}>
              取消
            </CyberButton>
            <CyberButton
              type="submit"
              form="role-create-form"
              disabled={isSubmitting || !formData.name}
            >
              {isSubmitting ? '创建中...' : '创建'}
            </CyberButton>
          </>
        }
      >
        <form id="role-create-form" onSubmit={handleCreate} className="space-y-4">
          {submitError && (
            <div className="p-3 rounded-lg bg-cyber-error/10 border border-cyber-error/30 text-cyber-error text-sm">
              {submitError}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-cyber-muted mb-1">名称</label>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Role 名称"
              className="w-full px-3 py-2 rounded-lg bg-cyber-dark border border-cyber-cyan/20 text-cyber-white placeholder-cyber-muted focus:border-cyber-cyan focus:outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-cyber-muted mb-1">描述</label>
            <textarea
              value={formData.description}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="描述此 Role 的功能..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-cyber-dark border border-cyber-cyan/20 text-cyber-white placeholder-cyber-muted focus:border-cyber-cyan focus:outline-none resize-none"
            />
          </div>
        </form>
      </CyberModal>

    </div>
  );
}
