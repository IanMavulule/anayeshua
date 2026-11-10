import { usePageMeta } from '../../hooks/common/usePageMeta'
import { AdminProvider } from '../../components/admin/AdminContext'
import AdminSidebar from '../../components/admin/AdminSidebar'
import AdminTopbar from '../../components/admin/AdminTopbar'
import AdminOverlays from '../../components/admin/AdminOverlays'
import OverviewPanel from '../../components/admin/panels/OverviewPanel'
import CoursesPanel from '../../components/admin/panels/CoursesPanel'
import AgendaPanel from '../../components/admin/panels/AgendaPanel'
import TestimoniesPanel from '../../components/admin/panels/TestimoniesPanel'
import MembersPanel from '../../components/admin/panels/MembersPanel'
import SettingsPanel from '../../components/admin/panels/SettingsPanel'
import ServerPanel from '../../components/admin/panels/ServerPanel'
import DailyPanel from '../../components/admin/panels/DailyPanel'
import QuestionsPanel from '../../components/admin/panels/QuestionsPanel'
import AdminLoadState from '../../components/admin/AdminLoadState'

export default function AdminPage() {
  usePageMeta('Administração', 'adm-body')
  return (
    <>
      <a className="skip-link" href="#adm-content">Ir para o conteúdo</a>
      <AdminProvider>
        <div className="adm">
          <AdminSidebar />
          <div className="adm-main">
            <AdminTopbar />
            <main className="adm-content" id="adm-content">
              <AdminLoadState />
              <OverviewPanel />
              <CoursesPanel />
              <AgendaPanel />
              <DailyPanel />
              <TestimoniesPanel />
              <QuestionsPanel />
              <MembersPanel />
              <ServerPanel />
              <SettingsPanel />
            </main>
          </div>
        </div>
        <AdminOverlays />
      </AdminProvider>
    </>
  )
}
