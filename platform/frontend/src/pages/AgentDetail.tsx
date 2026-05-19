import { MatrixChat } from '../components/MatrixChat';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CyberCard } from '../components/CyberCard';
import { CyberButton } from '../components/CyberButton';
import { StatusDot } from '../components/StatusDot';
import { useApi, apiRequest } from '../hooks/useApi';
import type { Employee, Skill, Mcp } from '../types';

interface Session {
  id: string;
  organizationId: string;
  containerId: string;
  opencodeSessionId: string;
  status: string;
  createdAt: number;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

function ArrowLeftIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  );
}

function SendIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
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


export function AgentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatMode, setChatMode] = useState<'session' | 'matrix'>('matrix');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [editingAgentsMd, setEditingAgentsMd] = useState(false);
  const [agentsMdDraft, setAgentsMdDraft] = useState('');
  const [configLoading, setConfigLoading] = useState(false);
  const { data: employee, loading: employeeLoading, error: employeeError } = 
    useApi<Employee>(`/api/employees/${id}`);

  // Fetch organization to get orgSlug for Matrix chat
  const { data: organizations } = useApi<{ id: string; slug: string }[]>('/api/organizations');
  const employeeOrg = organizations?.find(org => org.id === employee?.organizationId);

  const { data: sessions, loading: sessionsLoading, refetch: refetchSessions } =
    useApi<Session[]>(`/api/employees/${id}/sessions`);
  
  // Fetch all skills and mcps from marketplace for name lookup
  const { data: allSkills } = useApi<Skill[]>('/api/skills');
  const { data: allMcps } = useApi<Mcp[]>('/api/mcps');
  
  // Fetch employee's AGENTS.md content
  const { data: agentsMdContent, loading: agentsMdLoading } = useApi<string>(`/api/employees/${id}/agents-md`);
  
  // Parse employee's mcpIds and skillIds from JSON strings
  const [employeeMcpIds, setEmployeeMcpIds] = useState<string[]>([]);
  const [employeeSkillIds, setEmployeeSkillIds] = useState<string[]>([]);
  
  useEffect(() => {
    if (employee?.mcpIds) {
      try {
        const parsed = JSON.parse(employee.mcpIds);
        if (Array.isArray(parsed)) {
          setEmployeeMcpIds(parsed);
        }
      } catch (err) {
        console.error('Failed to parse mcpIds:', err);
        setEmployeeMcpIds([]);
      }
    } else {
      setEmployeeMcpIds([]);
    }
  }, [employee?.mcpIds]);
  
  useEffect(() => {
    if (employee?.skillIds) {
      try {
        const parsed = JSON.parse(employee.skillIds);
        if (Array.isArray(parsed)) {
          setEmployeeSkillIds(parsed);
        }
      } catch (err) {
        console.error('Failed to parse skillIds:', err);
        setEmployeeSkillIds([]);
      }
    } else {
      setEmployeeSkillIds([]);
    }
  }, [employee?.skillIds]);
  
  // Build employee's mcps and skills with names
  const employeeMcps = useMemo(() => {
    if (!allMcps || employeeMcpIds.length === 0) return [];
    return employeeMcpIds.map(id => {
      const mcp = allMcps.find(m => m.id === id);
      return {
        id,
        name: mcp?.name || id,
        description: mcp?.description
      };
    });
  }, [allMcps, employeeMcpIds]);
  
  const employeeSkills = useMemo(() => {
    if (!allSkills || employeeSkillIds.length === 0) return [];
    return employeeSkillIds.map(id => {
      const skill = allSkills.find(s => s.id === id);
      return {
        id,
        name: skill?.name || id,
        description: skill?.description
      };
    });
  }, [allSkills, employeeSkillIds]);

  // Trigger health check when employee loads
  useEffect(() => {
    if (employee && id) {
      apiRequest<{ healthStatus: string }>(`/api/employees/${id}/health-check`, { method: 'POST' })
        .then(result => {
          if (result.data?.healthStatus) {
            // Health status updated on backend, employee will refetch
          }
        })
        .catch(err => console.error('Health check failed:', err));
    }
  }, [employee, id]);


  // ============== Config Handlers ==============

  const handleInstallMcp = async (mcpId: string) => {
    if (!id || configLoading) return;
    setConfigLoading(true);
    try {
      await apiRequest(`/api/employees/${id}/mcps/${mcpId}/install`, { method: 'POST' });
      // Refresh employee data
      const result = await apiRequest<Employee>(`/api/employees/${id}`);
      if (result.data?.mcpIds) {
        setEmployeeMcpIds(JSON.parse(result.data.mcpIds));
      }
    } catch (err) {
      console.error('Failed to install MCP:', err);
    } finally {
      setConfigLoading(false);
    }
  };

  const handleUninstallMcp = async (mcpId: string) => {
    if (!id || configLoading) return;
    setConfigLoading(true);
    try {
      await apiRequest(`/api/employees/${id}/mcps/${mcpId}`, { method: 'DELETE' });
      setEmployeeMcpIds(prev => prev.filter(m => m !== mcpId));
    } catch (err) {
      console.error('Failed to uninstall MCP:', err);
    } finally {
      setConfigLoading(false);
    }
  };

  const handleInstallSkill = async (skillId: string) => {
    if (!id || configLoading) return;
    setConfigLoading(true);
    try {
      await apiRequest(`/api/employees/${id}/skills/${skillId}/install`, { method: 'POST' });
      const result = await apiRequest<Employee>(`/api/employees/${id}`);
      if (result.data?.skillIds) {
        setEmployeeSkillIds(JSON.parse(result.data.skillIds));
      }
    } catch (err) {
      console.error('Failed to install skill:', err);
    } finally {
      setConfigLoading(false);
    }
  };

  const handleUninstallSkill = async (skillId: string) => {
    if (!id || configLoading) return;
    setConfigLoading(true);
    try {
      await apiRequest(`/api/employees/${id}/skills/${skillId}`, { method: 'DELETE' });
      setEmployeeSkillIds(prev => prev.filter(s => s !== skillId));
    } catch (err) {
      console.error('Failed to uninstall skill:', err);
    } finally {
      setConfigLoading(false);
    }
  };

  const handleSaveAgentsMd = async () => {
    if (!id || configLoading) return;
    setConfigLoading(true);
    try {
      await apiRequest(`/api/employees/${id}/agents-md`, {
        method: 'PUT',
        body: JSON.stringify({ content: agentsMdDraft }),
      });
      setEditingAgentsMd(false);
    } catch (err) {
      console.error('Failed to save AGENTS.md:', err);
    } finally {
      setConfigLoading(false);
    }
  };
  // Fetch messages when active session changes
  useEffect(() => {
    if (activeSession) {
      fetchMessages(activeSession.id);
    }
  }, [activeSession]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchMessages = async (sessionId: string) => {
    try {
      if (!employee) return;
      const orgsResult = await apiRequest<{ id: string; slug: string }[]>(`/api/organizations`);
      const org = orgsResult.data.find((o: any) => employee.organizationId === o.id);
      if (!org) return;

      const result = await apiRequest<Message[]>(
        `/api/orgs/${org.slug}/sessions/${sessionId}/messages`
      );
      setMessages(result.data || []);
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    }
  };

  const handleCreateSession = async () => {
    if (!employee) return;
    
    try {
      const orgsResult = await apiRequest<{ id: string; slug: string }[]>(`/api/organizations`);
      const org = orgsResult.data.find((o: any) => o.id === employee.organizationId);
      if (!org) return;

      const result = await apiRequest<Session>(
        `/api/orgs/${org.slug}/employees/${id}/sessions`,
        { method: 'POST' }
      );
      setActiveSession(result.data);
      setMessages([]);
      refetchSessions();
    } catch (err) {
      console.error('Failed to create session:', err);
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || !activeSession || !employee) return;

    const userMessage = inputText.trim();
    setInputText('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage, timestamp: Date.now() }]);
    setIsLoading(true);

    try {
      const orgsResult = await apiRequest<{ id: string; slug: string }[]>(`/api/organizations`);
      const org = orgsResult.data.find((o: any) => o.id === employee.organizationId);
      if (!org) return;

      const result = await apiRequest<{ response: string; sessionId: string }>(
        `/api/orgs/${org.slug}/sessions/${activeSession.id}/messages`,
        { method: 'POST', body: JSON.stringify({ content: userMessage }) }
      );
      
      setMessages(prev => [...prev, { role: 'assistant', content: result.data.response, timestamp: Date.now() }]);
    } catch (err) {
      console.error('Failed to send message:', err);
      setMessages(prev => [...prev, { role: 'assistant', content: '错误：发送消息失败', timestamp: Date.now() }]);
    } finally {
      setIsLoading(false);
    }
  };


  if (employeeLoading) {
    return (
      <div className="page-transition space-y-6">
        <CyberCard className="h-40">
          <div className="p-6 skeleton h-full" />
        </CyberCard>
      </div>
    );
  }

  if (employeeError || !employee) {
    return (
      <div className="page-transition">
        <CyberCard>
          <div className="p-8 text-center">
            <p className="text-cyber-error mb-4">未找到智能体</p>
            <CyberButton onClick={() => navigate('/employees')}>
              返回智能体列表
            </CyberButton>
          </div>
        </CyberCard>
      </div>
    );
  }

  return (
    <div className="page-transition space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <CyberButton variant="ghost" onClick={() => navigate('/employees')} className="!p-2">
          <ArrowLeftIcon className="w-5 h-5" />
        </CyberButton>
        <div className="flex-1">
          <h1 className="text-2xl font-display font-bold text-cyber-white">{employee.roleSlug}</h1>
          <p className="text-cyber-muted text-sm">智能体详情</p>
        </div>
        <StatusDot status={employee.status} showLabel />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel: Config & Model */}
        <div className="space-y-4">
          {/* Basic Info */}
          <CyberCard>
            <div className="p-4 space-y-3">
              <h2 className="text-lg font-display font-semibold text-cyber-cyan">基本信息</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-cyber-muted">ID</span>
                  <code className="text-cyber-white">{employee.id.slice(0, 16)}</code>
                </div>
                <div className="flex justify-between">
                  <span className="text-cyber-muted">版本</span>
                  <code className="text-cyber-purple">{employee.roleVersion}</code>
                </div>
                <div className="flex justify-between">
                  <span className="text-cyber-muted">端口</span>
                  <span className="text-cyber-white">{employee.port}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-cyber-muted">健康状态</span>
                  <StatusDot status={employee.healthStatus === 'healthy' ? 'running' : 'error'} showLabel />
                </div>
              </div>
            </div>
          </CyberCard>


          {/* Config - 员工配置 */}
          <CyberCard>
            <div className="p-4 space-y-4">
              <h2 className="text-lg font-display font-semibold text-cyber-cyan">员工配置</h2>
              
              {/* MCPs */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-cyber-white">MCPs</h3>
                  <select
                    className="text-xs px-2 py-1 rounded bg-cyber-dark border border-cyber-cyan/20 text-cyber-white"
                    onChange={(e) => e.target.value && handleInstallMcp(e.target.value)}
                    disabled={configLoading}
                  >
                    <option value="">+ 安装 MCP</option>
                    {allMcps?.filter(m => !employeeMcpIds.includes(m.id)).map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
                {employeeMcps.length > 0 ? (
                  <div className="space-y-2">
                    {employeeMcps.map(mcp => (
                      <div key={mcp.id} className="p-2 rounded bg-cyber-dark border border-cyber-cyan/10 flex items-start justify-between">
                        <div>
                          <p className="text-sm text-cyber-white font-medium">{mcp.name}</p>
                          {mcp.description && <p className="text-xs text-cyber-muted mt-1">{mcp.description}</p>}
                        </div>
                        <button
                          onClick={() => handleUninstallMcp(mcp.id)}
                          disabled={configLoading}
                          className="text-xs px-2 py-1 text-cyber-error hover:text-cyber-white"
                        >
                          移除
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-cyber-muted italic">未配置 MCP</p>
                )}
              </div>
              
              {/* Skills */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-cyber-white">Skills</h3>
                  <select
                    className="text-xs px-2 py-1 rounded bg-cyber-dark border border-cyber-cyan/20 text-cyber-white"
                    onChange={(e) => e.target.value && handleInstallSkill(e.target.value)}
                    disabled={configLoading}
                  >
                    <option value="">+ 安装 Skill</option>
                    {allSkills?.filter(s => !employeeSkillIds.includes(s.id)).map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                {employeeSkills.length > 0 ? (
                  <div className="space-y-2">
                    {employeeSkills.map(skill => (
                      <div key={skill.id} className="p-2 rounded bg-cyber-dark border border-cyber-cyan/10 flex items-start justify-between">
                        <div>
                          <p className="text-sm text-cyber-white font-medium">{skill.name}</p>
                          {skill.description && <p className="text-xs text-cyber-muted mt-1">{skill.description}</p>}
                        </div>
                        <button
                          onClick={() => handleUninstallSkill(skill.id)}
                          disabled={configLoading}
                          className="text-xs px-2 py-1 text-cyber-error hover:text-cyber-white"
                        >
                          移除
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-cyber-muted italic">未配置 Skills</p>
                )}
              </div>
              
              {/* AGENTS.md */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-cyber-white">AGENTS.md</h3>
                  {!editingAgentsMd && (
                    <button
                      onClick={() => {
                        setAgentsMdDraft(agentsMdContent || '');
                        setEditingAgentsMd(true);
                      }}
                      className="text-xs px-2 py-1 text-cyber-cyan hover:text-cyber-white"
                    >
                      编辑
                    </button>
                  )}
                </div>
                {agentsMdLoading ? (
                  <div className="skeleton h-32 rounded" />
                ) : editingAgentsMd ? (
                  <div className="space-y-2">
                    <textarea
                      value={agentsMdDraft}
                      onChange={(e) => setAgentsMdDraft(e.target.value)}
                      className="w-full p-3 rounded bg-cyber-dark border border-cyber-cyan/20 text-xs text-cyber-white font-mono resize-none min-h-[200px]"
                      placeholder="AGENTS.md 内容..."
                    />
                    <div className="flex gap-2">
                      <CyberButton size="sm" onClick={handleSaveAgentsMd} disabled={configLoading}>
                        保存
                      </CyberButton>
                      <CyberButton size="sm" variant="ghost" onClick={() => setEditingAgentsMd(false)}>
                        取消
                      </CyberButton>
                    </div>
                  </div>
                ) : agentsMdContent ? (
                  <pre className="p-3 rounded bg-cyber-dark border border-cyber-cyan/10 text-xs text-cyber-white font-mono overflow-auto max-h-64 whitespace-pre-wrap">{agentsMdContent}</pre>
                ) : (
                  <p className="text-xs text-cyber-muted italic">未配置 AGENTS.md</p>
                )}
              </div>
            </div>
          </CyberCard>

          {/* Sessions */}
          <CyberCard>
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-display font-semibold text-cyber-cyan">会话</h2>
                <CyberButton size="sm" onClick={handleCreateSession} icon={<PlusIcon className="w-4 h-4" />}>
                  新建
                </CyberButton>
              </div>
              {sessionsLoading ? (
                <div className="skeleton h-20 rounded" />
              ) : sessions && sessions.length > 0 ? (
                <div className="space-y-2">
                  {sessions.map(s => (
                    <div
                      key={s.id}
                      onClick={() => setActiveSession(s)}
                      className={`p-2 rounded-lg cursor-pointer transition-colors ${
                        activeSession?.id === s.id 
                          ? 'bg-cyber-cyan/20 border border-cyber-cyan/50' 
                          : 'bg-cyber-dark hover:bg-cyber-cyan/10'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <code className="text-xs text-cyber-white">{s.id.slice(0, 12)}</code>
                        <StatusDot status={s.status === 'active' ? 'running' : 'stopped'} />
                      </div>
                      <p className="text-xs text-cyber-muted mt-1">
                        {new Date(s.createdAt).toLocaleString('zh-CN')}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-cyber-muted text-sm text-center py-4">暂无会话</p>
              )}
            </div>
          </CyberCard>
        </div>

        {/* Right Panel: Chat with tabs */}
        <div className="lg:col-span-2">
          <CyberCard className="h-[calc(100vh-200px)] flex flex-col">
            {/* Tab header */}
            <div className="p-4 border-b border-cyber-cyan/20 flex items-center gap-4">
              <button
                onClick={() => setChatMode('matrix')}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  chatMode === 'matrix'
                    ? 'bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/50'
                    : 'text-cyber-muted hover:text-cyber-white'
                }`}
              >
                组织群聊
              </button>
              <button
                onClick={() => setChatMode('session')}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  chatMode === 'session'
                    ? 'bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/50'
                    : 'text-cyber-muted hover:text-cyber-white'
                }`}
              >
                会话 {activeSession && <span className="text-cyber-muted text-xs">({activeSession.id.slice(0, 8)})</span>}
              </button>
            </div>
            
            {chatMode === 'matrix' ? (
              /* Matrix Chat */
              employeeOrg ? (
                <MatrixChat orgSlug={employeeOrg.slug} className="flex-1" />
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-cyber-muted">加载组织信息...</p>
                </div>
              )
            ) : (
              /* Session Chat */
              <>
                {activeSession ? (
                  <>
                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                      {messages.length === 0 ? (
                        <div className="text-center text-cyber-muted py-8">
                          开始对话吧！在下方输入消息。
                        </div>
                      ) : (
                        messages.map((msg, idx) => (
                          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] p-3 rounded-lg ${
                              msg.role === 'user' 
                                ? 'bg-cyber-cyan/20 text-cyber-white' 
                                : 'bg-cyber-dark text-cyber-white'
                            }`}>
                              <p className="whitespace-pre-wrap">{msg.content}</p>
                            </div>
                          </div>
                        ))
                      )}
                      {isLoading && (
                        <div className="flex justify-start">
                          <div className="bg-cyber-dark p-3 rounded-lg">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-cyber-cyan rounded-full animate-pulse" />
                              <div className="w-2 h-2 bg-cyber-cyan rounded-full animate-pulse delay-75" />
                              <div className="w-2 h-2 bg-cyber-cyan rounded-full animate-pulse delay-150" />
                            </div>
                          </div>
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="p-4 border-t border-cyber-cyan/20">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={inputText}
                          onChange={(e) => setInputText(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                          placeholder="输入消息..."
                          disabled={isLoading}
                          className="flex-1 px-4 py-2 rounded-lg bg-cyber-dark border border-cyber-cyan/20 text-cyber-white placeholder-cyber-muted focus:border-cyber-cyan focus:outline-none"
                        />
                        <CyberButton 
                          onClick={handleSendMessage} 
                          disabled={!inputText.trim() || isLoading}
                          icon={<SendIcon className="w-4 h-4" />}
                        >
                          发送
                        </CyberButton>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-cyber-muted mb-4">请先创建会话开始对话</p>
                      <CyberButton onClick={handleCreateSession} icon={<PlusIcon className="w-4 h-4" />}>
                        新建会话
                      </CyberButton>
                    </div>
                  </div>
                )}
              </>
            )}
          </CyberCard>
        </div>
      </div>
    </div>
  );
}
