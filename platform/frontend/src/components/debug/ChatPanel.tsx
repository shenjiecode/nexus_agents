import { useState, useEffect, useRef, useCallback } from 'react';
import { CyberCard } from '../CyberCard';
import { CyberButton } from '../CyberButton';

interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'agent';
  timestamp: number;
  status?: 'sending' | 'sent' | 'error';
}

interface ChatPanelProps {
  workspaceId: string;
  className?: string;
}

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export function ChatPanel({ workspaceId, className }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [isSending, setIsSending] = useState(false);
  
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Connect WebSocket with exponential backoff
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setConnectionStatus('connecting');
    
    const wsUrl = `ws://localhost:13207/api/picoclaw/${workspaceId}/ws`;
    
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnectionStatus('connected');
        reconnectAttemptRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'message.create') {
            const newMessage: ChatMessage = {
              id: data.id || `${Date.now()}-${Math.random()}`,
              content: data.content || data.message || '',
              sender: data.sender === 'user' ? 'user' : 'agent',
              timestamp: data.timestamp || Date.now(),
            };
            setMessages(prev => [...prev, newMessage]);
          } else if (data.type === 'message.update') {
            setMessages(prev => 
              prev.map(msg => 
                msg.id === data.id 
                  ? { ...msg, content: data.content || msg.content, status: data.status as ChatMessage['status'] }
                  : msg
              )
            );
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      ws.onclose = () => {
        setConnectionStatus('disconnected');
        wsRef.current = null;
        
        // Exponential backoff for reconnection
        const maxDelay = 30000; // 30 seconds max
        const baseDelay = 1000; // 1 second base
        const delay = Math.min(baseDelay * Math.pow(2, reconnectAttemptRef.current), maxDelay);
        
        reconnectAttemptRef.current++;
        
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus('disconnected');
      };
    } catch (err) {
      console.error('Failed to create WebSocket connection:', err);
      setConnectionStatus('disconnected');
      
      // Retry with backoff
      const delay = Math.min(1000 * Math.pow(2, reconnectAttemptRef.current), 30000);
      reconnectAttemptRef.current++;
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, delay);
    }
  }, [workspaceId]);

  // Initial connection
  useEffect(() => {
    connect();
    
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const handleSendMessage = () => {
    if (!inputText.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    const message = inputText.trim();
    const messageId = `${Date.now()}-${Math.random()}`;
    
    // Add to local message list immediately
    const userMessage: ChatMessage = {
      id: messageId,
      content: message,
      sender: 'user',
      timestamp: Date.now(),
      status: 'sending',
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsSending(true);

    try {
      wsRef.current.send(JSON.stringify({
        type: 'message.send',
        content: message,
        id: messageId,
      }));
      
      // Update status to sent
      setMessages(prev => 
        prev.map(msg => 
          msg.id === messageId ? { ...msg, status: 'sent' } : msg
        )
      );
    } catch (err) {
      console.error('Failed to send message:', err);
      setMessages(prev => 
        prev.map(msg => 
          msg.id === messageId ? { ...msg, status: 'error' } : msg
        )
      );
    } finally {
      setIsSending(false);
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'bg-cyber-success shadow-success-glow';
      case 'connecting':
        return 'bg-cyber-warning';
      case 'disconnected':
        return 'bg-cyber-error shadow-error-glow';
    }
  };

  const getStatusLabel = () => {
    switch (connectionStatus) {
      case 'connected':
        return '已连接';
      case 'connecting':
        return '连接中...';
      case 'disconnected':
        return '已断开';
    }
  };

  return (
    <CyberCard className={className}>
      <div className="flex flex-col h-[500px]">
        {/* Header with connection status */}
        <div className="p-4 border-b border-cyber-cyan/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-display font-semibold text-cyber-cyan">
              Pico Chat
            </h2>
            <span className="text-xs text-cyber-muted font-mono">
              {workspaceId}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div 
              className={`w-2.5 h-2.5 rounded-full ${getStatusColor()} ${
                connectionStatus === 'connecting' ? 'animate-pulse' : ''
              }`}
            />
            <span className={`text-xs ${
              connectionStatus === 'connected' ? 'text-cyber-success' : 
              connectionStatus === 'connecting' ? 'text-cyber-warning' : 'text-cyber-error'
            }`}>
              {getStatusLabel()}
            </span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-cyber-muted">
              <div className="w-16 h-16 rounded-full border border-cyber-cyan/20 flex items-center justify-center mb-3">
                <svg className="w-8 h-8 text-cyber-cyan/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-sm">开始对话...</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] space-y-1 ${
                    msg.sender === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  <div className={`flex items-center gap-2 ${
                    msg.sender === 'user' ? 'flex-row-reverse' : ''
                  }`}>
                    <span className={`text-xs font-medium ${
                      msg.sender === 'user' ? 'text-cyber-purple' : 'text-cyber-cyan'
                    }`}>
                      {msg.sender === 'user' ? '你' : 'Agent'}
                    </span>
                    <span className="text-xs text-cyber-muted">
                      {formatTime(msg.timestamp)}
                    </span>
                    {msg.status === 'sending' && (
                      <span className="text-xs text-cyber-warning">发送中...</span>
                    )}
                    {msg.status === 'error' && (
                      <span className="text-xs text-cyber-error">失败</span>
                    )}
                  </div>
                  <div
                    className={`p-3 rounded-lg ${
                      msg.sender === 'user'
                        ? 'bg-cyber-purple/20 border border-cyber-purple/30 text-cyber-white'
                        : 'bg-cyber-dark/50 border border-cyber-cyan/20 text-cyber-white'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
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
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              }
            >
              发送
            </CyberButton>
          </div>
        </div>
      </div>
    </CyberCard>
  );
}
