import { useState, useEffect, useRef } from 'react';
import { CyberCard } from './CyberCard';
import { CyberButton } from './CyberButton';
import { useApi, apiRequest } from '../hooks/useApi';

interface MatrixMessage {
  event_id: string;
  sender: string;
  content: {
    msgtype: string;
    body: string;
  };
  origin_server_ts: number;
}

interface MatrixMember {
  userId: string;
  displayName?: string;
  avatarUrl?: string;
}

interface MatrixChatProps {
  orgSlug: string;
  className?: string;
}

function RefreshIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

function UsersIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
    </svg>
  );
}

export function MatrixChat({ orgSlug, className }: MatrixChatProps) {
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch room state, messages, and members
  const { data: roomState, loading: stateLoading, error: stateError } = useApi<{
    name?: string;
    topic?: string;
  }>(`/api/orgs/${orgSlug}/matrix/state`);

  const { data: messagesData, loading: messagesLoading, refetch: refetchMessages } = useApi<{
    messages: MatrixMessage[];
    start: string;
    end?: string;
  }>(`/api/orgs/${orgSlug}/matrix/messages`);

  const { data: membersData, loading: membersLoading } = useApi<{
    members: MatrixMember[];
  }>(`/api/orgs/${orgSlug}/matrix/members`);

  const messages = messagesData?.messages || [];
  const members = membersData?.members || [];
  const roomName = roomState?.name || '组织内部群聊';

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refetchMessages();
    }, 10000);
    return () => clearInterval(interval);
  }, [refetchMessages]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || isSending) return;

    const message = inputText.trim();
    setInputText('');
    setIsSending(true);

    try {
      await apiRequest(`/api/orgs/${orgSlug}/matrix/send`, {
        method: 'POST',
        body: JSON.stringify({ content: message }),
      });
      // Refresh messages after sending
      await refetchMessages();
    } catch (err) {
      console.error('Failed to send Matrix message:', err);
      setInputText(message); // Restore input on error
    } finally {
      setIsSending(false);
    }
  };

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getSenderName = (senderId: string) => {
    const member = members.find(m => m.userId === senderId);
    return member?.displayName || senderId.split(':')[0].replace('@', '');
  };

  if (stateError) {
    return (
      <CyberCard className={className}>
        <div className="p-4 text-center">
          <p className="text-cyber-error">无法加载群聊</p>
          <p className="text-xs text-cyber-muted mt-2">组织可能未配置内部群聊</p>
        </div>
      </CyberCard>
    );
  }

  return (
    <CyberCard className={className}>
      <div className="flex flex-col h-[calc(100vh-300px)] min-h-[400px]">
        {/* Header */}
        <div className="p-4 border-b border-cyber-cyan/20 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-display font-semibold text-cyber-cyan">
              {stateLoading ? '...' : roomName}
            </h2>
            {roomState?.topic && (
              <p className="text-xs text-cyber-muted mt-1">{roomState.topic}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <CyberButton
              variant="ghost"
              size="sm"
              onClick={() => setShowMembers(!showMembers)}
              className="!p-2"
            >
              <UsersIcon className="w-5 h-5" />
            </CyberButton>
            <CyberButton
              variant="ghost"
              size="sm"
              onClick={() => refetchMessages()}
              className="!p-2"
            >
              <RefreshIcon className="w-5 h-5" />
            </CyberButton>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Messages */}
          <div className="flex-1 flex flex-col">
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messagesLoading ? (
                <div className="text-center text-cyber-muted py-8">
                  加载中...
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center text-cyber-muted py-8">
                  暂无消息
                </div>
              ) : (
                messages.map((msg) => (
                  <div key={msg.event_id} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-cyber-cyan">
                        {getSenderName(msg.sender)}
                      </span>
                      <span className="text-xs text-cyber-muted">
                        {formatTime(msg.origin_server_ts)}
                      </span>
                    </div>
                    <div className="p-2 rounded bg-cyber-dark/50 border border-cyber-cyan/10">
                      <p className="text-sm text-cyber-white whitespace-pre-wrap">
                        {msg.content.body}
                      </p>
                    </div>
                  </div>
                ))
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
                  placeholder="发送消息到群聊..."
                  disabled={isSending}
                  className="flex-1 px-4 py-2 rounded-lg bg-cyber-dark border border-cyber-cyan/20 text-cyber-white placeholder-cyber-muted focus:border-cyber-cyan focus:outline-none"
                />
                <CyberButton
                  onClick={handleSendMessage}
                  disabled={!inputText.trim() || isSending}
                >
                  发送
                </CyberButton>
              </div>
            </div>
          </div>

          {/* Members sidebar */}
          {showMembers && (
            <div className="w-48 border-l border-cyber-cyan/20 p-4 overflow-y-auto">
              <h3 className="text-sm font-medium text-cyber-white mb-3">成员 ({members.length})</h3>
              {membersLoading ? (
                <div className="text-xs text-cyber-muted">加载中...</div>
              ) : (
                <div className="space-y-2">
                  {members.map((member) => (
                    <div key={member.userId} className="text-xs">
                      <p className="text-cyber-white truncate">
                        {member.displayName || member.userId.split(':')[0].replace('@', '')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </CyberCard>
  );
}
