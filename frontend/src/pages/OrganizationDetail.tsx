import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CyberCard } from '../components/CyberCard';
import { CyberButton } from '../components/CyberButton';
import { CyberModal } from '../components/CyberModal';
import { StatusDot } from '../components/StatusDot';
import { useApi, apiRequest } from '../hooks/useApi';
import type { Organization, Container, Role, CreateContainerRequest } from '../types';

function ArrowLeftIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
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

function TrashIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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
function KeyIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
    </svg>
  );
}

function RefreshIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}


export function OrganizationDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [isHireModalOpen, setIsHireModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [containerToRemove, setContainerToRemove] = useState<string | null>(null);
  const [hireForm, setHireForm] = useState<CreateContainerRequest>({
    roleSlug: '',
    roleVersion: '',
  });
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isRegeneratingKey, setIsRegeneratingKey] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);

  const { data: organization, loading: orgLoading, error: orgError } = 
    useApi<Organization>(`/api/organizations/${slug}`);
  
  const { data: containers, loading: containersLoading, error: containersError, refetch: refetchContainers } = 
    useApi<Container[]>(`/api/orgs/${slug}/containers`);
  
  const { data: roles } = useApi<Role[]>('/api/roles');

  const handleHireContainer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hireForm.roleSlug || !hireForm.roleVersion) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await apiRequest<Container>(`/api/orgs/${slug}/containers`, {
        method: 'POST',
        body: JSON.stringify(hireForm),
      });
      setIsHireModalOpen(false);
      setHireForm({ roleSlug: '', roleVersion: '' });
      refetchContainers();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to hire container');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveContainer = async () => {
    if (!containerToRemove) return;

    try {
      await apiRequest<void>(`/api/containers/${containerToRemove}`, {
        method: 'DELETE',
      });
      setContainerToRemove(null);
      refetchContainers();
    } catch (err) {
      console.error('Failed to remove container:', err);
    }
  };

  const handleRegenerateApiKey = async () => {
    if (!slug) return;
    setIsRegeneratingKey(true);
    try {
      const result = await apiRequest<{ apiKey: string }>(`/api/orgs/${slug}/apikey`, {
        method: 'POST',
      });
      setApiKey(result.data.apiKey);
      setShowApiKeyModal(true);
    } catch (err) {
      console.error('Failed to regenerate API key:', err);
    } finally {
      setIsRegeneratingKey(false);
    }
  };

  const selectedRole = roles?.find(r => r.slug === hireForm.roleSlug);

  if (orgLoading) {
    return (
      <div className="page-transition space-y-6">
        <CyberCard className="h-40">
          <div className="p-6 skeleton h-full" />
        </CyberCard>
      </div>
    );
  }

  if (orgError || !organization) {
    return (
      <div className="page-transition">
        <CyberCard>
          <div className="p-8 text-center">
            <p className="text-cyber-error mb-4">未找到组织</p>
            <CyberButton onClick={() => navigate('/organizations')}>
              返回组织管理
            </CyberButton>
          </div>
        </CyberCard>
      </div>
    );
  }

  return (
    <div className="page-transition space-y-6">
      {/* Back Button & Header */}
      <div className="flex items-center gap-4">
        <CyberButton variant="ghost" onClick={() => navigate('/organizations')} className="!p-2">
          <ArrowLeftIcon className="w-5 h-5" />
        </CyberButton>
        <div>
          <h1 className="text-3xl font-display font-bold text-cyber-white">{organization.name}</h1>
          <p className="text-cyber-muted text-sm">组织详情</p>
        </div>
      </div>

      {/* Organization Info Card */}
      <CyberCard cornerAccent>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-xs font-mono text-cyber-muted uppercase">Slug</label>
              <code className="block mt-1 text-cyber-cyan font-mono">{organization.slug}</code>
            </div>
            <div>
              <label className="text-xs font-mono text-cyber-muted uppercase">容器数量</label>
              <div className="mt-1">
                {organization.containerCount && organization.containerCount > 0 ? (
                  <StatusDot status="active" showLabel />
                ) : (
                  <span className="text-cyber-muted">无活跃容器</span>
                )}
              </div>
            </div>
          </div>
          {organization.description && (
            <div className="mt-6 pt-6 border-t border-cyber-cyan/10">
              <label className="text-xs font-mono text-cyber-muted uppercase">描述</label>
              <p className="mt-1 text-cyber-white">{organization.description}</p>
            </div>
          )}
        </div>
      </CyberCard>

      {/* API Key Section */}
      <CyberCard>
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <KeyIcon className="w-5 h-5 text-cyber-purple" />
              <div>
                <h3 className="font-display font-semibold text-cyber-white">API Key</h3>
                <p className="text-sm text-cyber-muted">用于 API 请求认证</p>
              </div>
            </div>
            <CyberButton
              variant="secondary"
              size="sm"
              icon={<RefreshIcon className="w-4 h-4" />}
              onClick={handleRegenerateApiKey}
              disabled={isRegeneratingKey}
            >
              {isRegeneratingKey ? '重新生成中...' : '重新生成'}
            </CyberButton>
          </div>
          <div className="mt-4 p-3 rounded-lg bg-cyber-dark border border-cyber-cyan/10">
            <p className="text-sm text-cyber-muted">
              API Key 用于认证组织级别的 API 请求。重新生成后旧 Key 将失效。
            </p>
          </div>
        </div>
      </CyberCard>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-display font-semibold text-cyber-white">Containers</h2>
          <CyberButton
            onClick={() => setIsHireModalOpen(true)}
            icon={<PlusIcon className="w-5 h-5" />}
            size="sm"
          >
            雇佣 Container
          </CyberButton>
        </div>

        <CyberCard>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-cyber-cyan/20">
                  <th className="text-left py-4 px-6 font-display font-semibold text-cyber-cyan">Role</th>
                  <th className="text-left py-4 px-6 font-display font-semibold text-cyber-cyan">版本</th>
                  <th className="text-left py-4 px-6 font-display font-semibold text-cyber-cyan">状态</th>
                  <th className="text-left py-4 px-6 font-display font-semibold text-cyber-cyan">端口</th>
                  <th className="text-left py-4 px-6 font-display font-semibold text-cyber-cyan">Container ID</th>
                  <th className="text-left py-4 px-6 font-display font-semibold text-cyber-cyan">操作</th>
                </tr>
              </thead>
              <tbody>
                {containersLoading ? (
                  [...Array(3)].map((_, i) => (
                    <tr key={i} className="border-b border-cyber-cyan/10">
                      <td colSpan={6} className="py-4 px-6">
                        <div className="skeleton h-8 rounded" />
                      </td>
                    </tr>
                  ))
                ) : containersError ? (
                  <tr>
                    <td colSpan={6} className="py-8 px-6 text-center text-cyber-error">
                      加载 Container 失败
                    </td>
                  </tr>
                ) : containers?.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 px-6 text-center text-cyber-muted">
                      尚未雇佣 Container
                    </td>
                  </tr>
                ) : (
                  containers?.map((container) => (
                    <tr
                      key={container.id}
                      className="border-b border-cyber-cyan/10 hover:bg-cyber-cyan/5 transition-colors"
                    >
                      <td className="py-4 px-6">
                        <span className="font-medium text-cyber-white">{container.roleSlug}</span>
                      </td>
                      <td className="py-4 px-6">
                        <code className="font-mono text-sm text-cyber-purple">{container.roleVersion}</code>
                      </td>
                      <td className="py-4 px-6">
                        <StatusDot status={container.status} showLabel />
                      </td>
                      <td className="py-4 px-6">
                        <span className="font-mono text-cyber-white">{container.port}</span>
                      </td>
                      <td className="py-4 px-6">
                        <code className="font-mono text-xs text-cyber-muted">
                          {container.id.slice(0, 16)}
                        </code>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          {container.status === 'running' ? (
                            <CyberButton variant="ghost" size="sm" className="!p-1">
                              <StopIcon className="w-4 h-4 text-cyber-warning" />
                            </CyberButton>
                          ) : (
                            <CyberButton variant="ghost" size="sm" className="!p-1">
                              <PlayIcon className="w-4 h-4 text-cyber-success" />
                            </CyberButton>
                          )}
                          <CyberButton
                            variant="ghost"
                            size="sm"
                            className="!p-1"
                            onClick={() => setContainerToRemove(String(container.id))}
                          >
                            <TrashIcon className="w-4 h-4 text-cyber-error" />
                          </CyberButton>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CyberCard>
      </div>

      {/* Hire Container Modal */}
      <CyberModal
        isOpen={isHireModalOpen}
        onClose={() => setIsHireModalOpen(false)}
        title="雇佣新 Container"
        footer={
          <>
            <CyberButton variant="ghost" onClick={() => setIsHireModalOpen(false)}>
              取消
            </CyberButton>
            <CyberButton
              type="submit"
              form="hire-form"
              disabled={isSubmitting || !hireForm.roleSlug || !hireForm.roleVersion}
            >
              {isSubmitting ? '雇佣中...' : '雇佣 Container'}
            </CyberButton>
          </>
        }
      >
        <form id="hire-form" onSubmit={handleHireContainer} className="space-y-4">
          {submitError && (
            <div className="p-3 rounded-lg bg-cyber-error/10 border border-cyber-error/30 text-cyber-error text-sm">
              {submitError}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-cyber-muted mb-1">选择 Role</label>
            <select
              value={hireForm.roleSlug || ''}
              onChange={(e) => {
                const roleSlug = e.target.value;
                const role = roles?.find(r => r.slug === roleSlug);
                setHireForm(prev => ({
                  ...prev,
                  roleSlug,
                  roleVersion: role?.versions[0]?.version || '',
                }));
              }}
              className="w-full px-3 py-2 rounded-lg bg-cyber-dark border border-cyber-cyan/20 text-cyber-white focus:border-cyber-cyan focus:outline-none"
              required
            >
              <option value="">选择 Role...</option>
              {roles?.map(role => (
                <option key={role.id} value={role.slug}>{role.name}</option>
              ))}
            </select>
          </div>
          {selectedRole && (
            <div>
              <label className="block text-sm font-medium text-cyber-muted mb-1">版本</label>
              <select
                value={hireForm.roleVersion}
                onChange={(e) => setHireForm(prev => ({ ...prev, roleVersion: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-cyber-dark border border-cyber-cyan/20 text-cyber-white focus:border-cyber-cyan focus:outline-none"
                required
              >
                <option value="">选择版本...</option>
                {selectedRole.versions.map(version => (
                  <option key={version.id} value={version.version}>{version.version}</option>
                ))}
              </select>
            </div>
          )}
        </form>
      </CyberModal>

      {/* Remove Confirmation Modal */}
      <CyberModal
        isOpen={!!containerToRemove}
        onClose={() => setContainerToRemove(null)}
        title="移除 Container"
        size="sm"
        footer={
          <>
            <CyberButton variant="ghost" onClick={() => setContainerToRemove(null)}>
              取消
            </CyberButton>
            <CyberButton variant="danger" onClick={handleRemoveContainer}>
              移除
            </CyberButton>
          </>
        }
      >
        <p className="text-cyber-muted">
          确定要移除此 Container 吗？此操作不可撤销。
        </p>
      </CyberModal>

      {/* API Key Display Modal */}
      <CyberModal
        isOpen={showApiKeyModal && !!apiKey}
        onClose={() => { setShowApiKeyModal(false); setApiKey(null); }}
        title="API Key 已生成"
        size="sm"
        footer={
          <>
            <CyberButton variant="ghost" onClick={() => { setShowApiKeyModal(false); setApiKey(null); }}>
              关闭
            </CyberButton>
            <CyberButton
              onClick={() => {
                navigator.clipboard.writeText(apiKey!);
              }}
            >
              复制 Key
            </CyberButton>
          </>
        }
      >
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-cyber-dark border border-cyber-warning/30">
            <p className="text-sm text-cyber-warning mb-2">⚠️ 请妥善保管此 Key，关闭后将无法再次查看。</p>
            <code className="block text-sm font-mono text-cyber-cyan break-all select-all">
              {apiKey}
            </code>
          </div>
          <p className="text-sm text-cyber-muted">
            使用方式: 在 API 请求头中添加 <code className="text-cyber-cyan">X-Api-Key: {apiKey?.slice(0, 12)}...</code> 或 <code className="text-cyber-cyan">Authorization: Bearer {apiKey?.slice(0, 12)}...</code>
          </p>
        </div>
      </CyberModal>
    </div>
  );
}
