import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../hooks/useApi';
import { CyberCard } from '../components/CyberCard';
import { CyberButton } from '../components/CyberButton';

type AuthView = 'login' | 'register' | 'forgot-password';

export function Login() {
  const navigate = useNavigate();
  const [view, setView] = useState<AuthView>('login');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Login form
  const [loginId, setLoginId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regNickname, setRegNickname] = useState('');

  // Forgot password form
  const [forgotEmail, setForgotEmail] = useState('');

  const switchView = (newView: AuthView) => {
    setView(newView);
    setError(null);
    setSuccess(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await apiRequest<{ id: string; username: string; email: string; nickname?: string; token: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ login: loginId, password: loginPassword }),
      });

      if (result.data) {
        localStorage.setItem('nexus_user', JSON.stringify(result.data));
        localStorage.setItem('nexus_token', result.data.token);
        navigate('/');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await apiRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          username: regUsername,
          email: regEmail,
          password: regPassword,
          nickname: regNickname || undefined,
        }),
      });

      // Auto login after successful registration
      const result = await apiRequest<{ id: string; username: string; email: string; nickname?: string; token: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ login: regUsername, password: regPassword }),
      });

      if (result.data) {
        localStorage.setItem('nexus_user', JSON.stringify(result.data));
        localStorage.setItem('nexus_token', result.data.token);
        navigate('/');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '注册失败');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      await apiRequest('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: forgotEmail }),
      });

      setSuccess('重置邮件已发送，请检查您的邮箱');
      setForgotEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '发送失败');
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

        {/* Auth Card */}
        <CyberCard className="overflow-hidden" hoverEffect={false}>
          {/* View Title */}
          <div className="border-b border-cyber-cyan/20 px-6 py-4">
            <h2 className="text-lg font-display font-semibold text-cyber-white text-center">
              {view === 'login' && '用户登录'}
              {view === 'register' && '注册账号'}
              {view === 'forgot-password' && '重置密码'}
            </h2>
          </div>

          <div className="p-6">
            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-cyber-error/10 border border-cyber-error/30 text-cyber-error text-sm">
                {error}
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-sm">
                {success}
              </div>
            )}

            {/* Login Form */}
            {view === 'login' && (
              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-cyber-muted mb-1.5">
                    用户名或邮箱
                  </label>
                  <input
                    type="text"
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                    placeholder="输入用户名或邮箱"
                    className="w-full px-3 py-2.5 rounded-lg bg-cyber-dark border border-cyber-cyan/20 text-cyber-white placeholder-cyber-muted focus:border-cyber-cyan focus:outline-none focus:ring-1 focus:ring-cyber-cyan transition-colors"
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-cyber-muted mb-1.5">
                    密码
                  </label>
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••"
                    className="w-full px-3 py-2.5 rounded-lg bg-cyber-dark border border-cyber-cyan/20 text-cyber-white placeholder-cyber-muted focus:border-cyber-cyan focus:outline-none focus:ring-1 focus:ring-cyber-cyan transition-colors"
                    required
                  />
                </div>

                <CyberButton
                  type="submit"
                  variant="primary"
                  size="lg"
                  disabled={loading || !loginId || !loginPassword}
                  className="w-full"
                >
                  {loading ? '登录中...' : '登录'}
                </CyberButton>

                <div className="flex items-center justify-between text-sm pt-2">
                  <button
                    type="button"
                    onClick={() => switchView('forgot-password')}
                    className="text-cyber-muted hover:text-cyber-cyan transition-colors"
                  >
                    忘记密码？
                  </button>
                  <button
                    type="button"
                    onClick={() => switchView('register')}
                    className="text-cyber-cyan hover:text-cyber-cyan/80 transition-colors"
                  >
                    没有账号？注册
                  </button>
                </div>
              </form>
            )}

            {/* Register Form */}
            {view === 'register' && (
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-cyber-muted mb-1.5">
                    用户名 <span className="text-cyber-muted/60">(英文，唯一)</span>
                  </label>
                  <input
                    type="text"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    placeholder="例如：john_doe"
                    pattern="[a-zA-Z0-9_]+"
                    className="w-full px-3 py-2.5 rounded-lg bg-cyber-dark border border-cyber-cyan/20 text-cyber-white placeholder-cyber-muted focus:border-cyber-cyan focus:outline-none focus:ring-1 focus:ring-cyber-cyan transition-colors font-mono"
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-cyber-muted mb-1.5">
                    邮箱
                  </label>
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full px-3 py-2.5 rounded-lg bg-cyber-dark border border-cyber-cyan/20 text-cyber-white placeholder-cyber-muted focus:border-cyber-cyan focus:outline-none focus:ring-1 focus:ring-cyber-cyan transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-cyber-muted mb-1.5">
                    密码
                  </label>
                  <input
                    type="password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="至少6位"
                    minLength={6}
                    className="w-full px-3 py-2.5 rounded-lg bg-cyber-dark border border-cyber-cyan/20 text-cyber-white placeholder-cyber-muted focus:border-cyber-cyan focus:outline-none focus:ring-1 focus:ring-cyber-cyan transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-cyber-muted mb-1.5">
                    昵称 <span className="text-cyber-muted/60">(可选)</span>
                  </label>
                  <input
                    type="text"
                    value={regNickname}
                    onChange={(e) => setRegNickname(e.target.value)}
                    placeholder="显示名称"
                    className="w-full px-3 py-2.5 rounded-lg bg-cyber-dark border border-cyber-cyan/20 text-cyber-white placeholder-cyber-muted focus:border-cyber-cyan focus:outline-none focus:ring-1 focus:ring-cyber-cyan transition-colors"
                  />
                </div>

                <CyberButton
                  type="submit"
                  variant="primary"
                  size="lg"
                  disabled={loading || !regUsername || !regEmail || !regPassword}
                  className="w-full mt-2"
                >
                  {loading ? '注册中...' : '注册'}
                </CyberButton>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => switchView('login')}
                    className="text-sm text-cyber-cyan hover:text-cyber-cyan/80 transition-colors"
                  >
                    已有账号？登录
                  </button>
                </div>
              </form>
            )}

            {/* Forgot Password Form */}
            {view === 'forgot-password' && (
              <form onSubmit={handleForgotPassword} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-cyber-muted mb-1.5">
                    邮箱
                  </label>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full px-3 py-2.5 rounded-lg bg-cyber-dark border border-cyber-cyan/20 text-cyber-white placeholder-cyber-muted focus:border-cyber-cyan focus:outline-none focus:ring-1 focus:ring-cyber-cyan transition-colors"
                    required
                    autoFocus
                  />
                </div>

                <p className="text-cyber-muted text-sm">
                  我们将向您的邮箱发送密码重置链接。
                </p>

                <CyberButton
                  type="submit"
                  variant="primary"
                  size="lg"
                  disabled={loading || !forgotEmail}
                  className="w-full"
                >
                  {loading ? '发送中...' : '发送重置邮件'}
                </CyberButton>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => switchView('login')}
                    className="text-sm text-cyber-cyan hover:text-cyber-cyan/80 transition-colors"
                  >
                    返回登录
                  </button>
                </div>
              </form>
            )}
          </div>
        </CyberCard>

        <p className="text-center text-cyber-muted/50 text-xs mt-6">
          Nexus Agents v0.1.0
        </p>
      </div>
    </div>
  );
}
