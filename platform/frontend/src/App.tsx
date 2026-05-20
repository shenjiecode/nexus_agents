import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { Skills } from './pages/Skills';
import { Mcps } from './pages/Mcps';
import { Login } from './pages/Login';
import { Roles } from './pages/Roles';
import { RoleDebug } from './pages/RoleDebug';
import { ResetPassword } from './pages/ResetPassword';

// Simple auth guard: check if user is stored in localStorage
function useAuth() {
  const [user, setUser] = useState<{ id: string; name: string; slug: string } | null>(() => {
    try {
      const stored = localStorage.getItem('nexus_user');
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === 'nexus_user') {
        setUser(e.newValue ? JSON.parse(e.newValue) : null);
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  return user;
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen cyber-grid-bg bg-cyber-gradient">
      <Sidebar />
      <main className="lg:ml-64 min-h-screen transition-all duration-300">
        <div className="p-6 lg:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const user = useAuth();
  const navigate = useNavigate();
  
  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true });
    }
  }, [user, navigate]);
  
  if (!user) return null;
  return <>{children}</>;
}

function LogoutWrapper() {
  localStorage.removeItem('nexus_user');
  const navigate = useNavigate();
  
  useEffect(() => {
    navigate('/login', { replace: true });
  }, [navigate]);
  
  return null;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
        <Route path="/skills" element={<ProtectedRoute><Layout><Skills /></Layout></ProtectedRoute>} />
        <Route path="/mcps" element={<ProtectedRoute><Layout><Mcps /></Layout></ProtectedRoute>} />
        <Route path="/roles" element={<ProtectedRoute><Layout><Roles /></Layout></ProtectedRoute>} />
        <Route path="/roles/:id/debug" element={<ProtectedRoute><Layout><RoleDebug /></Layout></ProtectedRoute>} />
        <Route path="/logout" element={<LogoutWrapper />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;