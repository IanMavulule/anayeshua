import type { ReactNode } from 'react'
import AdminPage from '../pages/admin'
import DailyWordPage from '../pages/daily'
import DashboardPage from '../pages/dashboard'
import DevotionalsPage from '../pages/devotionals'
import LandingPage from '../pages/landing'
import LoginPage from '../pages/login'
import PaymentPage from '../pages/payment'
import QuestionsPage from '../pages/questions'
import RegisterPage from '../pages/register'
import { ROUTES } from '../utils/constants/routes'

export type RouteAccess = 'public' | 'member' | 'admin'

export interface AppRoute {
  path: string
  component: ReactNode
  access: RouteAccess
}

/** Lista de rotas no mesmo formato do routeList do dhis2-semis-core. */
export default function RouteList(): AppRoute[] {
  return [
    { path: ROUTES.landing, component: <LandingPage />, access: 'public' },
    { path: ROUTES.login, component: <LoginPage />, access: 'public' },
    { path: ROUTES.register, component: <RegisterPage />, access: 'public' },
    // Os devocionais e a Palavra do dia são públicos; vídeos e partilhas pedem sessão.
    { path: ROUTES.devotionals, component: <DevotionalsPage />, access: 'public' },
    { path: ROUTES.daily, component: <DailyWordPage />, access: 'public' },
    { path: ROUTES.dashboard, component: <DashboardPage />, access: 'member' },
    { path: ROUTES.questions, component: <QuestionsPage />, access: 'member' },
    { path: ROUTES.payment, component: <PaymentPage />, access: 'member' },
    { path: ROUTES.admin, component: <AdminPage />, access: 'admin' },
  ]
}
