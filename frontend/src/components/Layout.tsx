import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useMe, useLogout } from '../hooks/useAuth'

export default function Layout() {
  const { data: user } = useMe()
  const logout = useLogout()
  const navigate = useNavigate()
  const isAdmin = user?.role === 'admin'
  const isOffice = user?.role === 'admin' || user?.role === 'office'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Top Navigation Bar */}
      <header style={{ background: '#2a5298', color: '#fff', height: 48, display: 'flex', alignItems: 'center', padding: '0 20px', gap: 0, flexShrink: 0, boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 24, cursor: 'pointer' }} onClick={() => navigate('/members')}>
          <div style={{ width: 30, height: 30, background: '#fff', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#2a5298', fontWeight: 900, fontSize: 13 }}>BH</span>
          </div>
          <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: 0.3 }}>BuHMV</span>
        </div>

        {/* Top Nav Items */}
        {[
          { label: 'Mitglieder', to: '/members' },
          { label: 'Dokumente', to: '/documents' },
          ...(isAdmin ? [{ label: 'Administration', to: '/fields' }] : []),
        ].map(item => (
          <NavLink key={item.to} to={item.to}
            style={({ isActive }) => ({
              padding: '0 16px', height: 48, display: 'flex', alignItems: 'center',
              color: '#fff', fontSize: 14, fontWeight: 500,
              borderBottom: isActive ? '3px solid #fff' : '3px solid transparent',
              opacity: isActive ? 1 : 0.85,
            })}>
            {item.label}
          </NavLink>
        ))}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* User menu */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 13, opacity: 0.85 }}>Mein Zugang</span>
          <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.3)' }} />
          <button onClick={logout}
            style={{ background: 'none', border: '1px solid rgba(255,255,255,0.4)', color: '#fff', padding: '4px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}>
            Abmelden
          </button>
          <div style={{ fontSize: 12, opacity: 0.7 }}>{user?.username}</div>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1 }}>
        {/* Left Sidebar */}
        <nav style={{ width: 210, background: '#fff', borderRight: '1px solid #e5e7eb', padding: '16px 0', flexShrink: 0, overflowY: 'auto' }}>

          {/* Suchen */}
          <SideSection>
            <SideItem to="/search" icon="🔍" label="Suchen" />
            <SideItem to="/saved-views" icon="🔖" label="Gespeicherte Suchen" indent />
          </SideSection>

          <SideDivider />

          {/* Mitglieder */}
          <SideHeading>Mitglieder</SideHeading>
          <SideSection>
            <SideItem to="/organigramm" icon="🏢" label="Organigramm" />
            <SideItem to="/members" icon="👥" label="Alle" />
            <SideItem to="/groups" icon="📁" label="Gruppen" />
            <SideItem to="/birthdays" icon="🎁" label="Geburtstage & Jubiläen" />
            <SideItem to="/presence" icon="📋" label="Präsenzlisten" />
          </SideSection>

          <SideDivider />

          {/* Organisieren */}
          <SideHeading>Organisieren</SideHeading>
          <SideSection>
            {isOffice && <SideItem to="/import" icon="⬆️" label="Daten importieren" />}
            {isAdmin && <SideItem to="/fields" icon="⚙️" label="Datenfelder bearbeiten" />}
            {isAdmin && <SideItem to="/groups-edit" icon="📁" label="Gruppen bearbeiten" />}
            {isAdmin && <SideItem to="/duplicates" icon="🔄" label="Letzte Änderungen" />}
          </SideSection>

        </nav>

        {/* Main Content */}
        <main style={{ flex: 1, padding: 32, background: '#f4f6f9', overflowY: 'auto' }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function SideSection({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: '2px 0' }}>{children}</div>
}

function SideHeading({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: '8px 16px 4px', fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5 }}>
      {children}
    </div>
  )
}

function SideDivider() {
  return <div style={{ height: 1, background: '#e5e7eb', margin: '8px 0' }} />
}

function SideItem({ to, icon, label, indent }: { to: string; icon: string; label: string; indent?: boolean }) {
  return (
    <NavLink to={to}
      style={({ isActive }) => ({
        display: 'flex', alignItems: 'center', gap: 8,
        padding: `6px 16px 6px ${indent ? 32 : 16}px`,
        fontSize: 13.5, color: isActive ? '#2a5298' : '#374151',
        background: isActive ? '#eff4ff' : 'transparent',
        borderLeft: isActive ? '3px solid #2a5298' : '3px solid transparent',
        fontWeight: isActive ? 600 : 400,
      })}>
      <span style={{ fontSize: 14 }}>{icon}</span>
      {label}
    </NavLink>
  )
}
