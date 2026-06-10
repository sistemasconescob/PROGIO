import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import Layout from './components/Layout/Layout'
import { PageSpinner } from './components/ui/Spinner'

import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Services from './pages/Services'
import Contracts from './pages/Contracts'
import Vehicles from './pages/Vehicles'
import Clients from './pages/Clients'
import Users from './pages/Users'
import Supplies from './pages/Supplies'
import Reports from './pages/Reports'
import Audit from './pages/Audit'
import PreBilling from './pages/PreBilling'
import EnvConfig from './pages/EnvConfig'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <PageSpinner />
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<Dashboard />} />
        <Route path="services" element={<Services />} />
        <Route path="contracts" element={<Contracts />} />
        <Route path="vehicles" element={<Vehicles />} />
        <Route path="clients" element={<Clients />} />
        <Route path="users" element={<Users />} />
        <Route path="supplies" element={<Supplies />} />
        <Route path="prebilling" element={<PreBilling />} />
        <Route path="env-config" element={<EnvConfig />} />
        <Route path="reports" element={<Reports />} />
        <Route path="audit" element={<Audit />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
