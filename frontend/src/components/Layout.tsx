import { useState, createContext, useContext } from 'react'
import { Outlet, NavLink, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useMe, useLogout } from '../hooks/useAuth'
import api from '../api/client'

// ── Branding Context ──────────────────────────────────────────────────────────

interface Branding {
  club_name: string; logo_url: string
  primary_color: string; header_text_color: string
  sidebar_bg: string; sidebar_text_color: string; workspace_bg: string
}
const DEFAULT_BRANDING: Branding = {
  club_name: 'BuHMV', logo_url: '',
  primary_color: '#2a5298', header_text_color: '#ffffff',
  sidebar_bg: '#ffffff', sidebar_text_color: '#374151', workspace_bg: '#f3f4f6',
}
const BrandingCtx = createContext<Branding>(DEFAULT_BRANDING)
function useBranding() { return useContext(BrandingCtx) }

// ── Helper: derive active bg from primary color ───────────────────────────────
function activeBg(hex: string) {
  // append 18% opacity as hex
  return hex + '20'
}

// ── Sidebar primitives ────────────────────────────────────────────────────────

function SideHeading({ children }: { children: React.ReactNode }) {
  const b = useBranding()
  // Use sidebar_text_color at 60% — approximate by mixing with bg
  return (
    <div style={{ padding: '4px 16px 2px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: b.sidebar_text_color, opacity: 0.55 }}>
      {children}
    </div>
  )
}

function SideDivider() {
  return <div style={{ height: 1, background: '#e5e7eb', margin: '6px 0' }} />
}

function SideItem({ to, icon, label, indent }: { to: string; icon: string; label: string; indent?: boolean }) {
  const b = useBranding()
  return (
    <NavLink to={to}
      style={({ isActive }) => ({
        display: 'flex', alignItems: 'center', gap: 8,
        padding: `6px 12px 6px ${indent ? 28 : 12}px`,
        fontSize: 13,
        color: isActive ? b.primary_color : b.sidebar_text_color,
        background: isActive ? activeBg(b.primary_color) : 'transparent',
        borderLeft: isActive ? `3px solid ${b.primary_color}` : '3px solid transparent',
        fontWeight: isActive ? 600 : 400,
        textDecoration: 'none',
      })}>
      <span style={{ fontSize: 13 }}>{icon}</span>
      {label}
    </NavLink>
  )
}

// ── Group Tree ────────────────────────────────────────────────────────────────

interface GroupNode { id: number; name: string; member_count: number; children: GroupNode[] }

function GroupTreeNode({ node, depth = 0 }: { node: GroupNode; depth?: number }) {
  const b = useBranding()
  const [open, setOpen] = useState(depth < 1)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const activeGroupId = searchParams.get('group') ? Number(searchParams.get('group')) : null
  const isActive = activeGroupId === node.id
  const hasChildren = node.children.length > 0

  return (
    <div>
      <div
        onClick={e => { e.stopPropagation(); navigate(`/members?group=${node.id}`) }}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: `5px 8px 5px ${14 + depth * 14}px`,
          cursor: 'pointer', userSelect: 'none',
          background: isActive ? activeBg(b.primary_color) : 'transparent',
          borderLeft: isActive ? `3px solid ${b.primary_color}` : '3px solid transparent',
          color: isActive ? b.primary_color : b.sidebar_text_color,
          fontWeight: isActive ? 600 : 400, fontSize: 13, borderRadius: '0 4px 4px 0',
        }}
        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = activeBg(b.primary_color) + '60' }}
        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
      >
        <span
          onClick={hasChildren ? e => { e.stopPropagation(); setOpen(o => !o) } : undefined}
          style={{ width: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: b.sidebar_text_color, opacity: 0.5, flexShrink: 0, cursor: hasChildren ? 'pointer' : 'default' }}
        >
          {hasChildren ? (open ? '▾' : '▸') : ''}
        </span>
        <span style={{ fontSize: 12, flexShrink: 0 }}>{hasChildren ? (open ? '📂' : '📁') : '📄'}</span>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.name}</span>
        {node.member_count > 0 && (
          <span style={{ fontSize: 10, background: isActive ? b.primary_color : '#e5e7eb', color: isActive ? '#fff' : b.sidebar_text_color, opacity: isActive ? 1 : 0.7, borderRadius: 10, padding: '1px 5px', flexShrink: 0 }}>
            {node.member_count}
          </span>
        )}
      </div>
      {hasChildren && open && (
        <div>{node.children.map(child => <GroupTreeNode key={child.id} node={child} depth={depth + 1} />)}</div>
      )}
    </div>
  )
}

function GroupTreePanel() {
  const { data: groups = [] } = useQuery<GroupNode[]>({
    queryKey: ['groups-tree'],
    queryFn: () => api.get('/groups', { params: { tree: true } }).then(r => r.data),
    staleTime: 30_000,
  })
  if (groups.length === 0) return null
  return <div style={{ marginTop: 4 }}>{groups.map(node => <GroupTreeNode key={node.id} node={node} depth={0} />)}</div>
}

// ── Saved Searches Panel ──────────────────────────────────────────────────────

interface SavedSearch { id: number; name: string; query_json: string; is_shared: boolean; owner_id: number }

function SavedSearchesPanel() {
  const b = useBranding()
  const [open, setOpen] = useState(true)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const activeSavedId = searchParams.get('saved_id') ? Number(searchParams.get('saved_id')) : null
  const { data: me } = useMe()

  const { data: searches = [] } = useQuery<SavedSearch[]>({
    queryKey: ['saved-searches'],
    queryFn: () => api.get('/views').then(r => r.data),
    staleTime: 30_000,
  })

  // "Persönlich" = my private searches; "Alle Benutzer" = all shared searches (inc. my own)
  const personal   = searches.filter(s => s.owner_id === me?.id && !s.is_shared)
  const allUsers   = searches.filter(s => s.is_shared)

  const itemStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px 5px 28px',
    fontSize: 13, cursor: 'pointer', userSelect: 'none',
    background: active ? activeBg(b.primary_color) : 'transparent',
    borderLeft: active ? `3px solid ${b.primary_color}` : '3px solid transparent',
    color: active ? b.primary_color : b.sidebar_text_color,
    fontWeight: active ? 600 : 400,
    borderRadius: '0 4px 4px 0',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  })

  const sectionLabel: React.CSSProperties = {
    padding: '4px 12px 2px 28px', fontSize: 11, fontWeight: 700,
    color: b.sidebar_text_color, opacity: 0.45,
    textTransform: 'uppercase', letterSpacing: '0.07em',
  }

  return (
    <div>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 13, color: b.sidebar_text_color, userSelect: 'none' }}
        onMouseEnter={e => { e.currentTarget.style.background = activeBg(b.primary_color) + '40' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
      >
        <span style={{ fontSize: 11, opacity: 0.5 }}>{open ? '▾' : '▸'}</span>
        <span style={{ fontSize: 13 }}>🔖</span>
        <span style={{ flex: 1, fontWeight: activeSavedId ? 600 : 400, color: activeSavedId ? b.primary_color : b.sidebar_text_color }}>Gespeicherte Suchen</span>
      </div>
      {open && (
        <div>
          {searches.length === 0 && <div style={{ padding: '4px 12px 4px 28px', fontSize: 12, color: b.sidebar_text_color, opacity: 0.5 }}>Keine gespeicherten Suchen</div>}
          {personal.length > 0 && (
            <>
              <div style={sectionLabel}>Persönlich</div>
              {personal.map(s => (
                <div key={s.id} title={s.name} style={itemStyle(activeSavedId === s.id)} onClick={() => navigate(`/search?saved_id=${s.id}`)}>
                  <span style={{ fontSize: 12, flexShrink: 0 }}>🔍</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                </div>
              ))}
            </>
          )}
          {allUsers.length > 0 && (
            <>
              <div style={{ ...sectionLabel, paddingTop: 6 }}>Alle Benutzer</div>
              {allUsers.map(s => (
                <div key={s.id} title={s.name} style={itemStyle(activeSavedId === s.id)} onClick={() => navigate(`/search?saved_id=${s.id}`)}>
                  <span style={{ fontSize: 12, flexShrink: 0 }}>🔍</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                </div>
              ))}
            </>
          )}
        </div>
      )}
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

  const { data: branding = DEFAULT_BRANDING } = useQuery<Branding>({
    queryKey: ['branding'],
    queryFn: () => api.get('/branding').then(r => r.data),
    staleTime: 60_000,
  })

  return (
    <BrandingCtx.Provider value={branding}>
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

        {/* Top Bar */}
        <header style={{ background: branding.primary_color, color: branding.header_text_color, height: 48, display: 'flex', alignItems: 'center', padding: '0 20px', gap: 0, flexShrink: 0, boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 24, cursor: 'pointer' }} onClick={() => navigate('/members')}>
            {branding.logo_url
              ? <img src={branding.logo_url} alt="Logo" style={{ height: 32, maxWidth: 80, objectFit: 'contain' }} />
              : <div style={{ width: 30, height: 30, background: 'rgba(255,255,255,0.2)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: branding.header_text_color, fontWeight: 900, fontSize: 12 }}>{branding.club_name.substring(0, 2).toUpperCase()}</span>
                </div>
            }
            <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: 0.3, color: branding.header_text_color }}>{branding.club_name}</span>
          </div>

          {[
            { label: 'Mitglieder', to: '/members' },
            { label: 'Dokumente', to: '/documents' },
            ...(isAdmin ? [{ label: 'Administration', to: '/fields' }] : []),
          ].map(item => (
            <NavLink key={item.to} to={item.to}
              style={({ isActive }) => ({
                padding: '0 16px', height: 48, display: 'flex', alignItems: 'center',
                color: branding.header_text_color, fontSize: 14, fontWeight: 500,
                borderBottom: isActive ? `3px solid ${branding.header_text_color}` : '3px solid transparent',
                opacity: isActive ? 1 : 0.85, textDecoration: 'none',
              })}>
              {item.label}
            </NavLink>
          ))}

          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 13, opacity: 0.85, color: branding.header_text_color }}>Mein Zugang</span>
            <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.3)' }} />
            <button onClick={logout}
              style={{ background: 'none', border: '1px solid rgba(255,255,255,0.4)', color: branding.header_text_color, padding: '4px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}>
              Abmelden
            </button>
            <div style={{ fontSize: 12, opacity: 0.7, color: branding.header_text_color }}>{user?.username}</div>
          </div>
        </header>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Sidebar */}
          <nav style={{ width: 220, background: branding.sidebar_bg, borderRight: '1px solid #e5e7eb', flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Scrollable area */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

              <div style={{ padding: '12px 0 4px' }}>
                <SideItem to="/search" icon="🔍" label="Suchen" />
                <SavedSearchesPanel />
              </div>

              <SideDivider />

              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px 2px' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: branding.sidebar_text_color, opacity: 0.55, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Gruppen</span>
                  <NavLink to="/members" style={{ fontSize: 11, color: branding.primary_color, textDecoration: 'none' }} title="Alle Mitglieder">Alle</NavLink>
                </div>
                <GroupTreePanel />
              </div>

              <SideDivider />

              <div style={{ padding: '4px 0' }}>
                <SideItem to="/changes" icon="📋" label="Letzte Änderungen" />
                <SideItem to="/organigramm" icon="🏢" label="Organigramm" />
                <SideItem to="/birthdays" icon="🎁" label="Geburtstage" />
                <SideItem to="/stats" icon="📊" label="Statistiken" />
              </div>

              <SideDivider />

              <div style={{ padding: '4px 0' }}>
                <SideHeading>Organisieren</SideHeading>
                {isOffice && <SideItem to="/import" icon="⬆️" label="Daten importieren" />}
                {isAdmin && <SideItem to="/fields" icon="⚙️" label="Datenfelder" />}
                {isAdmin && <SideItem to="/groups-edit" icon="📁" label="Gruppen bearbeiten" />}
                {isAdmin && <SideItem to="/users" icon="👥" label="Benutzerverwaltung" />}
                {isAdmin && <SideItem to="/roles" icon="🛡️" label="Rollenverwaltung" />}
              </div>

              <SideDivider />

              <div style={{ padding: '4px 0' }}>
                <SideHeading>E-Mail</SideHeading>
                <SideItem to="/email/templates" icon="📄" label="E-Mail Vorlagen" />
                <SideItem to="/email/history" icon="🕓" label="E-Mail Verlauf" />
                <SideItem to="/email/settings" icon="⚙️" label="E-Mail Einstellungen" />
              </div>

            </div>{/* end scrollable */}

            {/* Pinned bottom: Einstellungen */}
            <div style={{ flexShrink: 0, borderTop: `1px solid #e5e7eb`, background: branding.sidebar_bg }}>
              <div style={{ padding: '4px 0 8px' }}>
                <SideHeading>Einstellungen</SideHeading>
                <SideItem to="/settings/branding" icon="🎨" label="Erscheinungsbild" />
              </div>
            </div>

          </nav>

          {/* Main content */}
          <main style={{ flex: 1, padding: 32, background: branding.workspace_bg, overflowY: 'auto' }}>
            <Outlet />
          </main>
        </div>

      </div>
    </BrandingCtx.Provider>
  )
}
