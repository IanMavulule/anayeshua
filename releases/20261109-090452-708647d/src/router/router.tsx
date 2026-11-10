import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import Loader from '../components/ui/Loader'
import { useSession } from '../hooks/auth/useSession'
import { loginUrl } from '../utils/auth/loginDestination'
import { ROUTES } from '../utils/constants/routes'
import RouteList, { type RouteAccess } from './routeList'

/** Protege as rotas que pedem sessão ou papel de administração. */
function Guard({ access, children }: { access: RouteAccess; children: ReactNode }) {
  const { user, loading } = useSession()
  const location = useLocation()
  if (access === 'public') return <>{children}</>
  if (loading) return <Loader variant="page" />
  if (!user) return <Navigate to={loginUrl(location.pathname + location.search)} replace />
  if (access === 'admin' && user.role !== 'admin') return <Navigate to={ROUTES.dashboard} replace />
  return <>{children}</>
}

export default function Router() {
  return (
    <BrowserRouter>
      <Routes>
        {RouteList().map((route) => (
          <Route key={route.path} path={route.path} element={<Guard access={route.access}>{route.component}</Guard>} />
        ))}
        <Route path="*" element={<Navigate to={ROUTES.landing} replace />} />
      </Routes>
    </BrowserRouter>
  )
}
