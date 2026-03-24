import { useState } from 'react'
import { Outlet, NavLink, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useMe, useLogout } from '../hooks/useAuth'
import api from '../api/client'

interface GroupNode {
  id: number
  name: string
  member_count: number
  children: GroupNode[]
}

// ── Group Tree Node ───────────────────────────────────────────────────────────

function GroupTreeNode({ node, depth = 0 }: { node: GroupNode; depth?: number }) {
  const [open, setOpen] = useState(depth < 1)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const activeGroupId = searchParams.get('group') ? Number(searchParams.get('group')) : null
  const isActive = activeGroupId === node.id
  const hasChildren = node.children.length > 0

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation()
    navigate(`/members?group=${node.id}`)
  }

  function toggleOpen(e: React.MouseEvent) {
    e.stopPropagation()
    setOpen(o => !o)
  }

  return (
    <div>
      <div
        onClick={handleClick}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: `5px 8px 5px ${14 + depth * 14}px`,
          cursor: 'pointer', userSelect: 'none',
          background: isActive ? '#eff4ff' : 'transparent',
          borderLeft: isActive ? '3px solid #2a5298' : '3px solid transparent',
          color: isActive ? '#2a5298' : '#374151',
          fontWeight: isActive ? 600 : 400,
          fontSize: 13,
          borderRadius: '0 4px 4px 0',
        }}
        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#f9fafb' }}
        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
      >
        {/* Expand toggle */}
        <span
          onClick={hasChildren ? toggleOpen : undefined}
          style={{
            width: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, color: '#9ca3af', flexShrink: 0,
            cursor: hasChildren ? 'pointer' : 'default',
          }}
        >
          {hasChildren ? (open ? '▾' : '▸') : ''}
        </span>

        {/* Folder icon */}
        <span style={{ fontSize: 12, flexShrink: 0 }}>
          {hasChildren ? (open ? '📂' : '📁') : '📄'}
        </span>

        {/* Name */}
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {node.name}
        </span>

        {/* Count badge */}
        {node.member_count > 0 && (
          <span style={{
            fontSize: 10, background: isActive ? '#2a5298' : '#e5e7eb',
            color: isActive ? '#fff' : '#6b7280',
            borderRadius: 10, padding: '1px 5px', flexShrink: 0,
          }}>
            {node.member_count}
          </span>
        )}
      </div>

      {/* Children */}
      {hasChildren && open && (
        <div>
          {node.children.map(child => (
            <GroupTreeNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Group Tree Panel ──────────────────────────────────────────────────────────

function GroupTreePanel() {
  const { data: groups = [] } = useQuery<GroupNode[]>({
    queryKey: ['groups-tree'],
    queryFn: () => api.get('/groups', { params: { tree: true } }).then(r => r.data),
    staleTime: 30_000,
  })

  if (groups.length === 0) return null

  return (
    <div style={{ marginTop: 4 }}>
      {groups.map(node => (
        <GroupTreeNode key={node.id} node={node} depth={0} />
      ))}
    </div>
  )
}

// ── Layout ────────────────────────────────────────────────────────────────────

export default function Layout() {
  const { data: user } = useMe()
  const logout = useLogout()
  const navigate = useNavigate()
  const isAdmin = user?.role === 'admin'
  const isOffice = user?.role === 'admin' || user?.role === 'office'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Top Bar */}
      <header style={{ background: '#2a5298', color: '#fff', height: 48, display: 'flex', alignItems: 'center', padding: '0 20px', gap: 0, flexShrink: 0, boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 24, cursor: 'pointer' }} onClick={() => navigate('/members')}>
          <div style={{ width: 30, height: 30, background: '#fff', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#2a5298', fontWeight: 900, fontSize: 13 }}>BH</span>
          </div>
          <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: 0.3 }}>BuHMV</span>
        </div>

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

        <div style={{ flex: 1 }} />
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

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
        <nav style={{ width: 220, background: '#fff', borderRight: '1px solid #e5e7eb', flexShrink: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

          {/* Suchen */}
          <div style={{ padding: '12px 0 4px' }}>
            <SideItem to="/search" icon="🔍" label="Suchen" />
            <SideItem to="/saved-views" icon="🔖" label="Gespeicherte Suchen" indent />
          </div>

          <SideDivider />

          {/* Gruppen-Baum */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px 2px' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Gruppen
              </span>
              <NavLink to="/members"
                style={{ fontSize: 11, color: '#2a5298', textDecoration: 'none' }}
                title="Alle Mitglieder">
                Alle
              </NavLink>
            </div>
            <GroupTreePanel />
          </div>

          <SideDivider />

          {/* Mitglieder-Ansichten */}
          <div style={{ padding: '4px 0' }}>
            <SideHeading>Auswertungen</SideHeading>
            <SideItem to="/organigramm" icon="🏢" label="Organigramm" />
            <SideItem to="/birthdays" icon="🎁" label="Geburtstage" />
            <SideItem to="/stats" icon="📊" label="Statistiken" />
          </div>

          <SideDivider />

          {/* Organisieren */}
          <div style={{ padding: '4px 0' }}>
            <SideHeading>Organisieren</SideHeading>
            {isOffice && <SideItem to="/import" icon="⬆️" label="Daten importieren" />}
            {isAdmin && <SideItem to="/fields" icon="⚙️" label="Datenfelder" />}
            {isAdmin && <SideItem to="/groups-edit" icon="📁" label="Gruppen bearbeiten" />}
          </div>

        </nav>

        {/* Main */}
        <main style={{ flex: 1, padding: 32, background: '#f4f6f9', overflowY: 'auto' }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function SideHeading({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: '4px 16px 2px', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
      {children}
    </div>
  )
}

function SideDivider() {
  return <div style={{ height: 1, background: '#e5e7eb', margin: '6px 0' }} />
}

function SideItem({ to, icon, label, indent }: { to: string; icon: string; label: string; indent?: boolean }) {
  return (
    <NavLink to={to}
      style={({ isActive }) => ({
        display: 'flex', alignItems: 'center', gap: 8,
        padding: `6px 12px 6px ${indent ? 28 : 12}px`,
        fontSize: 13, color: isActive ? '#2a5298' : '#374151',
        background: isActive ? '#eff4ff' : 'transparent',
        borderLeft: isActive ? '3px solid #2a5298' : '3px solid transparent',
        fontWeight: isActive ? 600 : 400,
      })}>
      <span style={{ fontSize: 13 }}>{icon}</span>
      {label}
    </NavLink>
  )
}
