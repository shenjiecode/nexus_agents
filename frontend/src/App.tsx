import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { Organizations } from './pages/Organizations';
import { OrganizationDetail } from './pages/OrganizationDetail';
import { Roles } from './pages/Roles';
import { Containers } from './pages/Containers';

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

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout><Dashboard /></Layout>} />
        <Route path="/organizations" element={<Layout><Organizations /></Layout>} />
        <Route path="/organizations/:slug" element={<Layout><OrganizationDetail /></Layout>} />
        <Route path="/roles" element={<Layout><Roles /></Layout>} />
        <Route path="/containers" element={<Layout><Containers /></Layout>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
