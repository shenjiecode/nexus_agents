import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CyberCard } from '../components/CyberCard';
import { CyberButton } from '../components/CyberButton';
import { StatusDot } from '../components/StatusDot';
import { useApi, apiRequest } from '../hooks/useApi';
import type { Container } from '../types';

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

// Available models
const AVAILABLE_MODELS = [
  { id: 'tencent-coding-plan/glm-4', name: 'GLM-4 (Tencent)' },
  { id: 'tencent-coding-plan/glm-5', name: 'GLM-5 (Tencent)' },
  { id: 'anthropic/claude-3-5-sonnet', name: 'Claude 3.5 Sonnet' },
  { id: 'openai/gpt-4o', name: 'GPT-4o' },
  { id: 'openai/gpt-4-turbo', name: 'GPT-4 Turbo' },
];

export function AgentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState('');
  const [isUpdatingModel, setIsUpdatingModel] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: container, loading: containerLoading, error: containerError } = 
    useApi<Container>(`/api/containers/${id}`);
  
  const { data: config, loading: configLoading } = 
    useApi<Record<string, unknown>>(`/api/containers/${id}/config`);
  
  const { data: sessions, loading: sessionsLoading, refetch: refetchSessions } = 
    useApi<Session[]>(`/api/containers/${id}/sessions`);

  // Set initial model from config
  useEffect(() => {
    if (config && typeof config.model === 'string') {
      setSelectedModel(config.model);
    }
  }, [config]);

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
      if (!container) return;
      const orgsResult = await apiRequest<{ id: string; slug: string }[]>(`/api/organizations`);
      const org = orgsResult.data.find((o: any) => container.organizationId === o.id);
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
    if (!container) return;
    
    try {
      const orgsResult = await apiRequest<{ id: string; slug: string }[]>(`/api/organizations`);
      const org = orgsResult.data.find((o: any) => o.id === container.organizationId);
      if (!org) return;

      const result = await apiRequest<Session>(
        `/api/orgs/${org.slug}/containers/${id}/sessions`,
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
    if (!inputText.trim() || !activeSession || !container) return;

    const userMessage = inputText.trim();
    setInputText('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage, timestamp: Date.now() }]);
    setIsLoading(true);

    try {
      const orgsResult = await apiRequest<{ id: string; slug: string }[]>(`/api/organizations`);
      const org = orgsResult.data.find((o: any) => o.id === container.organizationId);
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

  const handleModelChange = async (model: string) => {
    if (!id || model === selectedModel) return;
    
    setIsUpdatingModel(true);
    try {
      await apiRequest(`/api/containers/${id}/model`, {
        method: 'PUT',
        body: JSON.stringify({ model }),
      });
      setSelectedModel(model);
    } catch (err) {
      console.error('Failed to update model:', err);
    } finally {
      setIsUpdatingModel(false);
    }
  };

  if (containerLoading) {
    return (
      <div className="page-transition space-y-6">
        <CyberCard className="h-40">
          <div className="p-6 skeleton h-full" />
        </CyberCard>
      </div>
    );
  }

  if (containerError || !container) {
    return (
      <div className="page-transition">
        <CyberCard>
          <div className="p-8 text-center">
            <p className="text-cyber-error mb-4">未找到智能体</p>
            <CyberButton onClick={() => navigate('/containers')}>
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
        <CyberButton variant="ghost" onClick={() => navigate('/containers')} className="!p-2">
          <ArrowLeftIcon className="w-5 h-5" />
        </CyberButton>
        <div className="flex-1">
          <h1 className="text-2xl font-display font-bold text-cyber-white">{container.roleSlug}</h1>
          <p className="text-cyber-muted text-sm">智能体详情</p>
        </div>
        <StatusDot status={container.status} showLabel />
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
                  <code className="text-cyber-white">{container.id.slice(0, 16)}</code>
                </div>
                <div className="flex justify-between">
                  <span className="text-cyber-muted">版本</span>
                  <code className="text-cyber-purple">{container.roleVersion}</code>
                </div>
                <div className="flex justify-between">
                  <span className="text-cyber-muted">端口</span>
                  <span className="text-cyber-white">{container.port}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-cyber-muted">健康状态</span>
                  <StatusDot status={container.healthStatus === 'healthy' ? 'running' : 'error'} showLabel />
                </div>
              </div>
            </div>
          </CyberCard>

          {/* Model Selection */}
          <CyberCard>
            <div className="p-4 space-y-3">
              <h2 className="text-lg font-display font-semibold text-cyber-cyan">模型配置</h2>
              <select
                value={selectedModel}
                onChange={(e) => handleModelChange(e.target.value)}
                disabled={isUpdatingModel}
                className="w-full px-3 py-2 rounded-lg bg-cyber-dark border border-cyber-cyan/20 text-cyber-white focus:border-cyber-cyan focus:outline-none"
              >
                <option value="">选择模型...</option>
                {AVAILABLE_MODELS.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              {isUpdatingModel && <p className="text-xs text-cyber-muted">更新中...</p>}
            </div>
          </CyberCard>

          {/* Config */}
          <CyberCard>
            <div className="p-4 space-y-3">
              <h2 className="text-lg font-display font-semibold text-cyber-cyan">配置详情</h2>
              {configLoading ? (
                <div className="skeleton h-32 rounded" />
              ) : config ? (
                <pre className="text-xs text-cyber-muted bg-cyber-dark p-3 rounded overflow-auto max-h-64">
                  {JSON.stringify(config, null, 2)}
                </pre>
              ) : (
                <p className="text-cyber-muted text-sm">无法加载配置</p>
              )}
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

        {/* Right Panel: Chat */}
        <div className="lg:col-span-2">
          <CyberCard className="h-[calc(100vh-200px)] flex flex-col">
            <div className="p-4 border-b border-cyber-cyan/20">
              <h2 className="text-lg font-display font-semibold text-cyber-cyan">
                对话 {activeSession && <span className="text-cyber-muted text-sm">(Session: {activeSession.id.slice(0, 8)})</span>}
              </h2>
            </div>
            
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
          </CyberCard>
        </div>
      </div>
    </div>
  );
}
