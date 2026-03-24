import { Outlet, NavLink } from 'react-router-dom'
import { useMe, useLogout } from '../hooks/useAuth'

const navItems = [
  { to: '/members', label: 'Mitglieder' },
  { to: '/search', label: 'Suche' },
  { to: '/stats', label: 'Statistik' },
]

const adminItems = [
  { to: '/import', label: 'Import' },
  { to: '/duplicates', label: 'Dubletten' },
  { to: '/fields', label: 'Felder' },
]

export default function Layout() {
  const { data: user } = useMe()
  const logout = useLogout()

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <nav style={{ width: 220, background: '#1a1a2e', color: '#fff', padding: '24px 0', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '0 20px 24px', fontWeight: 700, fontSize: 18 }}>BuHMV</div>
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to}
            style={({ isActive }) => ({
              padding: '10px 20px', color: isActive ? '#7eb8f7' : '#cdd5e0',
              background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
            })}>
            {item.label}
          </NavLink>
        ))}
        {user?.role === 'admin' && (
          <>
            <div style={{ margin: '16px 20px 8px', fontSize: 11, textTransform: 'uppercase', color: '#6b7280', letterSpacing: 1 }}>Admin</div>
            {adminItems.map((item) => (
              <NavLink key={item.to} to={item.to}
                style={({ isActive }) => ({
                  padding: '10px 20px', color: isActive ? '#7eb8f7' : '#cdd5e0',
                  background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
                })}>
                {item.label}
              </NavLink>
            ))}
          </>
        )}
        <div style={{ marginTop: 'auto', padding: '16px 20px', borderTop: '1px solid #2d2d44' }}>
          <div style={{ fontSize: 13, marginBottom: 8, color: '#9ca3af' }}>{user?.username} · {user?.role}</div>
          <button onClick={logout} style={{ background: 'none', border: '1px solid #4b5563', color: '#9ca3af', padding: '6px 12px', borderRadius: 4, cursor: 'pointer' }}>
            Abmelden
          </button>
        </div>
      </nav>
      <main style={{ flex: 1, padding: 32, overflowY: 'auto' }}>
        <Outlet />
      </main>
    </div>
  )
}
