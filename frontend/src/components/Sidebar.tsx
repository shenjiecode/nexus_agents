import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboardIcon },
  { path: '/organizations', label: 'Organizations', icon: BuildingIcon },
  { path: '/roles', label: 'Roles', icon: UserCogIcon },
  { path: '/containers', label: 'Containers', icon: ContainerIcon },
];

function LayoutDashboardIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  );
}

function BuildingIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  );
}

function UserCogIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function ContainerIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  );
}

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();

  return (
    <aside 
      className={`
        fixed left-0 top-0 h-screen
        bg-cyber-dark-card border-r border-cyber-cyan/20
        transition-all duration-300 z-40
        ${isCollapsed ? 'w-16' : 'w-64'}
      `}
    >
      {/* Logo */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-cyber-cyan/20">
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-cyber-cyan to-cyber-purple flex items-center justify-center">
              <span className="font-display font-bold text-cyber-dark text-lg">N</span>
            </div>
            <span className="font-display font-bold text-cyber-cyan text-lg neon-text">
              Nexus
            </span>
          </div>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1.5 rounded-lg text-cyber-muted hover:text-cyber-cyan hover:bg-cyber-cyan/10 transition-colors"
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
              flex items-center gap-3 px-3 py-2.5 rounded-lg
              transition-all duration-300 group relative
              ${isActive 
                ? 'bg-cyber-cyan/10 text-cyber-cyan border-l-2 border-cyber-cyan shadow-cyber-glow' 
                : 'text-cyber-muted hover:text-cyber-white hover:bg-cyber-cyan/5'
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
              <div className="absolute left-full ml-2 px-2 py-1 bg-cyber-dark-card border border-cyber-cyan/30 rounded text-sm text-cyber-white opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
                {item.label}
              </div>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom section */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-cyber-cyan/20">
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
          <div className="w-2 h-2 rounded-full bg-cyber-success status-pulse" />
          {!isCollapsed && (
            <span className="text-xs text-cyber-muted font-mono">
              System Online
            </span>
          )}
        </div>
      </div>
    </aside>
  );
}
