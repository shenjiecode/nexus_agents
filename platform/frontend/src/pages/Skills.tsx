import { useState, useMemo, useEffect } from 'react';
import { CyberCard } from '../components/CyberCard';
import { CyberButton } from '../components/CyberButton';
import { CyberModal } from '../components/CyberModal';
import { useConfirm } from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';
import { useApi, apiRequest } from '../hooks/useApi';
import type { Skill } from '../types';

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

// Additional Icons
function FileIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function FolderIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  );
}

function DownloadIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

function EyeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
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

// Types for skill files
interface SkillFile {
  path: string;
  name: string;
  size: number;
  isDir: boolean;
  content?: string;
}

interface SkillFilesResponse {
  skill: Skill;
  files: SkillFile[];
  skillMdContent: string;
}
export function Skills() {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [activeTab, setActiveTab] = useState<'public' | 'my'>('public');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

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
  // View skill files state
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingSkill, setViewingSkill] = useState<Skill | null>(null);
  const [skillFiles, setSkillFiles] = useState<SkillFile[]>([]);
  const [skillMdContent, setSkillMdContent] = useState<string>('');
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
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

  // Fetch skills based on context
  const endpoint = useMemo(() => {
    if (activeTab === 'my' && user?.id) {
      return '/api/skills/mine';
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
    return user.role === 'admin' || skill.userId === user.id;
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
      setSubmitError('请选择 ZIP 文件');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Step 1: Create skill metadata (JSON)
      const createResponse = await apiRequest<Skill>('/api/skills', {
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
        throw new Error('Failed to create skill');
      }

      const skillId = createResponse.data.id;

      // Step 2: Upload file to backend (which uploads to OSS)
      const uploadFormData = new FormData();
      uploadFormData.append('file', selectedFile);

      const uploadResponse = await apiRequest<{ ossPath: string; size: number }>(`/api/skills/${skillId}/upload`, {
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

  const handleDelete = async (skill: Skill) => {
    openConfirm({
      type: 'danger',
      title: '删除 Skill',
      message: `确定要删除 Skill "${skill.name}" 吗？此操作不可撤销。`,
      confirmText: '删除',
      cancelText: '取消',
      onConfirm: async () => {
        try {
          await apiRequest(`/api/skills/${skill.id}`, {
            method: 'DELETE',
          });
          refetch();
          toast.success('Skill 删除成功');
        } catch (err) {
          toast.error(err instanceof Error ? err.message : '删除失败');
        }
      },
    });
  };

  // Toggle skill public status
  const handleTogglePublic = async (skill: Skill, e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus = skill.isPublic === 'true' ? 'false' : 'true';
    try {
      await apiRequest(`/api/skills/${skill.id}`, {
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

  // Fetch skill files from OSS
  const fetchSkillFiles = async (skill: Skill) => {
    setIsLoadingFiles(true);
    setFilesError(null);
    setViewingSkill(skill);
    setIsViewModalOpen(true);

    try {
      const response = await apiRequest<SkillFilesResponse>(`/api/skills/${skill.id}/files`);
      setSkillFiles(response.data.files || []);
      setSkillMdContent(response.data.skillMdContent || '');
    } catch (err) {
      setFilesError(err instanceof Error ? err.message : '加载文件失败');
      setSkillFiles([]);
      setSkillMdContent('');
    } finally {
      setIsLoadingFiles(false);
    }
  };

  // Handle download skill
  const handleDownloadSkill = async (skill: Skill) => {
    try {
      const response = await apiRequest<{ downloadUrl: string; skillName: string }>(`/api/skills/${skill.id}/download`);
      if (response.data.downloadUrl) {
        const link = document.createElement('a');
        link.href = response.data.downloadUrl;
        link.download = `${skill.slug}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      console.error('Download failed:', err);
    }
  };
  return (
    <div className="page-transition space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-cyber-white glitch-cp2077 neon-glow-cyan" data-text="Skills">
            Skills
          </h1>
          <p className="text-cyber-muted mt-1">浏览和管理 AI Skills</p>
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

      {/* Public Skills Tab */}
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
                  onClick={() => fetchSkillFiles(skill)}
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
                  </div>
                </CyberCard>
              ))}
            </div>
          )}
        </>
      )}

      {/* My Skills Tab */}
      {activeTab === 'my' && isLoggedIn && (
        <>
          {/* Upload Button */}
          <div className="flex gap-2">
            <CyberButton
              onClick={() => setIsUploadModalOpen(true)}
              icon={<PlusIcon className="w-5 h-5" />}
            >
              上传 Skill
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
          ) : filteredSkills.length === 0 ? (
            <CyberCard>
              <div className="p-8 text-center text-cyber-muted">
                {searchQuery || selectedCategory ? '没有找到匹配的 Skills' : '暂无 Skills，点击上方按钮上传'}
              </div>
            </CyberCard>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSkills.map(skill => (
                <CyberCard
                  key={skill.id}
                  className="cursor-pointer hover:border-cyber-cyan/50 transition-colors group"
                  onClick={() => fetchSkillFiles(skill)}
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <div className="p-3 rounded-lg bg-cyber-cyan/10 text-cyber-cyan group-hover:bg-cyber-cyan/20 transition-colors">
                        <TagIcon className="w-6 h-6" />
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Visibility indicator */}
                        <button
                          onClick={(e) => handleTogglePublic(skill, e)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            skill.isPublic === 'true'
                              ? 'bg-cyber-cyan/10 text-cyber-cyan hover:bg-cyber-cyan/20'
                              : 'bg-cyber-yellow/10 text-cyber-yellow hover:bg-cyber-yellow/20'
                          }`}
                          title={skill.isPublic === 'true' ? '公开 - 点击切换为私有' : '私有 - 点击切换为公开'}
                        >
                          {skill.isPublic === 'true' ? <UnlockIcon className="w-4 h-4" /> : <LockIcon className="w-4 h-4" />}
                        </button>
                        {skill.category && (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-cyber-purple/20 text-cyber-purple">
                            {skill.category}
                          </span>
                        )}
                        <CyberButton
                          size="sm"
                          variant="ghost"
                          onClick={(e: React.MouseEvent) => {
                            e.stopPropagation();
                            handleDelete(skill);
                          }}
                          icon={<TrashIcon className="w-4 h-4" />}
                        >
                          删除
                        </CyberButton>
                      </div>
                    </div>

                    <h3 className="text-lg font-display font-semibold text-cyber-white group-hover:text-cyber-cyan transition-colors mb-1">
                      {skill.name}
                    </h3>
                    <code className="text-xs text-cyber-muted font-mono">{skill.slug}</code>

                    <p className="mt-2 text-sm text-cyber-muted line-clamp-2">{skill.description}</p>
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
        title="上传 Skill"
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
              {formData.isPublic === 'true' ? '公开后所有用户可在市场看到此 Skill' : '私有 Skill 仅自己可见'}
            </p>
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

      {/* Skill View Modal with File Tree */}
      {isViewModalOpen && viewingSkill && (
        <CyberModal
          isOpen={isViewModalOpen}
          onClose={() => {
            setIsViewModalOpen(false);
            setViewingSkill(null);
            setSkillFiles([]);
            setSkillMdContent('');
            setFilesError(null);
            setSelectedFilePath(null);
          }}
          title={`查看 Skill: ${viewingSkill.name}`}
          size="lg"
          footer={
            <div className="flex items-center gap-3">
              <CyberButton
                variant="ghost"
                onClick={() => {
                  setIsViewModalOpen(false);
                  setViewingSkill(null);
                }}
              >
                关闭
              </CyberButton>
              <CyberButton
                onClick={() => handleDownloadSkill(viewingSkill)}
                icon={<DownloadIcon className="w-4 h-4" />}
              >
                下载
              </CyberButton>
              {canManageSkill(viewingSkill) && (
                <CyberButton
                  variant="danger"
                  onClick={() => {
                    setIsViewModalOpen(false);
                    handleDelete(viewingSkill);
                  }}
                  icon={<TrashIcon className="w-4 h-4" />}
                >
                  删除
                </CyberButton>
              )}
            </div>
          }
        >
          <div className="space-y-4">
            {filesError && (
              <div className="p-3 rounded-lg bg-cyber-error/10 border border-cyber-error/30 text-cyber-error text-sm">
                {filesError}
              </div>
            )}

            {isLoadingFiles ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyber-cyan"></div>
                <span className="ml-3 text-cyber-muted">加载文件...</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* File Tree Sidebar */}
                <div className="md:col-span-1">
                  <div className="bg-cyber-dark rounded-lg border border-cyber-cyan/20 p-3">
                    <h4 className="text-sm font-medium text-cyber-cyan mb-3 flex items-center gap-2">
                      <FolderIcon className="w-4 h-4" />
                      文件列表
                    </h4>
                    <div className="space-y-1 max-h-64 overflow-y-auto">
                      {skillFiles.length === 0 ? (
                        <p className="text-cyber-muted text-sm">暂无文件</p>
                      ) : (
                        skillFiles.map((file) => (
                          <button
                            key={file.path}
                            onClick={() => setSelectedFilePath(file.path)}
                            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left transition-colors ${
                              selectedFilePath === file.path
                                ? 'bg-cyber-cyan/20 text-cyber-cyan'
                                : 'hover:bg-cyber-dark-card text-cyber-muted hover:text-cyber-white'
                            }`}
                          >
                            <FileIcon className="w-4 h-4 flex-shrink-0" />
                            <span className="truncate">{file.name}</span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Content Preview */}
                <div className="md:col-span-2">
                  <div className="bg-cyber-dark rounded-lg border border-cyber-cyan/20 p-4 min-h-64">
                    {skillMdContent ? (
                      <div>
                        <h4 className="text-sm font-medium text-cyber-cyan mb-3">SKILL.md</h4>
                        <div className="prose prose-invert prose-sm max-w-none">
                          <pre className="bg-cyber-dark-card p-4 rounded-lg overflow-x-auto text-cyber-white whitespace-pre-wrap font-mono text-sm">
                            {skillMdContent}
                          </pre>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12 text-cyber-muted">
                        <EyeIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>选择文件查看内容</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Skill Info */}
            <div className="mt-4 pt-4 border-t border-cyber-cyan/20">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-cyber-muted">Slug:</span>{' '}
                  <code className="text-cyber-cyan font-mono">{viewingSkill.slug}</code>
                </div>
                <div>
                  <span className="text-cyber-muted">分类:</span>{' '}
                  <span className="text-cyber-white">{viewingSkill.category || '无'}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-cyber-muted">描述:</span>{' '}
                  <span className="text-cyber-white">{viewingSkill.description || '无'}</span>
                </div>
              </div>
            </div>
          </div>
        </CyberModal>
      )}
      {ConfirmDialog}
    </div>
  );
}
