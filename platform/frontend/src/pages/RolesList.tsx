import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CyberCard } from '../components/CyberCard';
import { CyberButton } from '../components/CyberButton';
import { useApi } from '../hooks/useApi';
import type { Role, MarketplaceRole } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:13207';

// Icons
function PlusIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function UserIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
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

function PlayIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
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

function RocketIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

export function RolesList() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'my' | 'marketplace'>('my');

  // Fetch my roles
  const { data: myRoles, loading: myRolesLoading, refetch: refetchMyRoles } = useApi<Role[]>('/api/roles');

  // Fetch marketplace roles
  const { data: marketplaceRoles, loading: marketplaceLoading, refetch: refetchMarketplace } = useApi<MarketplaceRole[]>('/api/marketplace-roles');

  const handleCreateRole = () => {
    navigate('/roles/create');
  };

  const handleDebugRole = (role: Role) => {
    navigate(`/roles/${role.id}/debug`);
  };

const handleDownloadRole = async (roleId: string, name?: string) => {
    try {
      // Use raw fetch for blob downloads
      const response = await fetch(`${API_BASE_URL}/api/roles/${roleId}/export`, {
        method: 'GET',
      });
      
      if (!response.ok) {
        throw new Error(`下载失败 (${response.status})`);
      }
      
      const blob = await response.blob();
      
      // Create a download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name || roleId}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('下载失败:', err);
    }
  };

  return (
    <div className="page-transition space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-cyber-white glitch" data-text="角色">
            角色
          </h1>
          <p className="text-cyber-muted mt-1">管理和浏览角色模板</p>
        </div>
        <CyberButton
          onClick={handleCreateRole}
          icon={<PlusIcon className="w-5 h-5" />}
        >
          创建角色
        </CyberButton>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <CyberButton
          variant={activeTab === 'my' ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('my')}
          icon={<UserIcon className="w-4 h-4" />}
        >
          我的角色
        </CyberButton>
        <CyberButton
          variant={activeTab === 'marketplace' ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('marketplace')}
          icon={<GlobeIcon className="w-4 h-4" />}
        >
          角色市场
        </CyberButton>
      </div>

      {/* Content */}
      {activeTab === 'my' ? (
        <MyRolesSection
          roles={myRoles}
          loading={myRolesLoading}
          onCreate={handleCreateRole}
          onDebug={handleDebugRole}
          onDownload={handleDownloadRole}
          refetch={refetchMyRoles}
        />
      ) : (
        <MarketplaceSection
          roles={marketplaceRoles}
          loading={marketplaceLoading}
          onDownload={handleDownloadRole}
          refetch={refetchMarketplace}
        />
      )}
    </div>
  );
}

// My Roles Section Component
interface MyRolesSectionProps {
  roles: Role[] | null;
  loading: boolean;
  onCreate: () => void;
  onDebug: (role: Role) => void;
  onDownload: (roleId: string, name?: string) => void;
  refetch: () => void;
}

function MyRolesSection({ roles, loading, onCreate, onDebug, onDownload }: MyRolesSectionProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <CyberCard key={i} className="h-48">
            <div className="p-6">
              <div className="skeleton h-8 w-3/4 mb-4 rounded"></div>
              <div className="skeleton h-4 w-full mb-2 rounded"></div>
              <div className="skeleton h-4 w-2/3 rounded"></div>
            </div>
          </CyberCard>
        ))}
      </div>
    );
  }

  if (!roles || roles.length === 0) {
    return (
      <CyberCard className="text-center py-16">
        <div className="flex flex-col items-center gap-4">
          <div className="p-4 rounded-full bg-cyber-cyan/10">
            <RocketIcon className="w-12 h-12 text-cyber-cyan" />
          </div>
          <div>
            <h3 className="text-xl font-display font-semibold text-cyber-white mb-2">
              还没有角色？点击创建你的第一个角色
            </h3>
            <p className="text-cyber-muted max-w-md mx-auto mb-6">
              角色是 AI 员工的基础配置，定义了员工的能力、行为准则和技能组合
            </p>
          </div>
          <CyberButton onClick={onCreate} icon={<PlusIcon className="w-5 h-5" />}>
            创建第一个角色
          </CyberButton>
        </div>
      </CyberCard>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {roles.map((role) => (
        <CyberCard
          key={role.id}
          hoverEffect
          className="group"
        >
          <div className="p-6">
            <div className="flex items-start justify-between mb-3">
              <div className="p-3 rounded-lg bg-cyber-cyan/10 text-cyber-cyan group-hover:bg-cyber-cyan/20 transition-colors">
                <UserIcon className="w-6 h-6" />
              </div>
              <span className="text-xs text-cyber-muted font-mono">
                {role.versions?.length || 0} 版本
              </span>
            </div>

            <h3 className="text-lg font-display font-semibold text-cyber-white group-hover:text-cyber-cyan transition-colors mb-1">
              {role.name}
            </h3>
            <code className="text-xs text-cyber-muted font-mono block mb-2">{role.slug}</code>

            <p className="text-sm text-cyber-muted line-clamp-2 mb-4">
              {role.description || '暂无描述'}
            </p>

            <div className="flex items-center gap-2">
              <CyberButton
                variant="secondary"
                size="sm"
                onClick={() => onDebug(role)}
                icon={<PlayIcon className="w-4 h-4" />}
              >
                调试
              </CyberButton>
              <CyberButton
                variant="ghost"
                size="sm"
                onClick={() => onDownload(role.id, role.name)}
                icon={<DownloadIcon className="w-4 h-4" />}
              >
                下载
              </CyberButton>
            </div>
          </div>
        </CyberCard>
      ))}
    </div>
  );
}

// Marketplace Section Component
interface MarketplaceSectionProps {
  roles: MarketplaceRole[] | null;
  loading: boolean;
  onDownload: (roleId: string, name?: string) => void;
  refetch: () => void;
}

function MarketplaceSection({ roles, loading, onDownload }: MarketplaceSectionProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <CyberCard key={i} className="h-48">
            <div className="p-6">
              <div className="skeleton h-8 w-3/4 mb-4 rounded"></div>
              <div className="skeleton h-4 w-full mb-2 rounded"></div>
              <div className="skeleton h-4 w-2/3 rounded"></div>
            </div>
          </CyberCard>
        ))}
      </div>
    );
  }

  if (!roles || roles.length === 0) {
    return (
      <CyberCard className="text-center py-16">
        <div className="text-cyber-muted">
          <p className="text-lg">暂无公开角色</p>
          <p className="text-sm mt-2">角色市场空空如也</p>
        </div>
      </CyberCard>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {roles.map((role) => (
        <CyberCard
          key={role.id}
          hoverEffect
          className="group"
        >
          <div className="p-6">
            <div className="flex items-start justify-between mb-3">
              <div className="p-3 rounded-lg bg-cyber-purple/10 text-cyber-purple group-hover:bg-cyber-purple/20 transition-colors">
                <GlobeIcon className="w-6 h-6" />
              </div>
              <span className="text-xs px-2 py-1 rounded-full bg-cyber-success/20 text-cyber-success">
                公共
              </span>
            </div>

            <h3 className="text-lg font-display font-semibold text-cyber-white group-hover:text-cyber-purple transition-colors mb-1">
              {role.name}
            </h3>
            <code className="text-xs text-cyber-muted font-mono block mb-2">{role.slug}</code>

            <p className="text-sm text-cyber-muted line-clamp-2 mb-4">
              {role.description || '暂无描述'}
            </p>

            <div className="flex items-center gap-4 text-xs text-cyber-muted mb-4">
              {role.config?.mcpIds?.length > 0 && (
                <span>{role.config.mcpIds.length} MCPs</span>
              )}
              {role.config?.skillIds?.length > 0 && (
                <span>{role.config.skillIds.length} Skills</span>
              )}
            </div>

            <CyberButton
              variant="primary"
              size="sm"
              className="w-full"
              onClick={() => onDownload(role.id, role.name)}
              icon={<DownloadIcon className="w-4 h-4" />}
            >
              下载使用
            </CyberButton>
          </div>
        </CyberCard>
      ))}
    </div>
  );
}
