import { useState } from 'react';
import { CyberCard } from '../components/CyberCard';
import { CyberButton } from '../components/CyberButton';
import { useApi } from '../hooks/useApi';

interface Skill {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string | null;
  metadata: Record<string, unknown> | null;
}

interface Mcp {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string | null;
  serverType: string;
  command: string[];
  envTemplate: Record<string, string> | null;
  requiresApiKey: boolean;
}

function TagIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
    </svg>
  );
}

function PackageIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  );
}

function KeyIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
    </svg>
  );
}

export function Marketplace() {
  const [activeTab, setActiveTab] = useState<'skills' | 'mcps'>('skills');
  const [selectedItem, setSelectedItem] = useState<Skill | Mcp | null>(null);

  const { data: skills, loading: skillsLoading } = useApi<Skill[]>('/api/skills');
  const { data: mcps, loading: mcpsLoading } = useApi<Mcp[]>('/api/mcps');

  const loading = skillsLoading || mcpsLoading;

  return (
    <div className="page-transition space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-cyber-white glitch" data-text="市场">
            市场
          </h1>
          <p className="text-cyber-muted mt-1">浏览和发现 Skills 与 MCP</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <CyberButton
          variant={activeTab === 'skills' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setActiveTab('skills')}
        >
          <TagIcon className="w-4 h-4 mr-2" />
          Skills
        </CyberButton>
        <CyberButton
          variant={activeTab === 'mcps' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setActiveTab('mcps')}
        >
          <PackageIcon className="w-4 h-4 mr-2" />
          MCP
        </CyberButton>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <CyberCard key={i} className="h-48">
              <div className="p-6 skeleton h-full" />
            </CyberCard>
          ))}
        </div>
      ) : activeTab === 'skills' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {skills?.map(skill => (
            <CyberCard
              key={skill.id}
              className="cursor-pointer hover:border-cyber-cyan/50 transition-colors"
              onClick={() => setSelectedItem(skill)}
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-display font-semibold text-cyber-white">{skill.name}</h3>
                  {skill.category && (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-cyber-purple/20 text-cyber-purple">
                      {skill.category}
                    </span>
                  )}
                </div>
                <p className="text-sm text-cyber-muted line-clamp-3">{skill.description}</p>
                <div className="mt-4 flex items-center gap-2 text-xs text-cyber-muted">
                  <code className="px-2 py-0.5 rounded bg-cyber-dark">{skill.slug}</code>
                </div>
              </div>
            </CyberCard>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {mcps?.map(mcp => (
            <CyberCard
              key={mcp.id}
              className="cursor-pointer hover:border-cyber-cyan/50 transition-colors"
              onClick={() => setSelectedItem(mcp)}
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-display font-semibold text-cyber-white">{mcp.name}</h3>
                  <div className="flex items-center gap-2">
                    {mcp.requiresApiKey && (
                      <span title="需要 API Key"><KeyIcon className="w-4 h-4 text-cyber-warning" /></span>
                    )}
                    {mcp.category && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-cyber-purple/20 text-cyber-purple">
                        {mcp.category}
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-sm text-cyber-muted line-clamp-3">{mcp.description}</p>
                <div className="mt-4 flex items-center gap-2 text-xs text-cyber-muted">
                  <code className="px-2 py-0.5 rounded bg-cyber-dark">{mcp.slug}</code>
                  <span className="text-cyber-muted">•</span>
                  <span>{mcp.serverType}</span>
                </div>
              </div>
            </CyberCard>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-cyber-dark-card border border-cyber-cyan/30 rounded-xl shadow-2xl p-6">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-xl font-display font-bold text-cyber-white">{selectedItem.name}</h3>
              <CyberButton variant="ghost" size="sm" onClick={() => setSelectedItem(null)}>
                ✕
              </CyberButton>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-mono text-cyber-muted uppercase">Slug</label>
                <code className="block mt-1 text-cyber-cyan">{selectedItem.slug}</code>
              </div>
              
              <div>
                <label className="text-xs font-mono text-cyber-muted uppercase">描述</label>
                <p className="mt-1 text-cyber-white">{selectedItem.description}</p>
              </div>
              
              {selectedItem.category && (
                <div>
                  <label className="text-xs font-mono text-cyber-muted uppercase">分类</label>
                  <span className="mt-1 inline-block px-2 py-0.5 text-sm rounded-full bg-cyber-purple/20 text-cyber-purple">
                    {selectedItem.category}
                  </span>
                </div>
              )}
              
              {'serverType' in selectedItem && (
                <>
                  <div>
                    <label className="text-xs font-mono text-cyber-muted uppercase">服务器类型</label>
                    <p className="mt-1 text-cyber-white">{selectedItem.serverType}</p>
                  </div>
                  
                  <div>
                    <label className="text-xs font-mono text-cyber-muted uppercase">启动命令</label>
                    <code className="block mt-1 p-2 rounded bg-cyber-dark text-cyber-cyan text-sm font-mono break-all">
                      {selectedItem.command.join(' ')}
                    </code>
                  </div>
                  
                  {selectedItem.requiresApiKey && selectedItem.envTemplate && (
                    <div>
                      <label className="text-xs font-mono text-cyber-muted uppercase">需要的环境变量</label>
                      <div className="mt-1 p-3 rounded bg-cyber-dark border border-cyber-warning/30">
                        {Object.entries(selectedItem.envTemplate).map(([key, value]) => (
                          <div key={key} className="text-sm font-mono">
                            <span className="text-cyber-cyan">{key}</span>
                            <span className="text-cyber-muted"> = </span>
                            <span className="text-cyber-warning">{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
              
              {'metadata' in selectedItem && selectedItem.metadata && (
                <div>
                  <label className="text-xs font-mono text-cyber-muted uppercase">元数据</label>
                  <pre className="mt-1 p-2 rounded bg-cyber-dark text-cyber-muted text-xs overflow-auto max-h-40">
                    {JSON.stringify(selectedItem.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
            
            <div className="mt-6 flex justify-end gap-3">
              <CyberButton variant="ghost" onClick={() => setSelectedItem(null)}>
                关闭
              </CyberButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
