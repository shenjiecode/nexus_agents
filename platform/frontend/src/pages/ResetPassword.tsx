import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../hooks/useApi';
import { CyberCard } from '../components/CyberCard';
import { CyberButton } from '../components/CyberButton';

export function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Check if token exists
  useEffect(() => {
    if (!token) {
      setError('重置链接无效，请重新申请');
    }
  }, [token]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError('重置链接无效');
      return;
    }

    if (newPassword.length < 6) {
      setError('密码长度至少6位');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('两次密码输入不一致');
      return;
    }

    setLoading(true);

    try {
      const result = await apiRequest<{ message: string }>('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, new_password: newPassword }),
      });

      if (result.success) {
        setSuccess('密码重置成功！请使用新密码登录');
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      } else {
        setError(result.message || '重置失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '重置失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen cyber-grid-bg bg-cyber-gradient flex items-center justify-center p-4">
      <CyberCard className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-display font-bold text-cyber-cyan neon-text mb-2">
            NEXUS
          </h1>
          <p className="text-cyber-muted text-sm">Agent Management System</p>
        </div>

        <div className="space-y-6">
          <h2 className="text-xl font-display font-semibold text-cyber-white text-center">
            重置密码
          </h2>

          {error && (
            <div className="p-3 rounded-lg bg-cyber-error/20 border border-cyber-error/50 text-cyber-error text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 rounded-lg bg-cyber-success/20 border border-cyber-success/50 text-cyber-success text-sm">
              {success}
            </div>
          )}

          {!success && token && (
            <form onSubmit={handleReset} className="space-y-4">
              <div>
                <label className="block text-sm font-mono text-cyber-muted uppercase mb-2">
                  新密码
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="输入新密码（至少6位）"
                  className="w-full px-4 py-3 rounded-lg bg-cyber-dark border border-cyber-cyan/30 text-cyber-white placeholder-cyber-muted/50 focus:border-cyber-cyan focus:ring-1 focus:ring-cyber-cyan/50 transition-all"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-mono text-cyber-muted uppercase mb-2">
                  确认密码
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="再次输入新密码"
                  className="w-full px-4 py-3 rounded-lg bg-cyber-dark border border-cyber-cyan/30 text-cyber-white placeholder-cyber-muted/50 focus:border-cyber-cyan focus:ring-1 focus:ring-cyber-cyan/50 transition-all"
                  disabled={loading}
                />
              </div>

              <CyberButton
                type="submit"
                className="w-full"
                disabled={loading || !newPassword || !confirmPassword}
              >
                {loading ? '重置中...' : '确认重置'}
              </CyberButton>
            </form>
          )}

          <div className="text-center">
            <button
              onClick={() => navigate('/login')}
              className="text-sm text-cyber-muted hover:text-cyber-cyan transition-colors"
            >
              返回登录
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-cyber-muted mt-6">
          Nexus Agents v0.1.0
        </p>
      </CyberCard>
    </div>
  );
}