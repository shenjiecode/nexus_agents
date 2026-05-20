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
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-display font-bold text-cyber-cyan neon-text mb-2">
            NEXUS
          </h1>
          <p className="text-cyber-muted text-sm tracking-widest uppercase">
            Agent Management System
          </p>
        </div>

        {/* Reset Card */}
        <CyberCard className="overflow-hidden" hoverEffect={false}>
          {/* Title */}
          <div className="border-b border-cyber-cyan/20 px-6 py-4">
            <h2 className="text-lg font-display font-semibold text-cyber-white text-center">
              重置密码
            </h2>
          </div>

          <div className="p-6">
            {/* Error */}
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-cyber-error/10 border border-cyber-error/30 text-cyber-error text-sm">
                {error}
              </div>
            )}

            {/* Success */}
            {success && (
              <div className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-sm">
                {success}
              </div>
            )}

            {/* Form */}
            {!success && token && (
              <form onSubmit={handleReset} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-cyber-muted mb-1.5">
                    新密码
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="输入新密码（至少6位）"
                    className="w-full px-3 py-2.5 rounded-lg bg-cyber-dark border border-cyber-cyan/20 text-cyber-white placeholder-cyber-muted focus:border-cyber-cyan focus:outline-none focus:ring-1 focus:ring-cyber-cyan transition-colors"
                    disabled={loading}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-cyber-muted mb-1.5">
                    确认密码
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="再次输入新密码"
                    className="w-full px-3 py-2.5 rounded-lg bg-cyber-dark border border-cyber-cyan/20 text-cyber-white placeholder-cyber-muted focus:border-cyber-cyan focus:outline-none focus:ring-1 focus:ring-cyber-cyan transition-colors"
                    disabled={loading}
                    required
                  />
                </div>

                <CyberButton
                  type="submit"
                  variant="primary"
                  size="lg"
                  disabled={loading || !newPassword || !confirmPassword}
                  className="w-full"
                >
                  {loading ? '重置中...' : '确认重置'}
                </CyberButton>
              </form>
            )}

            {/* Back link */}
            <div className="text-center pt-4">
              <button
                onClick={() => navigate('/login')}
                className="text-sm text-cyber-muted hover:text-cyber-cyan transition-colors"
              >
                返回登录
              </button>
            </div>
          </div>
        </CyberCard>

        <p className="text-center text-xs text-cyber-muted mt-6">
          Nexus Agents v0.1.0
        </p>
      </div>
    </div>
  );
}