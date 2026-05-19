import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../hooks/useApi';

type Tab = 'admin' | 'org-login' | 'org-register';

export function Login() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('admin');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Admin login
  const [adminPassword, setAdminPassword] = useState('');

  // Org login
  const [orgSlug, setOrgSlug] = useState('');
  const [orgPassword, setOrgPassword] = useState('');

  // Org register
  const [regName, setRegName] = useState('');
  const [regSlug, setRegSlug] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regDesc, setRegDesc] = useState('');

  const generateSlug = (name: string) => {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return slug || 'org-' + Date.now().toString(36);
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await apiRequest<{ id: string; name: string; slug: string; role: string }>('/api/auth/admin-login', {
        method: 'POST',
        body: JSON.stringify({ password: adminPassword }),
      });
      localStorage.setItem('nexus_org', JSON.stringify(result.data));
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleOrgLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await apiRequest<{ id: string; name: string; slug: string; role: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ slug: orgSlug, password: orgPassword }),
      });
      localStorage.setItem('nexus_org', JSON.stringify(result.data));
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleOrgRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiRequest('/api/organizations', {
        method: 'POST',
        body: JSON.stringify({
          name: regName,
          slug: regSlug || generateSlug(regName),
          password: regPassword,
          description: regDesc,
        }),
      });
      // Auto login after register
      const slug = regSlug || generateSlug(regName);
      const result = await apiRequest<{ id: string; name: string; slug: string; role: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ slug, password: regPassword }),
      });
      localStorage.setItem('nexus_org', JSON.stringify(result));
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : '注册失败');
    } finally {
      setLoading(false);
    }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'admin', label: '管理员' },
    { key: 'org-login', label: '组织登录' },
    { key: 'org-register', label: '注册组织' },
  ];

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

        {/* Card */}
        <div className="rounded-xl bg-cyber-dark-card/80 backdrop-blur-sm border border-cyber-cyan/20 shadow-lg shadow-cyber-cyan/5 overflow-hidden">
          {/* Tab Bar */}
          <div className="flex border-b border-cyber-cyan/20">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => { setTab(t.key); setError(null); }}
                className={`flex-1 py-3 text-sm font-medium transition-all
                  ${tab === t.key
                    ? 'text-cyber-cyan border-b-2 border-cyber-cyan bg-cyber-cyan/5'
                    : 'text-cyber-muted hover:text-cyber-white'
                  }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="p-8">
            {/* Error */}
            {error && (
              <div className="mb-5 p-3 rounded-lg bg-cyber-error/10 border border-cyber-error/30 text-cyber-error text-sm">
                {error}
              </div>
            )}

            {/* Admin Login */}
            {tab === 'admin' && (
              <form onSubmit={handleAdminLogin} className="space-y-5">
                <p className="text-cyber-muted text-sm">
                  管理员可查看所有组织、角色、员工和市场数据。
                </p>
                <div>
                  <label className="block text-sm font-medium text-cyber-muted mb-1">管理员密码</label>
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="••••••"
                    className="w-full px-3 py-2 rounded-lg bg-cyber-dark border border-cyber-cyan/20 text-cyber-white placeholder-cyber-muted focus:border-cyber-cyan focus:outline-none focus:ring-1 focus:ring-cyber-cyan"
                    required
                    autoFocus
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !adminPassword}
                  className="w-full py-2.5 px-4 rounded-lg font-semibold text-sm transition-all
                    bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/30
                    hover:bg-cyber-cyan/30 hover:shadow-lg hover:shadow-cyber-cyan/20
                    disabled:opacity-40 disabled:cursor-not-allowed neon-border"
                >
                  {loading ? '登录中...' : '管理员登录'}
                </button>
              </form>
            )}

            {/* Org Login */}
            {tab === 'org-login' && (
              <form onSubmit={handleOrgLogin} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-cyber-muted mb-1">组织 Slug</label>
                  <input
                    type="text"
                    value={orgSlug}
                    onChange={(e) => setOrgSlug(e.target.value)}
                    placeholder="例如：acme-corp"
                    className="w-full px-3 py-2 rounded-lg bg-cyber-dark border border-cyber-cyan/20 text-cyber-white placeholder-cyber-muted focus:border-cyber-cyan focus:outline-none focus:ring-1 focus:ring-cyber-cyan font-mono"
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-cyber-muted mb-1">密码</label>
                  <input
                    type="password"
                    value={orgPassword}
                    onChange={(e) => setOrgPassword(e.target.value)}
                    placeholder="••••••"
                    className="w-full px-3 py-2 rounded-lg bg-cyber-dark border border-cyber-cyan/20 text-cyber-white placeholder-cyber-muted focus:border-cyber-cyan focus:outline-none focus:ring-1 focus:ring-cyber-cyan"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !orgSlug || !orgPassword}
                  className="w-full py-2.5 px-4 rounded-lg font-semibold text-sm transition-all
                    bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/30
                    hover:bg-cyber-cyan/30 hover:shadow-lg hover:shadow-cyber-cyan/20
                    disabled:opacity-40 disabled:cursor-not-allowed neon-border"
                >
                  {loading ? '登录中...' : '组织登录'}
                </button>
              </form>
            )}

            {/* Org Register */}
            {tab === 'org-register' && (
              <form onSubmit={handleOrgRegister} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-cyber-muted mb-1">组织名称</label>
                  <input
                    type="text"
                    value={regName}
                    onChange={(e) => {
                      const name = e.target.value;
                      setRegName(name);
                      if (!regSlug) setRegSlug(generateSlug(name));
                    }}
                    placeholder="例如：Acme Corporation"
                    className="w-full px-3 py-2 rounded-lg bg-cyber-dark border border-cyber-cyan/20 text-cyber-white placeholder-cyber-muted focus:border-cyber-cyan focus:outline-none"
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-cyber-muted mb-1">Slug</label>
                  <input
                    type="text"
                    value={regSlug}
                    onChange={(e) => setRegSlug(e.target.value)}
                    placeholder="例如：acme-corp"
                    className="w-full px-3 py-2 rounded-lg bg-cyber-dark border border-cyber-cyan/20 text-cyber-white placeholder-cyber-muted focus:border-cyber-cyan focus:outline-none font-mono"
                    required
                  />
                  <p className="text-xs text-cyber-muted mt-1">用于 URL 和登录标识</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-cyber-muted mb-1">登录密码</label>
                  <input
                    type="password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="至少 6 位"
                    className="w-full px-3 py-2 rounded-lg bg-cyber-dark border border-cyber-cyan/20 text-cyber-white placeholder-cyber-muted focus:border-cyber-cyan focus:outline-none"
                    required
                    minLength={6}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-cyber-muted mb-1">描述（可选）</label>
                  <textarea
                    value={regDesc}
                    onChange={(e) => setRegDesc(e.target.value)}
                    placeholder="组织简介..."
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg bg-cyber-dark border border-cyber-cyan/20 text-cyber-white placeholder-cyber-muted focus:border-cyber-cyan focus:outline-none resize-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !regName || !regSlug || !regPassword}
                  className="w-full py-2.5 px-4 rounded-lg font-semibold text-sm transition-all
                    bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/30
                    hover:bg-cyber-cyan/30 hover:shadow-lg hover:shadow-cyber-cyan/20
                    disabled:opacity-40 disabled:cursor-not-allowed neon-border"
                >
                  {loading ? '注册中...' : '注册并登录'}
                </button>
              </form>
            )}
          </div>
        </div>

        <p className="text-center text-cyber-muted/50 text-xs mt-6">
          Nexus Agents v0.1.0
        </p>
      </div>
    </div>
  );
}
