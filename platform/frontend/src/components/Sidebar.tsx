import { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';

interface StoredUser {
  id: string;
  name?: string;
  nickname?: string;
  username?: string;
  slug?: string;
  email?: string;
  role?: 'admin' | 'user';
}

interface SidebarProps {
  isCollapsed: boolean;
  onCollapse: (collapsed: boolean) => void;
}

const navItems = [
  { path: '/', label: '首页', icon: HomeIcon },
  { path: '/skills', label: '技能', icon: TagIcon },
  { path: '/mcps', label: '服务', icon: ServerIcon },
  { path: '/roles', label: '角色', icon: UserGroupIcon },
  { path: '/containers', label: '容器', icon: ContainerIcon },
];

function HomeIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}
function TagIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
    </svg>
  );
}

function ServerIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
    </svg>
  );
}

function UserGroupIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}

function ContainerIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
    </svg>
  );
}

export function Sidebar({ isCollapsed, onCollapse }: SidebarProps) {
  const [user, setUser] = useState<StoredUser | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    try {
      const stored = localStorage.getItem('nexus_user');
      if (stored) {
        setUser(JSON.parse(stored));
      }
    } catch {
      setUser(null);
    }
  }, []);

  // Display name: nickname > name > username > email
  const displayName = user?.nickname || user?.name || user?.username || user?.email?.split('@')[0] || '用户';
  const userInitial = displayName.charAt(0).toUpperCase();

  return (
    <aside
      className={`
        fixed left-0 top-0 h-screen
        bg-cyber-dark-card border-r border-cyber-cyan box-glow-cyan
        transition-all duration-300 z-40
        ${isCollapsed ? 'w-16' : 'w-64'}
      `}
    >
      {/* Logo */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-cyber-cyan box-glow-cyan">
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-cyber-cyan to-cyber-purple flex items-center justify-center box-glow-cyan">
              <span className="font-display font-bold text-cyber-dark text-lg">N</span>
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-display font-bold text-cyber-cyan text-lg neon-text">
                Nexus
              </span>
              <span className="text-[10px] text-cyber-magenta font-mono tracking-wider opacity-80">ネクサス</span>
            </div>
          </div>
        )}
        <button
          onClick={() => onCollapse(!isCollapsed)}
          className="p-1.5 text-cyber-muted hover:text-cyber-cyan hover:bg-cyber-cyan/20 transition-all duration-200"
          style={{
            clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)',
            border: '1px solid rgba(0, 217, 255, 0.3)'
          }}
        >
          <svg
            className={`w-5 h-5 transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Navigation */}
      <nav className="p-2 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `
              flex items-center gap-3 px-3 py-2.5
              transition-all duration-300 group relative
              ${isActive
                ? 'bg-cyber-cyan/10 text-cyber-cyan border-l-2 border-cyber-cyan shadow-cyber-glow'
                : 'text-cyber-muted hover:text-cyber-cyan btn-industrial'
              }
              ${isCollapsed ? 'justify-center' : ''}
            `}
          >
            <span className={`transition-colors ${location.pathname === item.path ? 'text-cyber-cyan' : 'group-hover:text-cyber-cyan'}`}>
              <item.icon />
            </span>
            {!isCollapsed && (
              <span className="font-medium text-sm">{item.label}</span>
            )}
            {isCollapsed && (
              <div className="absolute left-full ml-2 px-2 py-1 bg-cyber-dark-card border border-cyber-cyan box-glow-cyan text-sm text-cyber-white opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
                {item.label}
              </div>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Warning stripes decoration */}
      <div className="absolute bottom-16 left-0 right-0 h-1 bg-gradient-to-r from-cyber-yellow via-cyber-red to-cyber-yellow opacity-80" />
      <div className="absolute bottom-[4.5rem] left-0 right-0 h-1.5" style={{background: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,193,7,0.4) 4px, rgba(255,193,7,0.4) 8px)'}} />
      
      {/* Bottom section - User card */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-cyber-cyan box-glow-cyan">
        {user && (
          <div className={`group relative flex items-center gap-2 ${isCollapsed ? 'justify-center' : ''}`}>
            {/* Avatar with neon glow */}
            <div className="relative flex-shrink-0 cursor-pointer">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyber-cyan to-cyber-purple flex items-center justify-center box-glow-cyan">
                <span className="font-display font-bold text-cyber-dark text-sm">{userInitial}</span>
              </div>
              {/* Neon ring effect */}
              <div className="absolute -inset-1 rounded-full border-2 border-cyber-cyan animate-pulse pointer-events-none box-glow-cyan" />
            </div>
            
            {/* Expanded: user info + logout button */}
            {!isCollapsed && (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-cyber-white neon-glow-cyan truncate">{displayName}</p>
                  <p className="text-xs text-cyber-muted font-mono truncate">{user?.email || user?.username}</p>
                </div>
                <button
                  onClick={() => navigate('/logout')}
                  className="p-1.5 rounded-lg text-cyber-muted hover:text-cyber-red hover:bg-cyber-red/20 hover:box-glow-red transition-all duration-200 flex-shrink-0"
                  title="退出登录"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </>
            )}
            
            {/* Collapsed: hover tooltip with username + logout */}
            {isCollapsed && (
              <div className="absolute left-full ml-2 bottom-0 px-3 py-2 bg-cyber-dark-card border border-cyber-cyan box-glow-cyan opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 flex items-center gap-2">
                <span className="text-sm text-cyber-white">{displayName}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate('/logout');
                  }}
                  className="p-1 rounded text-cyber-muted hover:text-cyber-red hover:bg-cyber-red/20 hover:box-glow-red transition-all duration-200"
                  title="退出登录"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
