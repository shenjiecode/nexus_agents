import { useState, useMemo, useEffect } from 'react';
import { CyberCard } from '../components/CyberCard';
import { CyberButton } from '../components/CyberButton';
import { CyberModal } from '../components/CyberModal';
import { StatusDot } from '../components/StatusDot';
import { useApi, apiRequest } from '../hooks/useApi';
import type { Skill } from '../types';

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

function TrashIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function UploadIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
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

export function Skills() {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [activeTab, setActiveTab] = useState<'public' | 'my'>('public');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);

  // Upload form state
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    category: '',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
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

  // Fetch skills based on context
  const endpoint = useMemo(() => {
    // For org users, we can filter by org or get all public
    if (activeTab === 'my' && user?.role === 'org' && user?.id) {
      return `/api/skills?org=${user.id}`;
    }
    return '/api/skills';
  }, [activeTab, user]);

  const { data: skills, loading, error, refetch } = useApi<Skill[]>(endpoint);

  // Extract unique categories
  const categories = useMemo(() => {
    if (!skills) return [];
    const cats = new Set<string>();
    skills.forEach(s => {
      if (s.category) cats.add(s.category);
    });
    return Array.from(cats).sort();
  }, [skills]);

  // Filter skills
  const filteredSkills = useMemo(() => {
    if (!skills) return [];
    return skills.filter(skill => {
      const matchesSearch =
        skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        skill.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
        skill.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = !selectedCategory || skill.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [skills, searchQuery, selectedCategory]);

  // Check if user can manage a skill
  const canManageSkill = (skill: Skill): boolean => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (user.role === 'org' && skill.organizationId === user.id) return true;
    return false;
  };

  // Check if user is logged in as org
  const isOrg = user?.role === 'org';
  const isAdmin = user?.role === 'admin';
  const canUpload = isOrg || isAdmin;

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setSubmitError('请选择 ZIP 文件');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const form = new FormData();
      form.append('name', formData.name);
      form.append('slug', formData.slug);
      form.append('description', formData.description);
      form.append('category', formData.category || '');
      form.append('file', selectedFile);

      await apiRequest<Skill>('/api/skills', {
        method: 'POST',
        body: form,
      });

      setIsUploadModalOpen(false);
      setFormData({ name: '', slug: '', description: '', category: '' });
      setSelectedFile(null);
      refetch();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : '上传失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (skill: Skill) => {
    if (!confirm(`确定要删除 Skill "${skill.name}" 吗？`)) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await apiRequest(`/api/skills/${skill.slug}`, {
        method: 'DELETE',
      });
      setSelectedSkill(null);
      refetch();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : '删除失败');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="page-transition space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-cyber-white glitch" data-text="Skills">
            Skills
          </h1>
          <p className="text-cyber-muted mt-1">浏览和管理 AI Skills</p>
        </div>
        {canUpload && (
          <CyberButton
            onClick={() => setIsUploadModalOpen(true)}
            icon={<PlusIcon className="w-5 h-5" />}
          >
            上传 Skill
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
            公共 Skills
          </CyberButton>
          <CyberButton
            variant={activeTab === 'my' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('my')}
            icon={<OrganizationIcon className="w-4 h-4" />}
          >
            我的 Skills
          </CyberButton>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-cyber-muted" />
          <input
            type="text"
            placeholder="搜索 Skills..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-cyber-dark-card border border-cyber-cyan/20 text-cyber-white placeholder-cyber-muted focus:border-cyber-cyan focus:outline-none focus:ring-1 focus:ring-cyber-cyan"
          />
        </div>
        {categories.length > 0 && (
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="px-4 py-2 rounded-lg bg-cyber-dark-card border border-cyber-cyan/20 text-cyber-white focus:border-cyber-cyan focus:outline-none"
          >
            <option value="">所有分类</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Skills Grid */}
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
      ) : filteredSkills.length === 0 ? (
        <CyberCard>
          <div className="p-8 text-center text-cyber-muted">
            {searchQuery || selectedCategory ? '没有找到匹配的 Skills' : '暂无 Skills'}
          </div>
        </CyberCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSkills.map(skill => (
            <CyberCard
              key={skill.id}
              className="cursor-pointer hover:border-cyber-cyan/50 transition-colors group"
              onClick={() => setSelectedSkill(skill)}
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-3 rounded-lg bg-cyber-cyan/10 text-cyber-cyan group-hover:bg-cyber-cyan/20 transition-colors">
                    <TagIcon className="w-6 h-6" />
                  </div>
                  {skill.category && (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-cyber-purple/20 text-cyber-purple">
                      {skill.category}
                    </span>
                  )}
                </div>

                <h3 className="text-lg font-display font-semibold text-cyber-white group-hover:text-cyber-cyan transition-colors mb-1">
                  {skill.name}
                </h3>
                <code className="text-xs text-cyber-muted font-mono">{skill.slug}</code>

                <p className="mt-2 text-sm text-cyber-muted line-clamp-2">{skill.description}</p>

                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <StatusDot
                      status={skill.organizationId ? 'active' : 'running'}
                      size="sm"
                      showLabel={false}
                    />
                    <span className="text-xs text-cyber-muted">
                      {skill.organizationId ? '私有' : '公共'}
                    </span>
                  </div>
                  <span className="text-xs text-cyber-muted font-mono">
                    {new Date(skill.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </CyberCard>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      <CyberModal
        isOpen={isUploadModalOpen}
        onClose={() => {
          setIsUploadModalOpen(false);
          setSubmitError(null);
          setFormData({ name: '', slug: '', description: '', category: '' });
          setSelectedFile(null);
        }}
        title="上传 Skill"
        size="lg"
        footer={
          <>
            <CyberButton
              variant="ghost"
              onClick={() => {
                setIsUploadModalOpen(false);
                setSubmitError(null);
                setFormData({ name: '', slug: '', description: '', category: '' });
                setSelectedFile(null);
              }}
            >
              取消
            </CyberButton>
            <CyberButton
              type="submit"
              form="skill-upload-form"
              disabled={isSubmitting || !formData.name || !formData.slug || !selectedFile}
            >
              {isSubmitting ? '上传中...' : '上传'}
            </CyberButton>
          </>
        }
      >
        <form id="skill-upload-form" onSubmit={handleUpload} className="space-y-4">
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
              placeholder="Skill 名称"
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
              placeholder="skill-slug"
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
              placeholder="描述此 Skill 的功能..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-cyber-dark border border-cyber-cyan/20 text-cyber-white placeholder-cyber-muted focus:border-cyber-cyan focus:outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-cyber-muted mb-1">分类（可选）</label>
            <input
              type="text"
              value={formData.category}
              onChange={e => setFormData(prev => ({ ...prev, category: e.target.value }))}
              placeholder="例如：数据分析、文档处理"
              className="w-full px-3 py-2 rounded-lg bg-cyber-dark border border-cyber-cyan/20 text-cyber-white placeholder-cyber-muted focus:border-cyber-cyan focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-cyber-muted mb-1">ZIP 文件</label>
            <div className="relative">
              <input
                type="file"
                accept=".zip"
                onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                className="hidden"
                id="skill-file"
              />
              <label
                htmlFor="skill-file"
                className="flex items-center gap-3 px-4 py-3 rounded-lg border-2 border-dashed border-cyber-cyan/30 bg-cyber-dark/50 text-cyber-muted hover:border-cyber-cyan/60 hover:text-cyber-cyan cursor-pointer transition-colors"
              >
                <UploadIcon className="w-5 h-5" />
                <span>{selectedFile ? selectedFile.name : '点击选择 ZIP 文件'}</span>
              </label>
            </div>
          </div>
        </form>
      </CyberModal>

      {/* Skill Detail Modal */}
      {selectedSkill && (
        <CyberModal
          isOpen={!!selectedSkill}
          onClose={() => {
            setSelectedSkill(null);
            setDeleteError(null);
          }}
          title={selectedSkill.name}
          size="md"
          footer={
            <>
              <CyberButton variant="ghost" onClick={() => setSelectedSkill(null)}>
                关闭
              </CyberButton>
              {canManageSkill(selectedSkill) && (
                <CyberButton
                  variant="danger"
                  disabled={isDeleting}
                  icon={<TrashIcon className="w-4 h-4" />}
                  onClick={() => handleDelete(selectedSkill)}
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
                {selectedSkill.slug}
              </code>
            </div>

            <div>
              <label className="text-xs font-mono text-cyber-muted uppercase">描述</label>
              <p className="mt-1 text-cyber-white">{selectedSkill.description}</p>
            </div>

            {selectedSkill.category && (
              <div>
                <label className="text-xs font-mono text-cyber-muted uppercase">分类</label>
                <span className="mt-1 inline-block px-2 py-0.5 text-sm rounded-full bg-cyber-purple/20 text-cyber-purple">
                  {selectedSkill.category}
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-mono text-cyber-muted uppercase">可见性</label>
                <div className="mt-1 flex items-center gap-2">
                  <StatusDot
                    status={selectedSkill.organizationId ? 'active' : 'running'}
                    size="sm"
                  />
                  <span className="text-cyber-white">
                    {selectedSkill.organizationId ? '私有' : '公共'}
                  </span>
                </div>
              </div>
              <div>
                <label className="text-xs font-mono text-cyber-muted uppercase">创建时间</label>
                <p className="mt-1 text-cyber-white font-mono text-sm">
                  {new Date(selectedSkill.createdAt).toLocaleString()}
                </p>
              </div>
            </div>

            <div>
              <label className="text-xs font-mono text-cyber-muted uppercase">Storage Key</label>
              <code className="block mt-1 px-2 py-1 rounded bg-cyber-dark text-cyber-muted font-mono text-xs break-all">
                {selectedSkill.storageKey}
              </code>
            </div>
          </div>
        </CyberModal>
      )}
    </div>
  );
}
