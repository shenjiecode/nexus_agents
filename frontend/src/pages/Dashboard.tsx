import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CyberCard } from '../components/CyberCard';
import { useApi } from '../hooks/useApi';
import type { Organization, Role, Container, SystemStats } from '../types';

function StatCard({ title, value, subtitle, icon: Icon, color }: {
  title: string;
  value: number;
  subtitle?: string;
  icon: React.ElementType;
  color: 'cyan' | 'purple' | 'success';
}) {
  const colorClasses = {
    cyan: 'from-cyber-cyan/20 to-cyber-cyan/5 border-cyber-cyan/30 text-cyber-cyan',
    purple: 'from-cyber-purple/20 to-cyber-purple/5 border-cyber-purple/30 text-cyber-purple',
    success: 'from-cyber-success/20 to-cyber-success/5 border-cyber-success/30 text-cyber-success',
  };

  return (
    <CyberCard className="h-full" hoverEffect>
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-cyber-muted text-sm font-medium mb-1">{title}</p>
            <h3 className="text-3xl font-display font-bold text-cyber-white">{value}</h3>
            {subtitle && <p className="text-cyber-muted text-xs mt-1">{subtitle}</p>}
          </div>
          <div className={`p-3 rounded-lg bg-gradient-to-br ${colorClasses[color]}`}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </div>
    </CyberCard>
  );
}

function ActivityItem({ activity }: { activity: { message: string; timestamp: string; type: string } }) {
  const typeIcons: Record<string, string> = {
    org_created: '🏢',
    role_created: '👤',
    container_hired: '🚀',
    container_removed: '🗑️',
    container_status_changed: '🔄',
  };

  return (
    <div className="flex items-start gap-3 py-3 border-b border-cyber-cyan/10 last:border-0">
      <span className="text-lg">{typeIcons[activity.type] || '📋'}</span>
      <div className="flex-1 min-w-0">
        <p className="text-cyber-white text-sm truncate">{activity.message}</p>
        <p className="text-cyber-muted text-xs mt-0.5">{activity.timestamp}</p>
      </div>
    </div>
  );
}

function QuickActionCard({ title, description, to, icon: Icon }: {
  title: string;
  description: string;
  to: string;
  icon: React.ElementType;
}) {
  return (
    <Link to={to}>
      <CyberCard className="h-full group" hoverEffect>
        <div className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-cyber-cyan/10 text-cyber-cyan group-hover:bg-cyber-cyan/20 transition-colors">
              <Icon className="w-5 h-5" />
            </div>
            <h4 className="font-display font-semibold text-cyber-white group-hover:text-cyber-cyan transition-colors">
              {title}
            </h4>
          </div>
          <p className="text-cyber-muted text-sm">{description}</p>
        </div>
      </CyberCard>
    </Link>
  );
}

// Icons
function BuildingIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  );
}

function UserIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

function ContainerIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
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

export function Dashboard() {
  const { data: organizations, loading: orgsLoading } = useApi<Organization[]>('/api/organizations');
  const { data: roles, loading: rolesLoading } = useApi<Role[]>('/api/roles');
  const { data: containers, loading: containersLoading } = useApi<Container[]>('/api/containers');
  const [stats, setStats] = useState<SystemStats>({
    totalOrganizations: 0,
    totalRoles: 0,
    runningContainers: 0,
    totalContainers: 0,
  });

  useEffect(() => {
    if (organizations && roles && containers) {
      setStats({
        totalOrganizations: organizations.length,
        totalRoles: roles.length,
        runningContainers: containers.filter(c => c.status === 'running').length,
        totalContainers: containers.length,
      });
    }
  }, [organizations, roles, containers]);

  const loading = orgsLoading || rolesLoading || containersLoading;

  const activities = [
    { message: '组织 "TechCorp" 已创建', timestamp: '2 分钟前', type: 'org_created' },
    { message: '已为 Sales Role 雇佣 Container', timestamp: '15 分钟前', type: 'container_hired' },
    { message: 'Container 状态已变为运行中', timestamp: '1 小时前', type: 'container_status_changed' },
    { message: '新 Role "Customer Support" 已添加', timestamp: '2 小时前', type: 'role_created' },
  ];

  return (
    <div className="page-transition space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-cyber-white glitch" data-text="系统控制台">
            系统控制台
          </h1>
          <p className="text-cyber-muted mt-1">AI 代理基础设施概览</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-cyber-muted font-mono">
          <span className="w-2 h-2 rounded-full bg-cyber-success status-pulse" />
          系统在线
        </div>
      </div>

      {/* Stats Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <CyberCard key={i} className="h-32">
              <div className="p-6 skeleton h-full" />
            </CyberCard>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="组织"
            value={stats.totalOrganizations}
            icon={BuildingIcon}
            color="cyan"
          />
          <StatCard
            title="活跃角色"
            value={stats.totalRoles}
            icon={UserIcon}
            color="purple"
          />
          <StatCard
            title="运行容器"
            value={stats.runningContainers}
            subtitle={`共 ${stats.totalContainers} 个`}
            icon={ContainerIcon}
            color="success"
          />
          <StatCard
            title="系统运行时间"
            value={99.9}
            subtitle="过去30天"
            icon={ContainerIcon}
            color="cyan"
          />
        </div>
      )}

      {/* Quick Actions & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xl font-display font-semibold text-cyber-white">快捷操作</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <QuickActionCard
              title="添加组织"
              description="创建新组织以管理 Container"
              to="/organizations"
              icon={PlusIcon}
            />
            <QuickActionCard
              title="创建角色"
              description="定义新的 AI 代理 Role"
              to="/roles"
              icon={UserIcon}
            />
            <QuickActionCard
              title="查看 Container"
              description="管理运行中的 AI 代理实例"
              to="/containers"
              icon={ContainerIcon}
            />
            <QuickActionCard
              title="系统设置"
              description="配置全局系统偏好设置"
              to="/"
              icon={ContainerIcon}
            />
          </div>
        </div>

        {/* Recent Activity */}
        <div className="space-y-4">
          <h2 className="text-xl font-display font-semibold text-cyber-white">最近活动</h2>
          <CyberCard>
            <div className="p-4">
              {activities.map((activity, index) => (
                <ActivityItem key={index} activity={activity} />
              ))}
            </div>
          </CyberCard>
        </div>
      </div>
    </div>
  );
}
