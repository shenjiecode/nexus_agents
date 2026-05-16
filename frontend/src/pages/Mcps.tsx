import { useState, useMemo, useEffect } from 'react';
import { CyberCard } from '../components/CyberCard';
import { CyberButton } from '../components/CyberButton';
import { CyberModal } from '../components/CyberModal';
import { StatusDot } from '../components/StatusDot';
import { useApi, apiRequest } from '../hooks/useApi';
import type { Mcp } from '../types';

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

function ServerIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
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

function JsonIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  );
}

export function Mcps() {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [activeTab, setActiveTab] = useState<'public' | 'my'>('public');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedMcp, setSelectedMcp] = useState<Mcp | null>(null);

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

  // Fetch MCPs based on context
  const endpoint = useMemo(() => {
    // For org users, we can filter by org or get all public
    if (activeTab === 'my' && user?.role === 'org' && user?.id) {
      return `/api/mcps?org=${user.id}`;
    }
    return '/api/mcps';
  }, [activeTab, user]);

  const { data: mcps, loading, error, refetch } = useApi<Mcp[]>(endpoint);

  // Extract unique categories
  const categories = useMemo(() => {
    if (!mcps) return [];
    const cats = new Set<string>();
    mcps.forEach(m => {
      if (m.category) cats.add(m.category);
    });
    return Array.from(cats).sort();
  }, [mcps]);

  // Filter MCPs
  const filteredMcps = useMemo(() => {
    if (!mcps) return [];
    return mcps.filter(mcp => {
      const matchesSearch =
        mcp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        mcp.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
        mcp.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = !selectedCategory || mcp.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [mcps, searchQuery, selectedCategory]);

  // Check if user can manage a MCP
  const canManageMcp = (mcp: Mcp): boolean => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (user.role === 'org' && mcp.organizationId === user.id) return true;
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
      setSubmitError('请选择 JSON 文件');
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

      await apiRequest<Mcp>('/api/mcps', {
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

  const handleDelete = async (mcp: Mcp) => {
    if (!confirm(`确定要删除 MCP "${mcp.name}" 吗？`)) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await apiRequest(`/api/mcps/${mcp.slug}`, {
        method: 'DELETE',
      });
      setSelectedMcp(null);
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
          <h1 className="text-3xl font-display font-bold text-cyber-white glitch" data-text="MCPs">
            MCPs
          </h1>
          <p className="text-cyber-muted mt-1">浏览和管理 MCP 配置</p>
        </div>
        {canUpload && (
          <CyberButton
            onClick={() => setIsUploadModalOpen(true)}
            icon={<PlusIcon className="w-5 h-5" />}
          >
            上传 MCP
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
            公共 MCPs
          </CyberButton>
          <CyberButton
            variant={activeTab === 'my' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('my')}
            icon={<OrganizationIcon className="w-4 h-4" />}
          >
            我的 MCPs
          </CyberButton>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-cyber-muted" />
          <input
            type="text"
            placeholder="搜索 MCPs..."
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

      {/* MCPs Grid */}
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
      ) : filteredMcps.length === 0 ? (
        <CyberCard>
          <div className="p-8 text-center text-cyber-muted">
            {searchQuery || selectedCategory ? '没有找到匹配的 MCPs' : '暂无 MCPs'}
          </div>
        </CyberCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMcps.map(mcp => (
            <CyberCard
              key={mcp.id}
              className="cursor-pointer hover:border-cyber-cyan/50 transition-colors group"
              onClick={() => setSelectedMcp(mcp)}
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-3 rounded-lg bg-cyber-purple/10 text-cyber-purple group-hover:bg-cyber-purple/20 transition-colors">
                    <ServerIcon className="w-6 h-6" />
                  </div>
                  {mcp.category && (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-cyber-cyan/20 text-cyber-cyan">
                      {mcp.category}
                    </span>
                  )}
                </div>

                <h3 className="text-lg font-display font-semibold text-cyber-white group-hover:text-cyber-cyan transition-colors mb-1">
                  {mcp.name}
                </h3>
                <code className="text-xs text-cyber-muted font-mono">{mcp.slug}</code>

                <p className="mt-2 text-sm text-cyber-muted line-clamp-2">{mcp.description}</p>

                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <StatusDot
                      status={mcp.organizationId ? 'active' : 'running'}
                      size="sm"
                      showLabel={false}
                    />
                    <span className="text-xs text-cyber-muted">
                      {mcp.organizationId ? '私有' : '公共'}
                    </span>
                  </div>
                  <span className="text-xs text-cyber-muted font-mono">
                    {new Date(mcp.createdAt).toLocaleDateString()}
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
        title="上传 MCP"
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
              form="mcp-upload-form"
              disabled={isSubmitting || !formData.name || !formData.slug || !selectedFile}
            >
              {isSubmitting ? '上传中...' : '上传'}
            </CyberButton>
          </>
        }
      >
        <form id="mcp-upload-form" onSubmit={handleUpload} className="space-y-4">
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
              placeholder="MCP 名称"
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
              placeholder="mcp-slug"
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
              placeholder="描述此 MCP 的功能..."
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
              placeholder="例如：API、数据库、工具"
              className="w-full px-3 py-2 rounded-lg bg-cyber-dark border border-cyber-cyan/20 text-cyber-white placeholder-cyber-muted focus:border-cyber-cyan focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-cyber-muted mb-1">JSON 文件</label>
            <div className="relative">
              <input
                type="file"
                accept=".json"
                onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                className="hidden"
                id="mcp-file"
              />
              <label
                htmlFor="mcp-file"
                className="flex items-center gap-3 px-4 py-3 rounded-lg border-2 border-dashed border-cyber-cyan/30 bg-cyber-dark/50 text-cyber-muted hover:border-cyber-cyan/60 hover:text-cyber-cyan cursor-pointer transition-colors"
              >
                <JsonIcon className="w-5 h-5" />
                <span>{selectedFile ? selectedFile.name : '点击选择 JSON 文件'}</span>
              </label>
            </div>
          </div>
        </form>
      </CyberModal>

      {/* MCP Detail Modal */}
      {selectedMcp && (
        <CyberModal
          isOpen={!!selectedMcp}
          onClose={() => {
            setSelectedMcp(null);
            setDeleteError(null);
          }}
          title={selectedMcp.name}
          size="md"
          footer={
            <>
              <CyberButton variant="ghost" onClick={() => setSelectedMcp(null)}>
                关闭
              </CyberButton>
              {canManageMcp(selectedMcp) && (
                <CyberButton
                  variant="danger"
                  disabled={isDeleting}
                  icon={<TrashIcon className="w-4 h-4" />}
                  onClick={() => handleDelete(selectedMcp)}
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
                {selectedMcp.slug}
              </code>
            </div>

            <div>
              <label className="text-xs font-mono text-cyber-muted uppercase">描述</label>
              <p className="mt-1 text-cyber-white">{selectedMcp.description}</p>
            </div>

            {selectedMcp.category && (
              <div>
                <label className="text-xs font-mono text-cyber-muted uppercase">分类</label>
                <span className="mt-1 inline-block px-2 py-0.5 text-sm rounded-full bg-cyber-cyan/20 text-cyber-cyan">
                  {selectedMcp.category}
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-mono text-cyber-muted uppercase">可见性</label>
                <div className="mt-1 flex items-center gap-2">
                  <StatusDot
                    status={selectedMcp.organizationId ? 'active' : 'running'}
                    size="sm"
                  />
                  <span className="text-cyber-white">
                    {selectedMcp.organizationId ? '私有' : '公共'}
                  </span>
                </div>
              </div>
              <div>
                <label className="text-xs font-mono text-cyber-muted uppercase">创建时间</label>
                <p className="mt-1 text-cyber-white font-mono text-sm">
                  {new Date(selectedMcp.createdAt).toLocaleString()}
                </p>
              </div>
            </div>

            <div>
              <label className="text-xs font-mono text-cyber-muted uppercase">Storage Key</label>
              <code className="block mt-1 px-2 py-1 rounded bg-cyber-dark text-cyber-muted font-mono text-xs break-all">
                {selectedMcp.storageKey}
              </code>
            </div>
          </div>
        </CyberModal>
      )}
    </div>
  );
}
