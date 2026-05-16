import { useState, useMemo, useEffect } from 'react';
import { CyberCard } from '../components/CyberCard';
import { CyberButton } from '../components/CyberButton';
import { CyberModal } from '../components/CyberModal';
import { StatusDot } from '../components/StatusDot';
import { useApi, apiRequest } from '../hooks/useApi';
import type { MarketplaceRole, Mcp, Skill } from '../types';

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

function TrashIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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

function ServerIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
    </svg>
  );
}

function TagIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
    </svg>
  );
}

function DocumentIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

export function MarketplaceRoles() {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [activeTab, setActiveTab] = useState<'public' | 'my'>('public');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<MarketplaceRole | null>(null);

  // Create form state
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    agentsMd: '',
  });
  const [selectedMcpIds, setSelectedMcpIds] = useState<string[]>([]);
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Delete state
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
    if (activeTab === 'my' && user?.role === 'org' && user?.id) {
      return `/api/marketplace-roles?org=${user.id}`;
    }
    return '/api/marketplace-roles';
  }, [activeTab, user]);

  const { data: roles, loading, error, refetch } = useApi<MarketplaceRole[]>(endpoint);

  // Fetch MCPs and Skills for multi-select
  const { data: mcps } = useApi<Mcp[]>('/api/mcps');
  const { data: skills } = useApi<Skill[]>('/api/skills');

  // Filter roles
  const filteredRoles = useMemo(() => {
    if (!roles) return [];
    return roles.filter(role => {
      const matchesSearch =
        role.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        role.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
        role.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });
  }, [roles, searchQuery]);

  // Check if user can manage a role
  const canManageRole = (role: MarketplaceRole): boolean => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (user.role === 'org' && role.organizationId === user.id) return true;
    return false;
  };

  // Check if user is logged in as org
  const isOrg = user?.role === 'org';
  const isAdmin = user?.role === 'admin';
  const canCreate = isOrg || isAdmin;

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await apiRequest<MarketplaceRole>('/api/marketplace-roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          slug: formData.slug,
          description: formData.description,
          mcpIds: selectedMcpIds,
          skillIds: selectedSkillIds,
          agentsMd: formData.agentsMd,
        }),
      });

      setIsCreateModalOpen(false);
      setFormData({ name: '', slug: '', description: '', agentsMd: '' });
      setSelectedMcpIds([]);
      setSelectedSkillIds([]);
      refetch();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : '创建失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (role: MarketplaceRole) => {
    if (!confirm(`确定要删除 Role "${role.name}" 吗？`)) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await apiRequest(`/api/marketplace-roles/${role.slug}`, {
        method: 'DELETE',
      });
      setSelectedRole(null);
      refetch();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : '删除失败');
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleMcpSelection = (mcpId: string) => {
    setSelectedMcpIds(prev =>
      prev.includes(mcpId)
        ? prev.filter(id => id !== mcpId)
        : [...prev, mcpId]
    );
  };

  const toggleSkillSelection = (skillId: string) => {
    setSelectedSkillIds(prev =>
      prev.includes(skillId)
        ? prev.filter(id => id !== skillId)
        : [...prev, skillId]
    );
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
              onClick={() => setSelectedRole(role)}
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-3 rounded-lg bg-cyber-cyan/10 text-cyber-cyan group-hover:bg-cyber-cyan/20 transition-colors">
                    <UserGroupIcon className="w-6 h-6" />
                  </div>
                </div>

                <h3 className="text-lg font-display font-semibold text-cyber-white group-hover:text-cyber-cyan transition-colors mb-1">
                  {role.name}
                </h3>
                <code className="text-xs text-cyber-muted font-mono">{role.slug}</code>

                <p className="mt-2 text-sm text-cyber-muted line-clamp-2">{role.description}</p>

                <div className="mt-3 flex items-center gap-4">
                  {role.config.mcpIds.length > 0 && (
                    <div className="flex items-center gap-1 text-xs text-cyber-muted">
                      <ServerIcon className="w-3 h-3" />
                      <span>{role.config.mcpIds.length} MCPs</span>
                    </div>
                  )}
                  {role.config.skillIds.length > 0 && (
                    <div className="flex items-center gap-1 text-xs text-cyber-muted">
                      <TagIcon className="w-3 h-3" />
                      <span>{role.config.skillIds.length} Skills</span>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <StatusDot
                      status={role.organizationId ? 'active' : 'running'}
                      size="sm"
                      showLabel={false}
                    />
                    <span className="text-xs text-cyber-muted">
                      {role.organizationId ? '私有' : '公共'}
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
          setFormData({ name: '', slug: '', description: '', agentsMd: '' });
          setSelectedMcpIds([]);
          setSelectedSkillIds([]);
        }}
        title="创建 Role"
        size="lg"
        footer={
          <>
            <CyberButton
              variant="ghost"
              onClick={() => {
                setIsCreateModalOpen(false);
                setSubmitError(null);
                setFormData({ name: '', slug: '', description: '', agentsMd: '' });
                setSelectedMcpIds([]);
                setSelectedSkillIds([]);
              }}
            >
              取消
            </CyberButton>
            <CyberButton
              type="submit"
              form="role-create-form"
              disabled={isSubmitting || !formData.name || !formData.slug}
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
              onChange={e => {
                const name = e.target.value;
                setFormData(prev => ({
                  ...prev,
                  name,
                  slug: prev.slug || generateSlug(name),
                }));
              }}
              placeholder="Role 名称"
              className="w-full px-3 py-2 rounded-lg bg-cyber-dark border border-cyber-cyan/20 text-cyber-white placeholder-cyber-muted focus:border-cyber-cyan focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-cyber-muted mb-1">Slug</label>
            <input
              type="text"
              value={formData.slug}
              onChange={e => setFormData(prev => ({ ...prev, slug: e.target.value }))}
              placeholder="role-slug"
              className="w-full px-3 py-2 rounded-lg bg-cyber-dark border border-cyber-cyan/20 text-cyber-white placeholder-cyber-muted focus:border-cyber-cyan focus:outline-none font-mono"
              required
            />
            <p className="text-xs text-cyber-muted mt-1">用于 URL 和 API 调用，创建后不可修改</p>
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

          {/* MCPs Multi-select */}
          <div>
            <label className="block text-sm font-medium text-cyber-muted mb-2">MCPs</label>
            <div className="max-h-32 overflow-y-auto rounded-lg bg-cyber-dark border border-cyber-cyan/20 p-2 space-y-1">
              {mcps && mcps.length > 0 ? (
                mcps.map(mcp => (
                  <label
                    key={mcp.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-cyber-cyan/5 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedMcpIds.includes(mcp.id)}
                      onChange={() => toggleMcpSelection(mcp.id)}
                      className="rounded border-cyber-cyan/30 bg-cyber-dark text-cyber-cyan focus:ring-cyber-cyan"
                    />
                    <span className="text-sm text-cyber-white">{mcp.name}</span>
                    <span className="text-xs text-cyber-muted font-mono">({mcp.slug})</span>
                  </label>
                ))
              ) : (
                <p className="text-xs text-cyber-muted px-2">暂无可用 MCPs</p>
              )}
            </div>
          </div>

          {/* Skills Multi-select */}
          <div>
            <label className="block text-sm font-medium text-cyber-muted mb-2">Skills</label>
            <div className="max-h-32 overflow-y-auto rounded-lg bg-cyber-dark border border-cyber-cyan/20 p-2 space-y-1">
              {skills && skills.length > 0 ? (
                skills.map(skill => (
                  <label
                    key={skill.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-cyber-cyan/5 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSkillIds.includes(skill.id)}
                      onChange={() => toggleSkillSelection(skill.id)}
                      className="rounded border-cyber-cyan/30 bg-cyber-dark text-cyber-cyan focus:ring-cyber-cyan"
                    />
                    <span className="text-sm text-cyber-white">{skill.name}</span>
                    <span className="text-xs text-cyber-muted font-mono">({skill.slug})</span>
                  </label>
                ))
              ) : (
                <p className="text-xs text-cyber-muted px-2">暂无可用 Skills</p>
              )}
            </div>
          </div>

          {/* AGENTS.md Editor */}
          <div>
            <label className="block text-sm font-medium text-cyber-muted mb-1">
              <div className="flex items-center gap-2">
                <DocumentIcon className="w-4 h-4" />
                <span>AGENTS.md 配置</span>
              </div>
            </label>
            <textarea
              value={formData.agentsMd}
              onChange={e => setFormData(prev => ({ ...prev, agentsMd: e.target.value }))}
              placeholder="# Role Configuration

## 概述
描述此角色的职责和能力...

## 行为准则
- 遵循组织规范
- 保持专业沟通"
              rows={10}
              className="w-full px-3 py-2 rounded-lg bg-cyber-dark border border-cyber-cyan/20 text-cyber-white placeholder-cyber-muted focus:border-cyber-cyan focus:outline-none resize-none font-mono text-sm"
            />
            <p className="text-xs text-cyber-muted mt-1">支持 Markdown 格式，定义角色的行为和指令</p>
          </div>
        </form>
      </CyberModal>

      {/* Role Detail Modal */}
      {selectedRole && (
        <CyberModal
          isOpen={!!selectedRole}
          onClose={() => {
            setSelectedRole(null);
            setDeleteError(null);
          }}
          title={selectedRole.name}
          size="lg"
          footer={
            <>
              <CyberButton variant="ghost" onClick={() => setSelectedRole(null)}>
                关闭
              </CyberButton>
              {canManageRole(selectedRole) && (
                <CyberButton
                  variant="danger"
                  disabled={isDeleting}
                  icon={<TrashIcon className="w-4 h-4" />}
                  onClick={() => handleDelete(selectedRole)}
                >
                  {isDeleting ? '删除中...' : '删除'}
                </CyberButton>
              )}
            </>
          }
        >
          <div className="space-y-4">
            {deleteError && (
              <div className="p-3 rounded-lg bg-cyber-error/10 border border-cyber-error/30 text-cyber-error text-sm">
                {deleteError}
              </div>
            )}

            <div>
              <label className="text-xs font-mono text-cyber-muted uppercase">Slug</label>
              <code className="block mt-1 px-2 py-1 rounded bg-cyber-dark text-cyber-cyan font-mono text-sm">
                {selectedRole.slug}
              </code>
            </div>

            <div>
              <label className="text-xs font-mono text-cyber-muted uppercase">描述</label>
              <p className="mt-1 text-cyber-white">{selectedRole.description}</p>
            </div>

            {/* MCPs */}
            <div>
              <label className="text-xs font-mono text-cyber-muted uppercase">MCPs</label>
              <div className="mt-1 flex flex-wrap gap-2">
                {selectedRole.config.mcpIds.length > 0 ? (
                  selectedRole.config.mcpIds.map(mcpId => {
                    const mcp = mcps?.find(m => m.id === mcpId);
                    return (
                      <span
                        key={mcpId}
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-cyber-purple/20 text-cyber-purple"
                      >
                        <ServerIcon className="w-3 h-3" />
                        {mcp ? mcp.name : mcpId}
                      </span>
                    );
                  })
                ) : (
                  <span className="text-cyber-muted text-sm">无</span>
                )}
              </div>
            </div>

            {/* Skills */}
            <div>
              <label className="text-xs font-mono text-cyber-muted uppercase">Skills</label>
              <div className="mt-1 flex flex-wrap gap-2">
                {selectedRole.config.skillIds.length > 0 ? (
                  selectedRole.config.skillIds.map(skillId => {
                    const skill = skills?.find(s => s.id === skillId);
                    return (
                      <span
                        key={skillId}
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-cyber-cyan/20 text-cyber-cyan"
                      >
                        <TagIcon className="w-3 h-3" />
                        {skill ? skill.name : skillId}
                      </span>
                    );
                  })
                ) : (
                  <span className="text-cyber-muted text-sm">无</span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-mono text-cyber-muted uppercase">可见性</label>
                <div className="mt-1 flex items-center gap-2">
                  <StatusDot
                    status={selectedRole.organizationId ? 'active' : 'running'}
                    size="sm"
                  />
                  <span className="text-cyber-white">
                    {selectedRole.organizationId ? '私有' : '公共'}
                  </span>
                </div>
              </div>
              <div>
                <label className="text-xs font-mono text-cyber-muted uppercase">创建时间</label>
                <p className="mt-1 text-cyber-white font-mono text-sm">
                  {new Date(selectedRole.createdAt).toLocaleString()}
                </p>
              </div>
            </div>

            {/* AGENTS.md Preview */}
            {selectedRole.config.agentsMd && (
              <div>
                <label className="text-xs font-mono text-cyber-muted uppercase">AGENTS.md</label>
                <div className="mt-1 p-3 rounded-lg bg-cyber-dark border border-cyber-cyan/20">
                  <pre className="text-sm text-cyber-white font-mono whitespace-pre-wrap">
                    {selectedRole.config.agentsMd}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </CyberModal>
      )}
    </div>
  );
}
