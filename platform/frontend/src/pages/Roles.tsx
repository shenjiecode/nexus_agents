import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CyberCard } from '../components/CyberCard';
import { CyberButton } from '../components/CyberButton';
import { CyberModal } from '../components/CyberModal';
import { StatusDot } from '../components/StatusDot';
import { useApi, apiRequest } from '../hooks/useApi';
import type { Role, MarketplaceRole } from '../types';

export interface StoredUser {
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

function DownloadIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

function UploadIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0l-4 4m4-4v12" />
    </svg>
  );
}

export function Roles() {
  // Tab state - default to marketplace tab
  const [activeTab, setActiveTab] = useState<'marketplace' | 'my'>('marketplace');
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  // Create modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Import modal state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedMarketplaceRole, setSelectedMarketplaceRole] = useState<MarketplaceRole | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importSearchQuery, setImportSearchQuery] = useState('');

  // Download state
  const [downloadingRoleId, setDownloadingRoleId] = useState<string | null>(null);

  // Keep localStorage reading logic for future use (StoredUser interface is used elsewhere)
  useEffect(() => {
    const stored = localStorage.getItem('nexus_org');
    if (stored) {
      try {
        JSON.parse(stored);
        // StoredUser data is read for potential future use
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  // Fetch data based on active tab
  const { data: marketplaceRoles, loading: marketplaceLoading, error: marketplaceError } = useApi<MarketplaceRole[]>('/api/marketplace/roles');
  const { data: myRoles, loading: myLoading, error: myError, refetch: refetchMyRoles } = useApi<Role[]>('/api/roles/mine');

  // Filter marketplace roles by search query
  const filteredMarketplaceRoles = useMemo(() => {
    if (!marketplaceRoles) return [];
    return marketplaceRoles.filter(role =>
      role.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [marketplaceRoles, searchQuery]);

  // Filter my roles by search query
  const filteredMyRoles = useMemo(() => {
    if (!myRoles) return [];
    return myRoles.filter(role =>
      role.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      role.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [myRoles, searchQuery]);

  // Create role
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const response = await apiRequest<Role>('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          variant: 'base',
          isPublic: false,
        }),
      });

      if (response.success && response.data) {
        setIsCreateModalOpen(false);
        setFormData({ name: '', description: '' });
        refetchMyRoles();
        // Navigate to debug page for the new role
        navigate(`/roles/${response.data.id}/debug`);
      } else {
        setSubmitError(response.message || '创建失败');
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : '创建失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Download marketplace role
  const handleDownloadMarketplaceRole = async (role: MarketplaceRole) => {
    setDownloadingRoleId(role.id);
    try {
      const response = await apiRequest<{ url: string; storageKey: string; expiresIn: number }>(
        `/api/marketplace/roles/${role.id}/download`,
        { method: 'GET' }
      );

      if (response.success && response.data?.url) {
        window.open(response.data.url, '_blank');
      } else {
        console.error('Failed to get download URL');
      }
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setDownloadingRoleId(null);
    }
  };

  // Import role from marketplace
  const handleImportRole = async () => {
    if (!selectedMarketplaceRole) return;

    setIsImporting(true);
    try {
      // Create a blank role based on the selected marketplace role
      const response = await apiRequest<Role>('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${selectedMarketplaceRole.name} (导入)`,
          description: '从市场导入',
          variant: 'base',
          isPublic: false,
        }),
      });

      if (response.success && response.data) {
        setIsImportModalOpen(false);
        setSelectedMarketplaceRole(null);
        setImportSearchQuery('');
        refetchMyRoles();
        // Navigate to debug page for the new role
        navigate(`/roles/${response.data.id}/debug`);
      } else {
        console.error('Failed to import role:', response.message);
      }
    } catch (err) {
      console.error('Import failed:', err);
    } finally {
      setIsImporting(false);
    }
  };

  // Filter marketplace roles for import modal
  const filteredImportRoles = useMemo(() => {
    if (!marketplaceRoles) return [];
    return marketplaceRoles.filter(role =>
      role.name.toLowerCase().includes(importSearchQuery.toLowerCase())
    );
  }, [marketplaceRoles, importSearchQuery]);

  // Check if marketplace service is not configured (503 error)
  const isMarketplaceNotConfigured = marketplaceError?.includes('503') || marketplaceError?.includes('服务未配置');

  return (
    <div className="page-transition space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-cyber-white glitch" data-text="Roles">
            Roles
          </h1>
          <p className="text-cyber-muted mt-1">浏览角色市场和我的角色</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <CyberButton
          variant={activeTab === 'marketplace' ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('marketplace')}
          icon={<GlobeIcon className="w-4 h-4" />}
        >
          角色市场
        </CyberButton>
        <CyberButton
          variant={activeTab === 'my' ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('my')}
          icon={<UserGroupIcon className="w-4 h-4" />}
        >
          我的角色
        </CyberButton>
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-cyber-muted" />
          <input
            type="text"
            placeholder={activeTab === 'marketplace' ? '搜索市场角色...' : '搜索我的角色...'}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-cyber-dark-card border border-cyber-cyan/20 text-cyber-white placeholder-cyber-muted focus:border-cyber-cyan focus:outline-none focus:ring-1 focus:ring-cyber-cyan"
          />
        </div>
      </div>

      {/* Marketplace Tab Content */}
      {activeTab === 'marketplace' && (
        <>
          {marketplaceLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <CyberCard key={i} className="h-48">
                  <div className="p-6 skeleton h-full" />
                </CyberCard>
              ))}
            </div>
          ) : isMarketplaceNotConfigured ? (
            <CyberCard>
              <div className="p-8 text-center text-cyber-muted">
                <GlobeIcon className="w-12 h-12 mx-auto mb-4 text-cyber-muted/50" />
                <p className="text-lg font-semibold text-cyber-white mb-2">市场服务未配置</p>
                <p>请联系管理员配置 OSS 存储服务以使用角色市场功能</p>
              </div>
            </CyberCard>
          ) : marketplaceError ? (
            <CyberCard>
              <div className="p-8 text-center text-cyber-error">加载失败：{marketplaceError}</div>
            </CyberCard>
          ) : filteredMarketplaceRoles.length === 0 ? (
            <CyberCard>
              <div className="p-8 text-center text-cyber-muted">
                {searchQuery ? '没有找到匹配的角色' : '暂无市场角色'}
              </div>
            </CyberCard>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMarketplaceRoles.map(role => (
                <CyberCard
                  key={role.id}
                  className="hover:border-cyber-cyan/50 transition-colors group"
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <div className="p-3 rounded-lg bg-cyber-cyan/10 text-cyber-cyan group-hover:bg-cyber-cyan/20 transition-colors">
                        <GlobeIcon className="w-6 h-6" />
                      </div>
                      <CyberButton
                        size="sm"
                        variant="ghost"
                        disabled={downloadingRoleId === role.id}
                        onClick={() => handleDownloadMarketplaceRole(role)}
                        icon={<DownloadIcon className="w-4 h-4" />}
                      >
                        {downloadingRoleId === role.id ? '下载中...' : '下载'}
                      </CyberButton>
                    </div>

                    <h3 className="text-lg font-display font-semibold text-cyber-white group-hover:text-cyber-cyan transition-colors mb-1">
                      {role.name}
                    </h3>

                    <p className="mt-2 text-sm text-cyber-muted line-clamp-2">
                      {role.description || '暂无描述'}
                    </p>

                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-xs text-cyber-muted font-mono truncate max-w-[200px]">
                        {role.storageKey}
                      </span>
                      <span className="text-xs text-cyber-muted font-mono">
                        {role.size ? `${(role.size / 1024 / 1024).toFixed(2)} MB` : ''}
                      </span>
                    </div>
                  </div>
                </CyberCard>
              ))}
            </div>
          )}
        </>
      )}

      {/* My Roles Tab Content */}
      {activeTab === 'my' && (
        <>
          {/* Action Buttons */}
          <div className="flex gap-2">
            <CyberButton
              variant="secondary"
              onClick={() => setIsImportModalOpen(true)}
              icon={<UploadIcon className="w-5 h-5" />}
            >
              导入角色
            </CyberButton>
            <CyberButton
              onClick={() => setIsCreateModalOpen(true)}
              icon={<PlusIcon className="w-5 h-5" />}
            >
              创建角色
            </CyberButton>
          </div>

          {myLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <CyberCard key={i} className="h-48">
                  <div className="p-6 skeleton h-full" />
                </CyberCard>
              ))}
            </div>
          ) : myError ? (
            <CyberCard>
              <div className="p-8 text-center text-cyber-error">加载失败：{myError}</div>
            </CyberCard>
          ) : filteredMyRoles.length === 0 ? (
            <CyberCard>
              <div className="p-8 text-center text-cyber-muted">
                {searchQuery ? '没有找到匹配的角色' : '暂无角色，点击上方按钮创建或导入'}
              </div>
            </CyberCard>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMyRoles.map(role => (
                <CyberCard
                  key={role.id}
                  className="cursor-pointer hover:border-cyber-cyan/50 transition-colors group"
                  onClick={() => navigate(`/roles/${role.id}/debug`)}
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <div className="p-3 rounded-lg bg-cyber-cyan/10 text-cyber-cyan group-hover:bg-cyber-cyan/20 transition-colors">
                        <UserGroupIcon className="w-6 h-6" />
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusDot
                          status={role.status === 'running' ? 'running' : 'stopped'}
                          size="sm"
                          showLabel={false}
                        />
                      </div>
                    </div>

                    <h3 className="text-lg font-display font-semibold text-cyber-white group-hover:text-cyber-cyan transition-colors mb-1">
                      {role.name}
                    </h3>

                    <p className="mt-2 text-sm text-cyber-muted line-clamp-2">
                      {role.description || '暂无描述'}
                    </p>

                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-xs text-cyber-muted">
                        {role.status === 'running' ? '运行中' : '已停止'}
                      </span>
                      <span className="text-xs text-cyber-muted font-mono">
                        {new Date(role.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </CyberCard>
              ))}
            </div>
          )}
        </>
      )}

      {/* Create Role Modal */}
      <CyberModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setSubmitError(null);
          setFormData({ name: '', description: '' });
        }}
        title="创建角色"
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
              placeholder="角色名称"
              className="w-full px-3 py-2 rounded-lg bg-cyber-dark border border-cyber-cyan/20 text-cyber-white placeholder-cyber-muted focus:border-cyber-cyan focus:outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-cyber-muted mb-1">描述</label>
            <textarea
              value={formData.description}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="描述此角色的功能..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-cyber-dark border border-cyber-cyan/20 text-cyber-white placeholder-cyber-muted focus:border-cyber-cyan focus:outline-none resize-none"
            />
          </div>
        </form>
      </CyberModal>

      {/* Import Role Modal */}
      <CyberModal
        isOpen={isImportModalOpen}
        onClose={() => {
          setIsImportModalOpen(false);
          setSelectedMarketplaceRole(null);
          setImportSearchQuery('');
        }}
        title="导入角色"
        footer={
          <>
            <CyberButton variant="ghost" onClick={() => {
              setIsImportModalOpen(false);
              setSelectedMarketplaceRole(null);
              setImportSearchQuery('');
            }}>
              取消
            </CyberButton>
            <CyberButton
              onClick={handleImportRole}
              disabled={!selectedMarketplaceRole || isImporting}
            >
              {isImporting ? '导入中...' : '导入'}
            </CyberButton>
          </>
        }
      >
        <div className="space-y-4">
          {/* Import search */}
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-cyber-muted" />
            <input
              type="text"
              placeholder="搜索市场角色..."
              value={importSearchQuery}
              onChange={e => setImportSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-cyber-dark border border-cyber-cyan/20 text-cyber-white placeholder-cyber-muted focus:border-cyber-cyan focus:outline-none focus:ring-1 focus:ring-cyber-cyan"
            />
          </div>

          {/* Marketplace roles list */}
          {marketplaceLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="p-4 rounded-lg bg-cyber-dark-card skeleton h-16" />
              ))}
            </div>
          ) : isMarketplaceNotConfigured ? (
            <div className="p-6 text-center text-cyber-muted">
              <GlobeIcon className="w-10 h-10 mx-auto mb-3 text-cyber-muted/50" />
              <p>市场服务未配置，无法导入角色</p>
            </div>
          ) : filteredImportRoles.length === 0 ? (
            <div className="p-6 text-center text-cyber-muted">
              {importSearchQuery ? '没有找到匹配的角色' : '暂无市场角色'}
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {filteredImportRoles.map(role => (
                <div
                  key={role.id}
                  onClick={() => setSelectedMarketplaceRole(role)}
                  className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                    selectedMarketplaceRole?.id === role.id
                      ? 'border-cyber-cyan bg-cyber-cyan/10'
                      : 'border-cyber-cyan/20 bg-cyber-dark-card hover:border-cyber-cyan/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-cyber-white">{role.name}</h4>
                      <p className="text-sm text-cyber-muted truncate max-w-[300px]">
                        {role.description || role.storageKey}
                      </p>
                    </div>
                    {selectedMarketplaceRole?.id === role.id && (
                      <div className="w-4 h-4 rounded-full bg-cyber-cyan" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CyberModal>
    </div>
  );
}
