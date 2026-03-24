import { Routes, Route, Navigate } from 'react-router-dom'
import { useMe } from './hooks/useAuth'
import LoginPage from './pages/LoginPage'
import Layout from './components/Layout'
import MembersPage from './pages/MembersPage'
import MemberDetailPage from './pages/MemberDetailPage'
import SearchPage from './pages/SearchPage'
import StatsPage from './pages/StatsPage'
import ImportPage from './pages/ImportPage'
import DuplicatesPage from './pages/DuplicatesPage'
import FieldsPage from './pages/FieldsPage'
import DocumentsPage from './pages/DocumentsPage'
import GroupsPage from './pages/GroupsPage'
import GroupsEditPage from './pages/GroupsEditPage'
import BirthdaysPage from './pages/BirthdaysPage'
import PresencePage from './pages/PresencePage'
import SavedViewsPage from './pages/SavedViewsPage'
import OrganigrammPage from './pages/OrganigrammPage'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading } = useMe()
  if (isLoading) return <div style={{ padding: 40 }}>Laden…</div>
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading } = useMe()
  if (isLoading) return <div style={{ padding: 40 }}>Laden…</div>
  if (user?.role !== 'admin') return <div style={{ padding: 40 }}>Kein Zugriff.</div>
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<Navigate to="/members" replace />} />
        <Route path="members" element={<MembersPage />} />
        <Route path="members/:id" element={<MemberDetailPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="saved-views" element={<SavedViewsPage />} />
        <Route path="stats" element={<StatsPage />} />
        <Route path="documents" element={<DocumentsPage />} />
        <Route path="groups" element={<GroupsPage />} />
        <Route path="birthdays" element={<BirthdaysPage />} />
        <Route path="presence" element={<PresencePage />} />
        <Route path="organigramm" element={<OrganigrammPage />} />
        <Route path="import" element={<ImportPage />} />
        <Route path="duplicates" element={<RequireAdmin><DuplicatesPage /></RequireAdmin>} />
        <Route path="fields" element={<RequireAdmin><FieldsPage /></RequireAdmin>} />
        <Route path="groups-edit" element={<RequireAdmin><GroupsEditPage /></RequireAdmin>} />
      </Route>
    </Routes>
  )
}
