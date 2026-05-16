import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { Organizations } from './pages/Organizations';
import { OrganizationDetail } from './pages/OrganizationDetail';
import { Roles } from './pages/Roles';
import { Employees } from './pages/Employees';
import { Skills } from './pages/Skills';
import { Mcps } from './pages/Mcps';
import { AgentDetail } from './pages/AgentDetail';
import { Login } from './pages/Login';
import { MarketplaceRoles } from './pages/MarketplaceRoles';

// Simple auth guard: check if org is stored in localStorage
function useAuth() {
  const [org, setOrg] = useState<{ id: string; name: string; slug: string } | null>(() => {
    try {
      const stored = localStorage.getItem('nexus_org');
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === 'nexus_org') {
        setOrg(e.newValue ? JSON.parse(e.newValue) : null);
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  return org;
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
  const org = useAuth();
  if (!org) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function LogoutWrapper() {
  localStorage.removeItem('nexus_org');
  return <Navigate to="/login" replace />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/logout" element={<LogoutWrapper />} />
        <Route path="/" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
        <Route path="/organizations" element={<ProtectedRoute><Layout><Organizations /></Layout></ProtectedRoute>} />
        <Route path="/organizations/:slug" element={<ProtectedRoute><Layout><OrganizationDetail /></Layout></ProtectedRoute>} />
        <Route path="/roles" element={<ProtectedRoute><Layout><Roles /></Layout></ProtectedRoute>} />
        <Route path="/employees" element={<ProtectedRoute><Layout><Employees /></Layout></ProtectedRoute>} />
        <Route path="/employees/:id" element={<ProtectedRoute><Layout><AgentDetail /></Layout></ProtectedRoute>} />
        <Route path="/skills" element={<ProtectedRoute><Layout><Skills /></Layout></ProtectedRoute>} />
        <Route path="/mcps" element={<ProtectedRoute><Layout><Mcps /></Layout></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
        <Route path="/marketplace-roles" element={<ProtectedRoute><Layout><MarketplaceRoles /></Layout></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
