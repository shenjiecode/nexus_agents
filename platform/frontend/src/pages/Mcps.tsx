import { useState, useMemo, useEffect } from 'react';
import { CyberCard } from '../components/CyberCard';
import { CyberButton } from '../components/CyberButton';
import { CyberModal } from '../components/CyberModal';
import { useConfirm } from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';
import { useApi, apiRequest } from '../hooks/useApi';
import type { Mcp } from '../types';

interface StoredUser {
  id: string;
  name: string;
  slug: string;
  role: 'admin' | 'user';
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

function LockIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
}

function UnlockIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 11V7a4 4 0 118 0m-4 0v4m0 0H6a2 2 0 00-2 2v6a2 2 0 002 2h12a2 2 0 002-2v-6a2 2 0 00-2-2h-6z" />
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
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [configContent, setConfigContent] = useState('');
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  // Upload form state
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    category: '',
    isPublic: 'true',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Delete state
  const { openConfirm, ConfirmDialog } = useConfirm();
  const toast = useToast();

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

  // Fetch MCPs based on context
  const endpoint = useMemo(() => {
    if (activeTab === 'my' && user?.id) {
      return '/api/mcps/mine';
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
    return user.role === 'admin' || mcp.userId === user.id;
  };

  // Check if user is logged in
  const isLoggedIn = !!user;

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
      // Step 1: Create MCP metadata (JSON)
      const createResponse = await apiRequest<Mcp>('/api/mcps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          slug: formData.slug,
          description: formData.description,
          category: formData.category || '',
          isPublic: formData.isPublic,
        }),
      });

      if (!createResponse.success || !createResponse.data?.id) {
        throw new Error('Failed to create MCP');
      }

      const mcpId = createResponse.data.id;

      // Step 2: Upload file to backend (which uploads to OSS)
      const uploadFormData = new FormData();
      uploadFormData.append('file', selectedFile);

      const uploadResponse = await apiRequest<{ ossPath: string; size: number }>(`/api/mcps/${mcpId}/upload`, {
        method: 'POST',
        body: uploadFormData,
      });

      if (!uploadResponse.success) {
        throw new Error('Failed to upload file');
      }


      setIsUploadModalOpen(false);
      setFormData({ name: '', slug: '', description: '', category: '', isPublic: 'true' });
      setSelectedFile(null);
      refetch();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : '上传失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (mcp: Mcp) => {
    openConfirm({
      type: 'danger',
      title: '删除 MCP',
      message: `确定要删除 MCP "${mcp.name}" 吗？此操作不可撤销。`,
      confirmText: '删除',
      cancelText: '取消',
      onConfirm: async () => {
        try {
          await apiRequest(`/api/mcps/${mcp.id}`, {
            method: 'DELETE',
          });
          setSelectedMcp(null);
          refetch();
          toast.success('MCP 删除成功');
        } catch (err) {
          toast.error(err instanceof Error ? err.message : '删除失败');
        }
      },
    });
  };

  // Toggle MCP public status
  const handleTogglePublic = async (mcp: Mcp, e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus = mcp.isPublic === 'true' ? 'false' : 'true';
    try {
      await apiRequest(`/api/mcps/${mcp.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic: newStatus }),
      });
      refetch();
      toast.success(newStatus === 'true' ? '已设为公开' : '已设为私有');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败');
    }
  };

  // Fetch MCP config via backend proxy
  const fetchMcpConfig = async (mcp: Mcp) => {
    setIsLoadingConfig(true);
    setConfigError(null);
    try {
      const response = await apiRequest<{ content: string }>(`/api/mcps/${mcp.id}/download`);
      setConfigContent(response.data.content);
      setIsEditModalOpen(true);
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : '加载配置失败');
    } finally {
      setIsLoadingConfig(false);
    }
  };

  // Save MCP config via backend proxy
  const handleSaveConfig = async () => {
    if (!selectedMcp) return;
    setIsSavingConfig(true);
    setConfigError(null);
    try {
      await apiRequest(`/api/mcps/${selectedMcp.id}/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: configContent }),
      });
      setIsEditModalOpen(false);
      setConfigContent('');
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : '保存配置失败');
    } finally {
      setIsSavingConfig(false);
    }
  };

  return (
    <div className="page-transition space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-cyber-white glitch-cp2077 neon-glow-cyan" data-text="MCPs">
            MCPs
          </h1>
          <p className="text-cyber-muted mt-1">浏览和管理 MCP 配置</p>
        </div>
      </div>

      {/* Tabs */}
      {isLoggedIn && (
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

      {/* Public MCPs Tab */}
      {activeTab === 'public' && (
        <>
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
                  </div>
                </CyberCard>
              ))}
            </div>
          )}
        </>
      )}

      {/* My MCPs Tab */}
      {activeTab === 'my' && isLoggedIn && (
        <>
          {/* Upload Button */}
          <div className="flex gap-2">
            <CyberButton
              onClick={() => setIsUploadModalOpen(true)}
              icon={<PlusIcon className="w-5 h-5" />}
            >
              上传 MCP
            </CyberButton>
          </div>

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
                {searchQuery || selectedCategory ? '没有找到匹配的 MCPs' : '暂无 MCPs，点击上方按钮上传'}
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
                      <div className="flex items-center gap-2">
                        {/* Visibility indicator */}
                        <button
                          onClick={(e) => handleTogglePublic(mcp, e)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            mcp.isPublic === 'true'
                              ? 'bg-cyber-cyan/10 text-cyber-cyan hover:bg-cyber-cyan/20'
                              : 'bg-cyber-yellow/10 text-cyber-yellow hover:bg-cyber-yellow/20'
                          }`}
                          title={mcp.isPublic === 'true' ? '公开 - 点击切换为私有' : '私有 - 点击切换为公开'}
                        >
                          {mcp.isPublic === 'true' ? <UnlockIcon className="w-4 h-4" /> : <LockIcon className="w-4 h-4" />}
                        </button>
                        {mcp.category && (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-cyber-cyan/20 text-cyber-cyan">
                            {mcp.category}
                          </span>
                        )}
                        <CyberButton
                          size="sm"
                          variant="ghost"
                          onClick={(e: React.MouseEvent) => {
                            e.stopPropagation();
                            handleDelete(mcp);
                          }}
                          icon={<TrashIcon className="w-4 h-4" />}
                        >
                          删除
                        </CyberButton>
                      </div>
                    </div>

                    <h3 className="text-lg font-display font-semibold text-cyber-white group-hover:text-cyber-cyan transition-colors mb-1">
                      {mcp.name}
                    </h3>
                    <code className="text-xs text-cyber-muted font-mono">{mcp.slug}</code>

                    <p className="mt-2 text-sm text-cyber-muted line-clamp-2">{mcp.description}</p>
                  </div>
                </CyberCard>
              ))}
            </div>
          )}
        </>
      )}

      {/* Upload Modal */}
      <CyberModal
        isOpen={isUploadModalOpen}
        onClose={() => {
          setIsUploadModalOpen(false);
          setSubmitError(null);
          setFormData({ name: '', slug: '', description: '', category: '', isPublic: 'true' });
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
                setFormData({ name: '', slug: '', description: '', category: '', isPublic: 'true' });
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
            <label className="block text-sm font-medium text-cyber-muted mb-2">可见性</label>
            <div className="flex gap-2">
              <CyberButton
                type="button"
                variant={formData.isPublic === 'true' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setFormData(prev => ({ ...prev, isPublic: 'true' }))}
                icon={<UnlockIcon className="w-4 h-4" />}
              >
                公开
              </CyberButton>
              <CyberButton
                type="button"
                variant={formData.isPublic === 'false' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setFormData(prev => ({ ...prev, isPublic: 'false' }))}
                icon={<LockIcon className="w-4 h-4" />}
              >
                私有
              </CyberButton>
            </div>
            <p className="text-xs text-cyber-muted mt-1">
              {formData.isPublic === 'true' ? '公开后所有用户可在市场看到此 MCP' : '私有 MCP 仅自己可见'}
            </p>
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
                  variant="secondary"
                  disabled={isLoadingConfig}
                  icon={<JsonIcon className="w-4 h-4" />}
                  onClick={() => fetchMcpConfig(selectedMcp)}
                >
                  {isLoadingConfig ? '加载中...' : '编辑配置'}
                </CyberButton>
              )}
              {canManageMcp(selectedMcp) && (
                <CyberButton
                  variant="danger"
                  icon={<TrashIcon className="w-4 h-4" />}
                  onClick={() => handleDelete(selectedMcp)}
                >
                  删除
                </CyberButton>
              )}
            </>
          }
        >
          <div className="space-y-4">
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

            <div>
              <label className="text-xs font-mono text-cyber-muted uppercase">ID</label>
              <code className="block mt-1 px-2 py-1 rounded bg-cyber-dark text-cyber-muted font-mono text-xs break-all">
                {selectedMcp.id}
              </code>
            </div>
          </div>
        </CyberModal>
      )}

      {/* Edit Config Modal */}
      {selectedMcp && (
        <CyberModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setConfigContent('');
            setConfigError(null);
          }}
          title={`编辑配置 - ${selectedMcp.name}`}
          size="lg"
          footer={
            <>
              <CyberButton
                variant="ghost"
                onClick={() => {
                  setIsEditModalOpen(false);
                  setConfigContent('');
                  setConfigError(null);
                }}
              >
                取消
              </CyberButton>
              <CyberButton
                onClick={handleSaveConfig}
                disabled={isSavingConfig}
              >
                {isSavingConfig ? '保存中...' : '保存'}
              </CyberButton>
            </>
          }
        >
          <div className="space-y-4">
            {configError && (
              <div className="p-3 rounded-lg bg-cyber-error/10 border border-cyber-error/30 text-cyber-error text-sm">
                {configError}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-cyber-muted mb-2">
                JSON 配置
              </label>
              <textarea
                value={configContent}
                onChange={e => setConfigContent(e.target.value)}
                rows={20}
                className="w-full px-3 py-2 rounded-lg bg-cyber-dark border border-cyber-cyan/20 text-cyber-white font-mono text-sm focus:border-cyber-cyan focus:outline-none resize-none"
                placeholder="在此处编辑 MCP JSON 配置..."
                spellCheck={false}
              />
            </div>
          </div>
        </CyberModal>
      )}
      {ConfirmDialog}
    </div>
  );
}
