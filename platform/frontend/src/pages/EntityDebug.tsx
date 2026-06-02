import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CyberCard } from '../components/CyberCard';
import { CyberButton } from '../components/CyberButton';
import { StatusDot } from '../components/StatusDot';
import { ConfigPanel } from '../components/ConfigPanel';
import { useApi, apiRequest } from '../hooks/useApi';
import type { Role, RoleFile } from '../types';
import type { Container } from '../types/container';

// ============================================================================
// Icons
// ============================================================================

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

function ArrowLeftIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  );
}

function FolderIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  );
}

function FileIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function ChevronRightIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

function ChevronDownIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function SaveIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
    </svg>
  );
}

function CheckIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function ExclamationIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function LockIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
}

function RefreshIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

function ChatIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}

function ModelIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

function ChannelIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
    </svg>
  );
}

function SkillIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

function MCPIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  );
}

// ============================================================================
// Types
// ============================================================================

type MenuItem = 'chat' | 'files' | 'model' | 'channel' | 'skills' | 'mcp';

interface FileTreeItem {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileTreeItem[];
}

interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'agent';
  timestamp: number;
  status?: 'sending' | 'sent' | 'error';
}

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';
type ContainerStatus = 'stopped' | 'running' | 'error' | 'pending';

// Map backend API response to frontend type
function mapApiToFileTree(data: any[]): FileTreeItem[] {
  return data.map((item) => ({
    name: item.name,
    path: item.path,
    type: item.type === 'directory' ? 'folder' as const : 'file' as const,
    children: item.children ? mapApiToFileTree(item.children) : undefined,
  }));
}

// ============================================================================
// File Tree Node Component
// ============================================================================

interface FileTreeNodeProps {
  item: FileTreeItem;
  selectedPath: string | null;
  expandedFolders: Set<string>;
  onToggleFolder: (path: string) => void;
  onSelectFile: (path: string) => void;
  level?: number;
}

function FileTreeNode({
  item,
  selectedPath,
  expandedFolders,
  onToggleFolder,
  onSelectFile,
  level = 0,
}: FileTreeNodeProps) {
  const isExpanded = expandedFolders.has(item.path);
  const isSelected = selectedPath === item.path;

  if (item.type === 'folder') {
    return (
      <div>
        <button
          onClick={() => onToggleFolder(item.path)}
          className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors duration-200 hover:bg-cyber-cyan/5"
          style={{ paddingLeft: `${12 + level * 16}px` }}
        >
          <span className="text-cyber-muted">
            {isExpanded ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronRightIcon className="w-4 h-4" />}
          </span>
          <FolderIcon className="w-4 h-4 text-cyber-warning" />
          <span className="text-cyber-white text-sm">{item.name}</span>
        </button>
        {isExpanded && item.children && (
          <div>
            {item.children.map((child) => (
              <FileTreeNode
                key={child.path}
                item={child}
                selectedPath={selectedPath}
                expandedFolders={expandedFolders}
                onToggleFolder={onToggleFolder}
                onSelectFile={onSelectFile}
                level={level + 1}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => onSelectFile(item.path)}
      className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors duration-200 ${
        isSelected ? 'bg-cyber-cyan/10 text-cyber-cyan' : 'text-cyber-white hover:bg-cyber-cyan/5'
      }`}
      style={{ paddingLeft: `${12 + level * 16}px` }}
    >
      <span className="w-4" />
      <FileIcon className={isSelected ? 'w-4 h-4 text-cyber-cyan' : 'w-4 h-4 text-cyber-muted'} />
      <span className="text-sm">{item.name}</span>
    </button>
  );
}

// ============================================================================
// Chat Panel Component
// ============================================================================

interface ChatPanelProps {
  entityId: string;
  containerStatus: ContainerStatus;
  isContainerMode: boolean;
}

function ChatPanel({ entityId, containerStatus, isContainerMode }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [isSending, setIsSending] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const connect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    if (containerStatus !== 'running') return;

    const stored = localStorage.getItem('nexus_user');
    const userId = stored ? JSON.parse(stored).id : '';
    const wsEndpoint = isContainerMode
      ? `/api/containers/${entityId}/debug/ws`
      : `/api/roles/${entityId}/debug/ws`;
    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}${wsEndpoint}?userId=${userId}`;

    setConnectionStatus('connecting');
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => setConnectionStatus('connected');

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'message.create') {
          const newMessage: ChatMessage = {
            id: data.message_id || `${Date.now()}-${Math.random()}`,
            content: data.payload?.content || data.content || '',
            sender: 'agent',
            timestamp: data.timestamp || Date.now(),
          };
          setMessages((prev) => [...prev, newMessage]);
        } else if (data.type === 'typing.start') {
          setIsSending(true);
        } else if (data.type === 'typing.stop') {
          setIsSending(false);
        } else if (data.type === 'message.update') {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === data.id
                ? { ...msg, content: data.content || data.payload?.content || msg.content, status: data.status as ChatMessage['status'] }
                : msg
            )
          );
        } else if (data.type === 'error') {
          console.error('Picoclaw error:', data);
          setIsSending(false);
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

    socket.onclose = () => {
      setConnectionStatus('disconnected');
      if (containerStatus === 'running') {
        setTimeout(() => {
          if (wsRef.current === socket && containerStatus === 'running') {
            connect();
          }
        }, 3000);
      }
    };

    socket.onerror = () => setConnectionStatus('disconnected');

    wsRef.current = socket;
  }, [entityId, isContainerMode, containerStatus]);

  useEffect(() => {
    if (containerStatus !== 'running') return;
    const timer = setTimeout(() => connect(), 2000);
    return () => {
      clearTimeout(timer);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect, containerStatus]);

  const handleSendMessage = () => {
    if (!inputText.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    const message = inputText.trim();
    const messageId = `${Date.now()}-${Math.random()}`;

    const userMessage: ChatMessage = {
      id: messageId,
      content: message,
      sender: 'user',
      timestamp: Date.now(),
      status: 'sending',
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsSending(true);

    try {
      wsRef.current!.send(
        JSON.stringify({
          type: 'message.send',
          id: messageId,
          payload: { content: message },
        })
      );
      setMessages((prev) =>
        prev.map((msg) => (msg.id === messageId ? { ...msg, status: 'sent' } : msg))
      );
    } catch (err) {
      console.error('Failed to send message:', err);
      setMessages((prev) =>
        prev.map((msg) => (msg.id === messageId ? { ...msg, status: 'error' } : msg))
      );
    } finally {
      setIsSending(false);
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'bg-cyber-success shadow-success-glow';
      case 'connecting': return 'bg-cyber-warning';
      case 'disconnected': return 'bg-cyber-error shadow-error-glow';
    }
  };

  const getStatusLabel = () => {
    switch (connectionStatus) {
      case 'connected': return '已连接';
      case 'connecting': return '连接中...';
      case 'disconnected': return containerStatus === 'running' ? '已断开' : '容器未启动';
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-cyber-cyan/20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-display font-semibold text-cyber-cyan">调试对话</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={connect}
            title="重新连接"
            className="p-1.5 rounded-md text-cyber-muted hover:text-cyber-cyan hover:bg-cyber-cyan/10 transition-colors"
          >
            <RefreshIcon className="w-3.5 h-3.5" />
          </button>
          <div className={`w-2.5 h-2.5 rounded-full ${getStatusColor()} ${connectionStatus === 'connecting' ? 'animate-pulse' : ''}`} />
          <span className={`text-xs ${connectionStatus === 'connected' ? 'text-cyber-success' : connectionStatus === 'connecting' ? 'text-cyber-warning' : 'text-cyber-error'}`}>
            {getStatusLabel()}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-cyber-muted">
            <div className="w-16 h-16 rounded-full border border-cyber-cyan/20 flex items-center justify-center mb-3">
              <ChatIcon className="w-8 h-8 text-cyber-cyan/50" />
            </div>
            <p className="text-sm">{containerStatus === 'running' ? '开始调试对话...' : '启动容器后开始调试'}</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] space-y-1 ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`flex items-center gap-2 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}>
                  <span className={`text-xs font-medium ${msg.sender === 'user' ? 'text-cyber-purple' : 'text-cyber-cyan'}`}>
                    {msg.sender === 'user' ? '你' : 'Agent'}
                  </span>
                  <span className="text-xs text-cyber-muted">{formatTime(msg.timestamp)}</span>
                  {msg.status === 'sending' && <span className="text-xs text-cyber-warning">发送中...</span>}
                  {msg.status === 'error' && <span className="text-xs text-cyber-error">失败</span>}
                </div>
                <div className={`p-3 rounded-lg ${
                  msg.sender === 'user'
                    ? 'bg-cyber-purple/20 border border-cyber-purple/30 text-cyber-white'
                    : 'bg-cyber-dark/50 border border-cyber-cyan/20 text-cyber-white'
                }`}>
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={(el) => { messagesEndRef.current = el; }} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-cyber-cyan/20">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
            placeholder={connectionStatus === 'connected' ? '输入消息...' : '等待连接...'}
            disabled={connectionStatus !== 'connected' || isSending}
            className="flex-1 px-4 py-2 rounded-lg bg-cyber-dark border border-cyber-cyan/20 text-cyber-white placeholder-cyber-muted focus:border-cyber-cyan focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <CyberButton
            onClick={handleSendMessage}
            disabled={!inputText.trim() || connectionStatus !== 'connected' || isSending}
            icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>}
          >
            发送
          </CyberButton>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// File Editor Component
// ============================================================================

interface FileEditorProps {
  entityId: string;
  isContainerMode: boolean;
  fileTree: FileTreeItem[];
  isOwner: boolean;
}

function FileEditor({ entityId, isContainerMode, fileTree, isOwner }: FileEditorProps) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [content, setContent] = useState<string>('');
  const [originalContent, setOriginalContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (fileTree.length > 0) {
      const rootFolders = new Set<string>();
      fileTree.forEach((item) => {
        if (item.type === 'folder') rootFolders.add(item.path);
      });
      setExpandedFolders((prev) => new Set([...prev, ...rootFolders]));
    }
  }, [fileTree]);

  const loadFileContent = async (path: string) => {
    setLoading(true);
    setError(null);
    setSaveSuccess(false);

    try {
      const endpoint = isContainerMode
        ? `/api/containers/${entityId}/files/${encodeURIComponent(path)}`
        : `/api/roles/${entityId}/files/${encodeURIComponent(path)}`;
      const response = await apiRequest<RoleFile>(endpoint);

      if (!response.success || !response.data) throw new Error(response.message || 'Failed to load file');

      setContent(response.data.content);
      setOriginalContent(response.data.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setContent('');
      setOriginalContent('');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectFile = (path: string) => {
    setSelectedPath(path);
    loadFileContent(path);
  };

  const handleToggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(path)) newSet.delete(path);
      else newSet.add(path);
      return newSet;
    });
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    setSaveSuccess(false);
  };

  const handleSave = async () => {
    if (!selectedPath || !isOwner) return;

    setSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      const endpoint = isContainerMode
        ? `/api/containers/${entityId}/files/${encodeURIComponent(selectedPath)}`
        : `/api/roles/${entityId}/files/${encodeURIComponent(selectedPath)}`;
      const response = await apiRequest(endpoint, {
        method: 'PUT',
        body: JSON.stringify({ content }),
      });

      if (!response.success) throw new Error(response.message || 'Failed to save file');

      setOriginalContent(content);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  const hasUnsavedChanges = content !== originalContent;

  return (
    <div className="h-full flex">
      {/* File Tree */}
      <div className="w-56 border-r border-cyber-cyan/20 overflow-y-auto flex-shrink-0">
        <div className="px-4 py-3 border-b border-cyber-cyan/20">
          <h3 className="font-display font-semibold text-cyber-white flex items-center gap-2">
            <FolderIcon className="w-5 h-5 text-cyber-cyan" />
            文件树
          </h3>
        </div>
        <div className="py-2">
          {fileTree.length === 0 ? (
            <div className="px-4 py-8 text-center text-cyber-muted text-sm">暂无文件</div>
          ) : (
            fileTree.map((item) => (
              <FileTreeNode
                key={item.path}
                item={item}
                selectedPath={selectedPath}
                expandedFolders={expandedFolders}
                onToggleFolder={handleToggleFolder}
                onSelectFile={handleSelectFile}
              />
            ))
          )}
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Path Bar */}
        <div className="px-4 py-3 border-b border-cyber-cyan/20 flex items-center justify-between bg-cyber-dark-lighter/30">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <span className="text-cyber-muted text-sm">Path:</span>
            <div className="flex items-center gap-2 bg-cyber-dark-lighter rounded px-3 py-1.5 flex-1 min-w-0">
              {selectedPath ? (
                <>
                  <FileIcon className="w-4 h-4 text-cyber-cyan flex-shrink-0" />
                  <span className="font-mono text-sm text-cyber-cyan truncate">{selectedPath}</span>
                </>
              ) : (
                <span className="text-cyber-muted text-sm italic">选择一个文件...</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 ml-4">
            {hasUnsavedChanges && (
              <span className="text-xs text-cyber-warning flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-cyber-warning animate-pulse" />
                未保存
              </span>
            )}
            {saveSuccess && (
              <span className="text-xs text-cyber-success flex items-center gap-1">
                <CheckIcon className="w-3 h-3" />
                已保存
              </span>
            )}
            {error && (
              <span className="text-xs text-cyber-error flex items-center gap-1">
                <ExclamationIcon className="w-3 h-3" />
                {error}
              </span>
            )}
            {!isOwner && (
              <span className="text-xs text-cyber-warning flex items-center gap-1">
                <ExclamationIcon className="w-3 h-3" />
                只读模式
              </span>
            )}
            <CyberButton
              variant="primary"
              size="sm"
              onClick={handleSave}
              disabled={!selectedPath || saving || !hasUnsavedChanges || !isOwner}
              icon={<SaveIcon className="w-4 h-4" />}
            >
              {saving ? '保存中...' : '保存'}
            </CyberButton>
          </div>
        </div>

        {/* Editor */}
        {selectedPath ? (
          <div className="flex-1 relative">
            <textarea
              value={content}
              onChange={handleContentChange}
              disabled={loading || saving || !isOwner}
              className="w-full h-full p-4 bg-cyber-dark-lighter/50 font-mono text-sm text-cyber-white resize-none outline-none disabled:opacity-50"
              placeholder={isOwner ? '文件内容...' : '只有所有者可以编辑'}
              spellCheck={false}
            />
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-cyber-dark/50">
                <div className="text-cyber-cyan flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-cyber-cyan animate-pulse" />
                  加载中...
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-cyber-muted">
            <div className="text-center">
              <FileIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>从左侧选择一个文件进行编辑</p>
            </div>
          </div>
        )}

        {/* Status Bar */}
        <div className="px-4 py-2 border-t border-cyber-cyan/20 bg-cyber-dark-lighter/30">
          <div className="flex items-center gap-4">
            {selectedPath && (
              <>
                <span className="text-xs text-cyber-muted">{content.length} 字符</span>
                <span className="text-xs text-cyber-muted">{content.split('\n').length} 行</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main EntityDebug Component
// ============================================================================

interface EntityDebugProps {
  mode?: 'role' | 'container';
}

export function EntityDebug({ mode = 'role' }: EntityDebugProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isContainerMode = mode === 'container';

  // Menu state
  const [activeMenu, setActiveMenu] = useState<MenuItem>('chat');

  // Entity data
  const { data: role } = useApi<Role>(isContainerMode ? '' : `/api/roles/${id}`);
  const { data: container } = useApi<Container>(isContainerMode ? `/api/containers/${id}` : '');
  const entityData = isContainerMode ? container : role;
  const entityLoading = isContainerMode ? !container : !role;

  // Container state
  const [containerStatus, setContainerStatus] = useState<ContainerStatus>('stopped');
  const [operationLoading, setOperationLoading] = useState(false);

  // File tree
  const [fileTree, setFileTree] = useState<FileTreeItem[]>([]);

  // Current user
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('nexus_user');
      if (stored) {
        const user = JSON.parse(stored);
        setCurrentUserId(user.id);
      }
    } catch {
      setCurrentUserId(null);
    }
  }, []);

  const isOwner = entityData && currentUserId && (isContainerMode
    ? (entityData as Container).userId === currentUserId
    : (entityData as Role).userId === currentUserId);

  // Sync container status
  useEffect(() => {
    if (entityData) {
      if (isContainerMode) {
        setContainerStatus((entityData as Container).status as ContainerStatus);
      } else {
        const role = entityData as Role;
        const mapped: ContainerStatus = role.status === 'debugging' ? 'running' : (role.status as ContainerStatus);
        setContainerStatus(mapped);
      }
    }
  }, [entityData, isContainerMode]);

  // Load file tree
  useEffect(() => {
    if (!id) return;

    const loadFileList = async () => {
      try {
        const endpoint = isContainerMode
          ? `/api/containers/${id}/files`
          : `/api/roles/${id}/files`;
        const response = await apiRequest<any>(endpoint);
        if (response.success && Array.isArray(response.data)) {
          setFileTree(mapApiToFileTree(response.data));
        }
      } catch (err) {
        console.error('Failed to load file list:', err);
      }
    };

    loadFileList();
  }, [id, isContainerMode]);

  const handleStartContainer = async () => {
    if (!id || !isOwner) return;
    setOperationLoading(true);
    try {
      const endpoint = isContainerMode
        ? `/api/containers/${id}/start`
        : `/api/roles/${id}/debug/start`;
      const response = await apiRequest(endpoint, { method: 'POST' });
      if (response.success) setContainerStatus('running');
    } catch (err) {
      console.error('Failed to start container:', err);
    } finally {
      setOperationLoading(false);
    }
  };

  const handleStopContainer = async () => {
    if (!id || !isOwner) return;
    setOperationLoading(true);
    try {
      const endpoint = isContainerMode
        ? `/api/containers/${id}/stop`
        : `/api/roles/${id}/debug/stop`;
      const response = await apiRequest(endpoint, { method: 'POST' });
      if (response.success) setContainerStatus('stopped');
    } catch (err) {
      console.error('Failed to stop container:', err);
    } finally {
      setOperationLoading(false);
    }
  };

  const getStatusDotStatus = (status: ContainerStatus) => {
    switch (status) {
      case 'running': return 'running';
      case 'stopped': return 'stopped';
      case 'error': return 'error';
      case 'pending': return 'pending';
      default: return 'stopped';
    }
  };

  // Loading state
  if (entityLoading) {
    return (
      <div className="page-transition flex h-[calc(100vh-4rem)]">
        <div className="w-48 skeleton" />
        <div className="flex-1 skeleton" />
      </div>
    );
  }

  // Not owner state
  if (!isOwner) {
    return (
      <CyberCard cornerAccent>
        <div className="p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-cyber-error/10 flex items-center justify-center mx-auto mb-4">
            <LockIcon className="w-8 h-8 text-cyber-error" />
          </div>
          <h2 className="text-xl font-display font-bold text-cyber-white mb-2">访问受限</h2>
          <p className="text-cyber-muted mb-6">只有所有者可以进行调试</p>
          <CyberButton
            variant="ghost"
            onClick={() => navigate(isContainerMode ? '/containers' : '/roles')}
            icon={<ArrowLeftIcon className="w-4 h-4" />}
          >
            返回{isContainerMode ? '容器' : '角色'}列表
          </CyberButton>
        </div>
      </CyberCard>
    );
  }

  // Menu items configuration
  const menuItems: { id: MenuItem; label: string; icon: React.ReactNode }[] = [
    { id: 'chat', label: '聊天', icon: <ChatIcon className="w-5 h-5" /> },
    { id: 'files', label: '文件树', icon: <FolderIcon className="w-5 h-5" /> },
    { id: 'model', label: 'Model 配置', icon: <ModelIcon className="w-5 h-5" /> },
    { id: 'channel', label: 'Channel 配置', icon: <ChannelIcon className="w-5 h-5" /> },
    { id: 'skills', label: 'Skills 配置', icon: <SkillIcon className="w-5 h-5" /> },
    { id: 'mcp', label: 'MCP 配置', icon: <MCPIcon className="w-5 h-5" /> },
  ];

  return (
    <div className="page-transition flex h-[calc(100vh-4rem)]">
      {/* Left: Sidebar Menu */}
      <div className="w-48 border-r border-cyber-cyan/20 bg-cyber-dark-lighter/30 flex flex-col flex-shrink-0">
        {/* Header */}
        <div className="p-4 border-b border-cyber-cyan/20">
          <button
            onClick={() => navigate(isContainerMode ? '/containers' : '/roles')}
            className="flex items-center gap-2 text-cyber-muted hover:text-cyber-cyan transition-colors mb-3"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            <span className="text-sm">返回</span>
          </button>
          <h1 className="text-lg font-display font-bold text-cyber-white truncate">{entityData?.name}</h1>
          <div className="flex items-center gap-2 mt-2">
            <StatusDot status={getStatusDotStatus(containerStatus)} showLabel={false} />
            <span className="text-xs text-cyber-muted">{containerStatus === 'running' ? '运行中' : '已停止'}</span>
          </div>
        </div>

        {/* Menu Items */}
        <nav className="flex-1 py-2">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveMenu(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                activeMenu === item.id
                  ? 'bg-cyber-cyan/10 text-cyber-cyan border-r-2 border-cyber-cyan'
                  : 'text-cyber-white hover:bg-cyber-cyan/5'
              }`}
            >
              {item.icon}
              <span className="text-sm">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Control Buttons */}
        <div className="p-4 border-t border-cyber-cyan/20">
          {containerStatus === 'stopped' ? (
            <CyberButton
              variant="primary"
              size="sm"
              onClick={handleStartContainer}
              disabled={operationLoading}
              icon={<PlayIcon className="w-4 h-4" />}
              className="w-full"
            >
              {operationLoading ? '启动中...' : '启动'}
            </CyberButton>
          ) : (
            <CyberButton
              variant="danger"
              size="sm"
              onClick={handleStopContainer}
              disabled={operationLoading}
              icon={<StopIcon className="w-4 h-4" />}
              className="w-full"
            >
              {operationLoading ? '停止中...' : '停止'}
            </CyberButton>
          )}
        </div>
      </div>

      {/* Right: Content Area */}
      <div className="flex-1 overflow-hidden">
        <CyberCard className="h-full rounded-none border-0">
          {activeMenu === 'chat' && (
            <ChatPanel entityId={id!} containerStatus={containerStatus} isContainerMode={isContainerMode} />
          )}
          {activeMenu === 'files' && (
            <FileEditor entityId={id!} isContainerMode={isContainerMode} fileTree={fileTree} isOwner={isOwner} />
          )}
          {activeMenu === 'model' && (
            <ConfigPanel entityId={id!} isContainerMode={isContainerMode} isOwner={isOwner} initialTab="agent" />
          )}
          {activeMenu === 'channel' && (
            <ConfigPanel entityId={id!} isContainerMode={isContainerMode} isOwner={isOwner} initialTab="channel" />
          )}
          {activeMenu === 'skills' && (
            <ConfigPanel entityId={id!} isContainerMode={isContainerMode} isOwner={isOwner} initialTab="skills" />
          )}
          {activeMenu === 'mcp' && (
            <ConfigPanel entityId={id!} isContainerMode={isContainerMode} isOwner={isOwner} initialTab="mcp" />
          )}
        </CyberCard>
      </div>
    </div>
  );
}

export default EntityDebug;
