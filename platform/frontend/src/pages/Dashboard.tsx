import { Link } from 'react-router-dom';

function PuzzleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 01-.657.643 48.39 48.39 0 01-4.163-.3c.186 1.613.293 3.258.857 4.755a.75.75 0 01-.666 1.015H4.604c-.518 0-.926-.426-.876-.943.07-.727.242-1.426.502-2.078a.75.75 0 00-.375-1.003A2.25 2.25 0 012.25 6.75c0-1.036.84-1.875 1.875-1.875.48 0 .916.18 1.247.478a.75.75 0 001.05-.042c.5-.545 1.103-.99 1.778-1.297v0a.64.64 0 00.35-.56v0c0-.355-.186-.676-.401-.959" />
    </svg>
  );
}

function ServerIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21.75 17.25v-.228a4.5 4.5 0 00-.12-1.03l-2.268-9.64a3.375 3.375 0 00-3.285-2.602H7.923a3.375 3.375 0 00-3.285 2.602l-2.268 9.64a4.5 4.5 0 00-.12 1.03v.228m19.5 0a3 3 0 01-3 3H5.25a3 3 0 01-3-3m19.5 0a3 3 0 00-3-3H5.25a3 3 0 00-3 3m16.5 0h.008v.008h-.008v-.008zm-3 0h.008v.008h-.008v-.008z" />
    </svg>
  );
}

function MaskIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  );
}

const sections = [
  {
    title: '技能包',
    subtitle: 'Skills',
    description: '浏览和安装 AI Agent 技能包，赋予 Agent 新能力',
    to: '/skills',
    icon: PuzzleIcon,
    color: 'cyber-cyan',
    glow: 'group-hover:shadow-cyber-cyan/20',
  },
  {
    title: '服务端',
    subtitle: 'MCPs',
    description: '发现和部署 MCP 服务器，扩展 Agent 工具链',
    to: '/mcps',
    icon: ServerIcon,
    color: 'cyber-purple',
    glow: 'group-hover:shadow-cyber-purple/20',
  },
  {
    title: '角色',
    subtitle: 'Roles',
    description: '选择预置角色模板，快速部署专业化 AI Agent',
    to: '/roles',
    icon: MaskIcon,
    color: 'cyber-cyan',
    glow: 'group-hover:shadow-cyber-cyan/20',
  },
] as const;

export function Dashboard() {
  return (
    <div className="page-transition flex flex-col items-center justify-center min-h-[calc(100vh-8rem)] relative">
      {/* Noise overlay for CRT effect */}
      <div className="noise-overlay" />
      
      {/* City skyline silhouette at bottom */}
      <div className="cyber-skyline" />
      
      <div className="w-full max-w-4xl mx-auto px-4 relative z-10">
        <div className="text-center mb-16">
          {/* Enhanced platform badge with industrial style */}
          <div className="inline-block mb-8 px-5 py-2 border border-cyber-cyan/40 bg-cyber-cyan/5 relative">
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-cyber-cyan" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-cyber-cyan" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-cyber-cyan" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-cyber-cyan" />
            <span className="text-cyber-cyan text-xs font-mono tracking-widest uppercase">
              Nexus Agents Platform
            </span>
          </div>

          {/* Main title with CP2077 glitch effect and kanji decoration */}
          <h1 className="text-5xl md:text-7xl font-display font-bold text-cyber-white mb-6 tracking-tight relative">
            <span className="glitch-cp2077 neon-glow-cyan" data-text="Nexus Agents">
              Nexus Agents
            </span>
            {/* Kanji decoration */}
            <span className="kanji-decoration absolute -top-4 -right-4 md:right-8 text-cyber-cyan/30 text-2xl font-bold">
              ネオ東京
            </span>
          </h1>

          <p className="text-lg md:text-xl text-cyber-muted font-light max-w-lg mx-auto leading-relaxed mb-6">
            容器即人 — AI Agent 管理平台
          </p>

          {/* Enhanced neon divider with multiple glow layers */}
          <div className="relative">
            <div className="w-32 h-[2px] bg-gradient-to-r from-transparent via-cyber-cyan to-transparent mx-auto" />
            <div className="absolute inset-0 w-32 h-[2px] bg-gradient-to-r from-transparent via-cyber-cyan/50 to-transparent mx-auto blur-sm" />
            <div className="absolute inset-0 w-48 h-[1px] bg-gradient-to-r from-transparent via-cyber-cyan/30 to-transparent mx-auto top-[2px]" />
          </div>
        </div>

        {/* Cards grid with industrial card style */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {sections.map((section) => (
            <Link key={section.to} to={section.to} className="group block">
              <div className={`card-industrial h-full transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(0,217,255,0.2)] ${section.glow}`}>
                <div className="p-7 flex flex-col items-center text-center relative z-10">
                  {/* Enhanced icon container with industrial corner accents */}
                  <div className={`p-4 rounded-lg bg-${section.color}/10 text-${section.color} mb-5 group-hover:bg-${section.color}/20 transition-all duration-300 relative industrial-corners`}>
                    <section.icon className="w-8 h-8 group-hover:scale-110 transition-transform duration-300" />
                  </div>

                  <h3 className="font-display font-semibold text-xl text-cyber-white group-hover:text-cyber-cyan transition-colors mb-2">
                    {section.title}
                  </h3>

                  <p className="text-cyber-cyan/70 text-xs font-mono mb-3 tracking-wider uppercase">
                    {section.subtitle}
                  </p>

                  <p className="text-cyber-muted text-sm leading-relaxed mb-4">
                    {section.description}
                  </p>

                  <div className="mt-auto text-cyber-cyan/40 group-hover:text-cyber-cyan text-xs font-mono tracking-wider transition-colors flex items-center gap-1">
                    进入 
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
