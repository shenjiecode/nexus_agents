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

export function OrganizationDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [isHireModalOpen, setIsHireModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [containerToRemove, setContainerToRemove] = useState<number | null>(null);
  const [hireForm, setHireForm] = useState<CreateContainerRequest>({
    roleId: 0,
    roleVersion: '',
  });

  const { data: organization, loading: orgLoading, error: orgError } = 
    useApi<Organization>(`/api/organizations/${slug}`);
  
  const { data: containers, loading: containersLoading, error: containersError, refetch: refetchContainers } = 
    useApi<Container[]>(`/api/orgs/${slug}/containers`);
  
  const { data: roles } = useApi<Role[]>('/api/roles');

  const handleHireContainer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hireForm.roleId || !hireForm.roleVersion) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await apiRequest<Container>(`/api/orgs/${slug}/containers`, {
        method: 'POST',
        body: JSON.stringify(hireForm),
      });
      setIsHireModalOpen(false);
      setHireForm({ roleId: 0, roleVersion: '' });
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

  const selectedRole = roles?.find(r => r.id === hireForm.roleId);

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
            <p className="text-cyber-error mb-4">Organization not found</p>
            <CyberButton onClick={() => navigate('/organizations')}>
              Back to Organizations
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
          <p className="text-cyber-muted text-sm">Organization Details</p>
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
              <label className="text-xs font-mono text-cyber-muted uppercase">Description</label>
              <p className="mt-1 text-cyber-white">{organization.description}</p>
            </div>
          )}
        </div>
      </CyberCard>

      {/* Containers Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-display font-semibold text-cyber-white">Containers</h2>
          <CyberButton
            onClick={() => setIsHireModalOpen(true)}
            icon={<PlusIcon className="w-5 h-5" />}
            size="sm"
          >
            Hire Container
          </CyberButton>
        </div>

        <CyberCard>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-cyber-cyan/20">
                  <th className="text-left py-4 px-6 font-display font-semibold text-cyber-cyan">Role</th>
                  <th className="text-left py-4 px-6 font-display font-semibold text-cyber-cyan">Version</th>
                  <th className="text-left py-4 px-6 font-display font-semibold text-cyber-cyan">Status</th>
                  <th className="text-left py-4 px-6 font-display font-semibold text-cyber-cyan">Port</th>
                  <th className="text-left py-4 px-6 font-display font-semibold text-cyber-cyan">Container ID</th>
                  <th className="text-left py-4 px-6 font-display font-semibold text-cyber-cyan">Actions</th>
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
                      Error loading containers
                    </td>
                  </tr>
                ) : containers?.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 px-6 text-center text-cyber-muted">
                      No containers hired yet
                    </td>
                  </tr>
                ) : (
                  containers?.map((container) => (
                    <tr
                      key={container.id}
                      className="border-b border-cyber-cyan/10 hover:bg-cyber-cyan/5 transition-colors"
                    >
                      <td className="py-4 px-6">
                        <span className="font-medium text-cyber-white">{container.roleName}</span>
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
                          {container.containerId.slice(0, 12)}...
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
                            onClick={() => setContainerToRemove(container.id)}
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
        title="Hire New Container"
        footer={
          <>
            <CyberButton variant="ghost" onClick={() => setIsHireModalOpen(false)}>
              Cancel
            </CyberButton>
            <CyberButton
              type="submit"
              form="hire-form"
              disabled={isSubmitting || !hireForm.roleId || !hireForm.roleVersion}
            >
              {isSubmitting ? 'Hiring...' : 'Hire Container'}
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
            <label className="block text-sm font-medium text-cyber-muted mb-1">Select Role</label>
            <select
              value={hireForm.roleId}
              onChange={(e) => {
                const roleId = parseInt(e.target.value);
                const role = roles?.find(r => r.id === roleId);
                setHireForm(prev => ({
                  ...prev,
                  roleId,
                  roleVersion: role?.versions[0]?.version || '',
                }));
              }}
              className="w-full px-3 py-2 rounded-lg bg-cyber-dark border border-cyber-cyan/20 text-cyber-white focus:border-cyber-cyan focus:outline-none"
              required
            >
              <option value="">Select a role...</option>
              {roles?.map(role => (
                <option key={role.id} value={role.id}>{role.name}</option>
              ))}
            </select>
          </div>
          {selectedRole && (
            <div>
              <label className="block text-sm font-medium text-cyber-muted mb-1">Version</label>
              <select
                value={hireForm.roleVersion}
                onChange={(e) => setHireForm(prev => ({ ...prev, roleVersion: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-cyber-dark border border-cyber-cyan/20 text-cyber-white focus:border-cyber-cyan focus:outline-none"
                required
              >
                <option value="">Select version...</option>
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
        title="Remove Container"
        size="sm"
        footer={
          <>
            <CyberButton variant="ghost" onClick={() => setContainerToRemove(null)}>
              Cancel
            </CyberButton>
            <CyberButton variant="danger" onClick={handleRemoveContainer}>
              Remove
            </CyberButton>
          </>
        }
      >
        <p className="text-cyber-muted">
          Are you sure you want to remove this container? This action cannot be undone.
        </p>
      </CyberModal>
    </div>
  );
}