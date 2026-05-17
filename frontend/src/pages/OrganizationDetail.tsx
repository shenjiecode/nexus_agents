import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CyberCard } from '../components/CyberCard';
import { CyberButton } from '../components/CyberButton';
import { CyberModal } from '../components/CyberModal';
import { StatusDot } from '../components/StatusDot';
import { useApi, apiRequest } from '../hooks/useApi';
import type { Organization, Employee, MarketplaceRole } from '../types';
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



export function OrganizationDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [isHireModalOpen, setIsHireModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [employeeToRemove, setEmployeeToRemove] = useState<string | null>(null);
  const [hireForm, setHireForm] = useState<{ name: string; marketplaceRoleId: string }>({
    name: '',
    marketplaceRoleId: '',
  });
  const [authEditText, setAuthEditText] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isAuthSaving, setIsAuthSaving] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const { data: organization, loading: orgLoading, error: orgError } = 
    useApi<Organization>(`/api/organizations/${slug}`);
  
  const { data: employees, loading: employeesLoading, error: employeesError, refetch: refetchEmployees } = 
    useApi<Employee[]>(`/api/orgs/${slug}/employees`);
  
  const { data: marketplaceRoles } = useApi<MarketplaceRole[]>('/api/marketplace-roles');

  const handleHireEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hireForm.name) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await apiRequest<Employee>(`/api/orgs/${slug}/employees`, {
        method: 'POST',
        body: JSON.stringify(hireForm),
      });
      setIsHireModalOpen(false);
      setHireForm({ name: '', marketplaceRoleId: '' });
      refetchEmployees();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to hire employee');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveEmployee = async () => {
    if (!employeeToRemove) return;

    try {
      await apiRequest<void>(`/api/employees/${employeeToRemove}`, {
        method: 'DELETE',
      });
      setEmployeeToRemove(null);
      refetchEmployees();
    } catch (err) {
      console.error('Failed to remove employee:', err);
    }
  };



  const handleFetchAuth = async () => {
    if (!slug) return;
    setIsAuthLoading(true);
    setAuthError(null);
    try {
      const result = await apiRequest<{ auth: Record<string, { type: string; key: string }> }>(`/api/orgs/${slug}/auth`);
      if (result.data.auth) {
        setAuthEditText(JSON.stringify(result.data.auth, null, 2));
      } else {
        setAuthEditText(JSON.stringify({ anthropic: { type: 'api', key: '' } }, null, 2));
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : '加载认证配置失败');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleSaveAuth = async () => {
    if (!slug) return;
    setIsAuthSaving(true);
    setAuthError(null);
    try {
      JSON.parse(authEditText);
      await apiRequest(`/api/orgs/${slug}/auth`, {
        method: 'PUT',
        body: authEditText,
      });
      setAuthError(null);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : '保存认证配置失败');
    } finally {
      setIsAuthSaving(false);
    }
  };




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
              <label className="text-xs font-mono text-cyber-muted uppercase">员工数量</label>
              <div className="mt-1">
                {organization.employeeCount && organization.employeeCount > 0 ? (
                  <StatusDot status="active" showLabel />
                ) : (
                  <span className="text-cyber-muted">无活跃员工</span>
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


      {/* Auth Configuration Section */}
      <CyberCard>
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-cyber-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <div>
                <h3 className="font-display font-semibold text-cyber-white">认证配置 (auth.json)</h3>
                <p className="text-sm text-cyber-muted">智能体使用的 API Keys</p>
              </div>
            </div>
            <CyberButton variant="secondary" size="sm" onClick={handleFetchAuth} disabled={isAuthLoading}>
              {isAuthLoading ? '加载中...' : '加载配置'}
            </CyberButton>
          </div>
          {authError && (
            <div className="mt-4 p-3 rounded-lg bg-cyber-error/10 border border-cyber-error/30 text-cyber-error text-sm">
              {authError}
            </div>
          )}
          <div className="mt-4">
            <label className="block text-sm font-medium text-cyber-muted mb-2">auth.json 内容 (JSON 格式)</label>
            <textarea
              value={authEditText}
              onChange={(e) => setAuthEditText(e.target.value)}
              rows={6}
              className="w-full px-3 py-2 rounded-lg bg-cyber-dark border border-cyber-cyan/20 text-cyber-white font-mono text-sm focus:border-cyber-cyan focus:outline-none resize-none"
            />
            <p className="mt-2 text-xs text-cyber-muted">
              修改后点击保存，将自动重建该组织下所有智能体以应用新配置。
            </p>
            <div className="mt-3 flex gap-2">
              <CyberButton variant="secondary" size="sm" onClick={handleSaveAuth} disabled={isAuthSaving || !authEditText}>
                {isAuthSaving ? '保存中...' : '保存配置'}
              </CyberButton>
            </div>
          </div>
        </div>
      </CyberCard>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-display font-semibold text-cyber-white">Employees</h2>
          <CyberButton
            onClick={() => setIsHireModalOpen(true)}
            icon={<PlusIcon className="w-5 h-5" />}
            size="sm"
          >
            雇佣 Employee
          </CyberButton>
        </div>

        <CyberCard>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-cyber-cyan/20">
                  <th className="text-left py-4 px-6 font-display font-semibold text-cyber-cyan">名称</th>
                  <th className="text-left py-4 px-6 font-display font-semibold text-cyber-cyan">角色</th>
                  <th className="text-left py-4 px-6 font-display font-semibold text-cyber-cyan">状态</th>
                  <th className="text-left py-4 px-6 font-display font-semibold text-cyber-cyan">端口</th>
                  <th className="text-left py-4 px-6 font-display font-semibold text-cyber-cyan">Employee ID</th>
                  <th className="text-left py-4 px-6 font-display font-semibold text-cyber-cyan">操作</th>
                </tr>
              </thead>
              <tbody>
                {employeesLoading ? (
                  [...Array(3)].map((_, i) => (
                    <tr key={i} className="border-b border-cyber-cyan/10">
                      <td colSpan={6} className="py-4 px-6">
                        <div className="skeleton h-8 rounded" />
                      </td>
                    </tr>
                  ))
                ) : employeesError ? (
                  <tr>
                    <td colSpan={6} className="py-8 px-6 text-center text-cyber-error">
                      加载 Employee 失败
                    </td>
                  </tr>
                ) : employees?.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 px-6 text-center text-cyber-muted">
                      尚未雇佣 Employee
                    </td>
                  </tr>
                ) : (
                  employees?.map((employee) => (
                    <tr
                      key={employee.id}
                      className="border-b border-cyber-cyan/10 hover:bg-cyber-cyan/5 transition-colors cursor-pointer"
                      onClick={() => navigate(`/employees/${employee.id}`)}
                    >
                      <td className="py-4 px-6">
                        <span className="font-medium text-cyber-white">{(employee as any).name || employee.roleSlug}</span>
                      </td>
                      <td className="py-4 px-6">
                        <code className="font-mono text-sm text-cyber-purple">{(employee as any).marketplaceRoleId || employee.roleVersion}</code>
                      </td>
                      <td className="py-4 px-6">
                        <StatusDot status={employee.status} showLabel />
                      </td>
                      <td className="py-4 px-6">
                        <span className="font-mono text-cyber-white">{employee.port}</span>
                      </td>
                      <td className="py-4 px-6">
                        <code className="font-mono text-xs text-cyber-muted">
                          {employee.id.slice(0, 16)}
                        </code>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          {employee.status === 'running' ? (
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
                            onClick={() => setEmployeeToRemove(String(employee.id))}
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

      {/* Hire Employee Modal */}
      <CyberModal
        isOpen={isHireModalOpen}
        onClose={() => setIsHireModalOpen(false)}
        title="雇佣新 Employee"
        footer={
          <>
            <CyberButton variant="ghost" onClick={() => setIsHireModalOpen(false)}>
              取消
            </CyberButton>
            <CyberButton
              type="submit"
              form="hire-form"
              disabled={isSubmitting || !hireForm.name}
            >
              {isSubmitting ? '雇佣中...' : '雇佣 Employee'}
            </CyberButton>
          </>
        }
      >
        <form id="hire-form" onSubmit={handleHireEmployee} className="space-y-4">
          {submitError && (
            <div className="p-3 rounded-lg bg-cyber-error/10 border border-cyber-error/30 text-cyber-error text-sm">
              {submitError}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-cyber-muted mb-1">名称 *</label>
            <input
              type="text"
              value={hireForm.name}
              onChange={(e) => setHireForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="输入员工名称"
              className="w-full px-3 py-2 rounded-lg bg-cyber-dark border border-cyber-cyan/20 text-cyber-white focus:border-cyber-cyan focus:outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-cyber-muted mb-1">选择角色 (可选)</label>
            <select
              value={hireForm.marketplaceRoleId || ''}
              onChange={(e) => setHireForm(prev => ({ ...prev, marketplaceRoleId: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg bg-cyber-dark border border-cyber-cyan/20 text-cyber-white focus:border-cyber-cyan focus:outline-none"
            >
              <option value="">不选择角色</option>
              {marketplaceRoles?.map(role => (
                <option key={role.id} value={role.id}>{role.name}</option>
              ))}
            </select>
          </div>
        </form>
      </CyberModal>

      {/* Remove Confirmation Modal */}
      <CyberModal
        isOpen={!!employeeToRemove}
        onClose={() => setEmployeeToRemove(null)}
        title="移除 Employee"
        size="sm"
        footer={
          <>
            <CyberButton variant="ghost" onClick={() => setEmployeeToRemove(null)}>
              取消
            </CyberButton>
            <CyberButton variant="danger" onClick={handleRemoveEmployee}>
              移除
            </CyberButton>
          </>
        }
      >
        <p className="text-cyber-muted">
          确定要移除此 Employee 吗？此操作不可撤销。
        </p>
      </CyberModal>

    </div>
  );
}
