import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'

function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4">
          <h1 className="text-3xl font-bold text-gray-900">Nexus Agents</h1>
        </div>
      </header>
      <main className="max-w-7xl mx-auto py-6 px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link 
            to="/organizations"
            className="block p-6 bg-white rounded-lg shadow hover:shadow-md transition"
          >
            <h2 className="text-xl font-semibold text-gray-800">Organizations</h2>
            <p className="mt-2 text-gray-600">Manage organizations and their API keys</p>
          </Link>
          <Link 
            to="/roles"
            className="block p-6 bg-white rounded-lg shadow hover:shadow-md transition"
          >
            <h2 className="text-xl font-semibold text-gray-800">Roles</h2>
            <p className="mt-2 text-gray-600">Define and version AI agent roles</p>
          </Link>
          <Link 
            to="/containers"
            className="block p-6 bg-white rounded-lg shadow hover:shadow-md transition"
          >
            <h2 className="text-xl font-semibold text-gray-800">Containers</h2>
            <p className="mt-2 text-gray-600">Running AI agent instances</p>
          </Link>
        </div>
      </main>
    </div>
  )
}

function OrganizationsPage() {
  return <div className="p-6">Organizations Management (Coming Soon)</div>
}

function RolesPage() {
  return <div className="p-6">Roles Management (Coming Soon)</div>
}

function ContainersPage() {
  return <div className="p-6">Containers Dashboard (Coming Soon)</div>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/organizations" element={<OrganizationsPage />} />
        <Route path="/roles" element={<RolesPage />} />
        <Route path="/containers" element={<ContainersPage />} />
      </Routes>
    </BrowserRouter>
  )
}