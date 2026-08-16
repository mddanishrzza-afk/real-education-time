// ============================================================
// Role-based route guard
// - if allowedRoles provided, checks the user's role
// - redirects unauthenticated users to /login
// ============================================================
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Spinner } from './ui'

export default function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, loading, role } = useAuth()
  const location = useLocation()

  if (loading) {
    return <Spinner />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    // Student trying to access teacher/admin, or teacher trying admin
    return <Navigate to="/dashboard" replace />
  }

  return children
}
