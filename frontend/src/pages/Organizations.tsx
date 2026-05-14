import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CyberCard } from '../components/CyberCard';
import { CyberButton } from '../components/CyberButton';
import { CyberModal } from '../components/CyberModal';
import { StatusDot } from '../components/StatusDot';
import { useApi, apiRequest } from '../hooks/useApi';
import type { Organization, CreateOrganizationRequest } from '../types';

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

export function Organizations() {
  const { data: organizations, loading, error, refetch } = useApi<Organization[]>('/api/organizations');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState<CreateOrganizationRequest>({
    name: '',
    slug: '',
    description: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const filteredOrgs = organizations?.filter(org =>
    org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    org.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await apiRequest<Organization>('/api/organizations', {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      setIsModalOpen(false);
      setFormData({ name: '', slug: '', description: '' });
      refetch();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create organization');
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
          <h1 className="text-3xl font-display font-bold text-cyber-white glitch" data-text="组织管理">
            组织管理
          </h1>
          <p className="text-cyber-muted mt-1">管理组织及其 AI 代理</p>
        </div>
        <CyberButton
          onClick={() => setIsModalOpen(true)}
          icon={<PlusIcon className="w-5 h-5" />}
        >
          添加组织
        </CyberButton>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-cyber-muted" />
        <input
          type="text"
          placeholder="搜索组织..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-lg bg-cyber-dark-card border border-cyber-cyan/20 text-cyber-white placeholder-cyber-muted focus:border-cyber-cyan focus:outline-none focus:ring-1 focus:ring-cyber-cyan"
        />
      </div>

      {/* Organizations Table */}
      <CyberCard>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-cyber-cyan/20">
                <th className="text-left py-4 px-6 font-display font-semibold text-cyber-cyan">名称</th>
                <th className="text-left py-4 px-6 font-display font-semibold text-cyber-cyan">Slug</th>
                <th className="text-left py-4 px-6 font-display font-semibold text-cyber-cyan">状态</th>
                <th className="text-left py-4 px-6 font-display font-semibold text-cyber-cyan">智能体</th>
                <th className="text-left py-4 px-6 font-display font-semibold text-cyber-cyan">创建时间</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-cyber-cyan/10">
                    <td colSpan={5} className="py-4 px-6">
                      <div className="skeleton h-8 rounded" />
                    </td>
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={5} className="py-8 px-6 text-center text-cyber-error">
                    加载组织失败：{error}
                  </td>
                </tr>
              ) : filteredOrgs?.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 px-6 text-center text-cyber-muted">
                    未找到组织
                  </td>
                </tr>
              ) : (
                filteredOrgs?.map((org) => (
                  <tr
                    key={org.id}
                    className="border-b border-cyber-cyan/10 hover:bg-cyber-cyan/5 transition-colors"
                  >
                    <td className="py-4 px-6">
                      <Link
                        to={`/organizations/${org.slug}`}
                        className="font-medium text-cyber-white hover:text-cyber-cyan transition-colors"
                      >
                        {org.name}
                      </Link>
                    </td>
                    <td className="py-4 px-6">
                      <code className="font-mono text-sm text-cyber-muted bg-cyber-dark px-2 py-1 rounded">
                        {org.slug}
                      </code>
                    </td>
                    <td className="py-4 px-6">
                      {org.containerCount && org.containerCount > 0 ? (
                        <StatusDot status="active" showLabel />
                      ) : (
                        <span className="text-cyber-muted text-sm">无活跃智能体</span>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-cyber-white font-mono">{org.containerCount || 0}</span>
                    </td>
                    <td className="py-4 px-6 text-cyber-muted text-sm">
                      {new Date(org.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CyberCard>

      {/* Create Modal */}
      <CyberModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="创建组织"
        footer={
          <>
            <CyberButton variant="ghost" onClick={() => setIsModalOpen(false)}>
              取消
            </CyberButton>
            <CyberButton
              type="submit"
              form="org-form"
              disabled={isSubmitting || !formData.name || !formData.slug}
            >
              {isSubmitting ? '创建中...' : '创建组织'}
            </CyberButton>
          </>
        }
      >
        <form id="org-form" onSubmit={handleSubmit} className="space-y-4">
          {submitError && (
            <div className="p-3 rounded-lg bg-cyber-error/10 border border-cyber-error/30 text-cyber-error text-sm">
              {submitError}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-cyber-muted mb-1">组织名称</label>
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
              placeholder="例如：Acme Corporation"
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
              placeholder="e.g., acme-corp"
              className="w-full px-3 py-2 rounded-lg bg-cyber-dark border border-cyber-cyan/20 text-cyber-white placeholder-cyber-muted focus:border-cyber-cyan focus:outline-none font-mono"
              required
            />
            <p className="text-xs text-cyber-muted mt-1">用于 URL 和 API 调用</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-cyber-muted mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="组织简介..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-cyber-dark border border-cyber-cyan/20 text-cyber-white placeholder-cyber-muted focus:border-cyber-cyan focus:outline-none resize-none"
            />
          </div>
        </form>
      </CyberModal>
    </div>
  );
}