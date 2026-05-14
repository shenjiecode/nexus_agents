import { useState } from 'react';
import { CyberCard } from '../components/CyberCard';
import { CyberButton } from '../components/CyberButton';
import { CyberModal } from '../components/CyberModal';
import { useApi, apiRequest } from '../hooks/useApi';
import type { Role, CreateRoleRequest, Skill, Mcp } from '../types';

function UserIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

function PlusIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function TagIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
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

export function Roles() {
  const { data: roles, loading, error, refetch } = useApi<Role[]>('/api/roles');
  const { data: skills, loading: skillsLoading } = useApi<Skill[]>('/api/skills');
  const { data: mcps, loading: mcpsLoading } = useApi<Mcp[]>('/api/mcps');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRole, setExpandedRole] = useState<string | null>(null);
  const [formData, setFormData] = useState<CreateRoleRequest & { selectedSkills: string[]; selectedMcps: string[] }>({
    name: '',
    slug: '',
    description: '',
    selectedSkills: [],
    selectedMcps: [],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const filteredRoles = roles?.filter(role =>
    role.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    role.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await apiRequest<Role>('/api/roles', {
        method: 'POST',
        body: JSON.stringify({
          name: formData.name,
          slug: formData.slug,
          description: formData.description,
        }),
      });

      if (!response.success || !response.data) {
        throw new Error(response.message || '创建 Role 失败');
      }

      const role = response.data;

      // Associate selected skills
      if (formData.selectedSkills.length > 0) {
        for (const skillSlug of formData.selectedSkills) {
          await apiRequest(`/api/roles/${role.slug}/skills/${skillSlug}`, {
            method: 'POST',
          });
        }
      }

      // Associate selected MCPs
      if (formData.selectedMcps.length > 0) {
        for (const mcpSlug of formData.selectedMcps) {
          await apiRequest(`/api/roles/${role.slug}/mcps/${mcpSlug}`, {
            method: 'POST',
          });
        }
      }

      setIsModalOpen(false);
      setFormData({ name: '', slug: '', description: '', selectedSkills: [], selectedMcps: [] });
      refetch();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : '创建 Role 失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  };

  return (
    <div className="page-transition space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-cyber-white glitch" data-text="AI 角色">
            AI 角色
          </h1>
          <p className="text-cyber-muted mt-1">定义和管理 AI 代理 Role</p>
        </div>
        <CyberButton
          onClick={() => setIsModalOpen(true)}
          icon={<PlusIcon className="w-5 h-5" />}
        >
          创建角色
        </CyberButton>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-cyber-muted" />
        <input
          type="text"
          placeholder="搜索 Role..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-lg bg-cyber-dark-card border border-cyber-cyan/20 text-cyber-white placeholder-cyber-muted focus:border-cyber-cyan focus:outline-none focus:ring-1 focus:ring-cyber-cyan"
        />
      </div>

      {/* Roles Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <CyberCard key={i} className="h-48">
              <div className="p-6 skeleton h-full" />
            </CyberCard>
          ))}
        </div>
      ) : error ? (
        <CyberCard>
          <div className="p-8 text-center text-cyber-error">
            加载 Role 失败：{error}
          </div>
        </CyberCard>
      ) : filteredRoles?.length === 0 ? (
        <CyberCard>
          <div className="p-8 text-center text-cyber-muted">
            未找到 Role
          </div>
        </CyberCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRoles?.map((role) => (
            <CyberCard key={role.id} className="group" hoverEffect>
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 rounded-lg bg-cyber-purple/10 text-cyber-purple group-hover:bg-cyber-purple/20 transition-colors">
                    <UserIcon className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-mono text-cyber-muted">
                    {role.versions.length} 个版本
                  </span>
                </div>

                <h3 className="text-lg font-display font-semibold text-cyber-white group-hover:text-cyber-cyan transition-colors">
                  {role.name}
                </h3>
                <code className="text-sm text-cyber-muted font-mono">{role.slug}</code>

                {role.description && (
                  <p className="mt-2 text-cyber-muted text-sm line-clamp-2">{role.description}</p>
                )}

                {/* Version History */}
                {role.versions.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-cyber-cyan/10">
                    <button
                      onClick={() => setExpandedRole(expandedRole === role.id ? null : role.id)}
                      className="text-xs text-cyber-cyan hover:text-cyber-white transition-colors flex items-center gap-1"
                    >
                      <TagIcon className="w-3 h-3" />
                      {expandedRole === role.id ? '隐藏版本' : '显示版本'}
                    </button>

                    {expandedRole === role.id && (
                      <div className="mt-2 space-y-2">
                        {role.versions.map((version) => (
                          <div
                            key={version.id}
                            className="flex items-center justify-between p-2 rounded bg-cyber-dark text-sm"
                          >
                            <div>
                              <span className="text-cyber-purple font-mono">v{version.version}</span>
                              <span className="text-cyber-muted ml-2">{version.imageName}</span>
                            </div>
                            <span className="text-xs text-cyber-muted">
                              {new Date(version.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CyberCard>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <CyberModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="创建 Role"
        footer={
          <>
            <CyberButton variant="ghost" onClick={() => setIsModalOpen(false)}>
              取消
            </CyberButton>
            <CyberButton
              type="submit"
              form="role-form"
              disabled={isSubmitting || !formData.name || !formData.slug}
            >
              {isSubmitting ? '创建中...' : '创建 Role'}
            </CyberButton>
          </>
        }
      >
        <form id="role-form" onSubmit={handleSubmit} className="space-y-4">
          {submitError && (
            <div className="p-3 rounded-lg bg-cyber-error/10 border border-cyber-error/30 text-cyber-error text-sm">
              {submitError}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-cyber-muted mb-1">Role 名称</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => {
                const name = e.target.value;
                setFormData(prev => ({
                  ...prev,
                  name,
                  slug: prev.slug || generateSlug(name),
                }));
              }}
              placeholder="例如：Customer Support Agent"
              className="w-full px-3 py-2 rounded-lg bg-cyber-dark border border-cyber-cyan/20 text-cyber-white placeholder-cyber-muted focus:border-cyber-cyan focus:outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-cyber-muted mb-1">Slug</label>
            <input
              type="text"
              value={formData.slug}
              onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
              placeholder="例如：customer-support"
              className="w-full px-3 py-2 rounded-lg bg-cyber-dark border border-cyber-cyan/20 text-cyber-white placeholder-cyber-muted focus:border-cyber-cyan focus:outline-none font-mono"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-cyber-muted mb-1">描述</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="描述此 AI 代理的职责..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-cyber-dark border border-cyber-cyan/20 text-cyber-white placeholder-cyber-muted focus:border-cyber-cyan focus:outline-none resize-none"
            />
          </div>

          {/* Skills Section */}
          <div>
            <label className="block text-sm font-medium text-cyber-muted mb-2">选择 Skills</label>
            {skillsLoading ? (
              <div className="p-4 skeleton h-32 rounded-lg" />
            ) : skills && skills.length > 0 ? (
              <div className="max-h-40 overflow-y-auto space-y-2 p-3 rounded-lg bg-cyber-dark border border-cyber-cyan/20">
                {skills.map((skill) => (
                  <label key={skill.id} className="flex items-start gap-3 cursor-pointer hover:bg-cyber-dark-card/50 p-2 rounded transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.selectedSkills.includes(skill.slug)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData(prev => ({
                            ...prev,
                            selectedSkills: [...prev.selectedSkills, skill.slug]
                          }));
                        } else {
                          setFormData(prev => ({
                            ...prev,
                            selectedSkills: prev.selectedSkills.filter(s => s !== skill.slug)
                          }));
                        }
                      }}
                      className="mt-1 w-4 h-4 rounded border-cyber-cyan/30 bg-cyber-dark text-cyber-cyan focus:ring-cyber-cyan"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-cyber-white">{skill.name}</div>
                      <div className="text-xs text-cyber-muted truncate">{skill.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-cyber-dark border border-cyber-cyan/20 text-cyber-muted text-sm">
                暂无可用 Skills
              </div>
            )}
          </div>

          {/* MCPs Section */}
          <div>
            <label className="block text-sm font-medium text-cyber-muted mb-2">选择 MCPs</label>
            {mcpsLoading ? (
              <div className="p-4 skeleton h-32 rounded-lg" />
            ) : mcps && mcps.length > 0 ? (
              <div className="max-h-40 overflow-y-auto space-y-2 p-3 rounded-lg bg-cyber-dark border border-cyber-cyan/20">
                {mcps.map((mcp) => (
                  <label key={mcp.id} className="flex items-start gap-3 cursor-pointer hover:bg-cyber-dark-card/50 p-2 rounded transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.selectedMcps.includes(mcp.slug)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData(prev => ({
                            ...prev,
                            selectedMcps: [...prev.selectedMcps, mcp.slug]
                          }));
                        } else {
                          setFormData(prev => ({
                            ...prev,
                            selectedMcps: prev.selectedMcps.filter(m => m !== mcp.slug)
                          }));
                        }
                      }}
                      className="mt-1 w-4 h-4 rounded border-cyber-cyan/30 bg-cyber-dark text-cyber-cyan focus:ring-cyber-cyan"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-cyber-white">{mcp.name}</div>
                      <div className="text-xs text-cyber-muted truncate">{mcp.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-cyber-dark border border-cyber-cyan/20 text-cyber-muted text-sm">
                暂无可用 MCPs
              </div>
            )}
          </div>
        </form>
      </CyberModal>
    </div>
  );
}
