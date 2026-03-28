import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../api/client'

// ── types ──────────────────────────────────────────────────────────────────
interface RoleDef  { name: string; label: string; description: string; is_system: boolean }
interface GroupNode { id: number; name: string; children: GroupNode[] }
interface GroupPerm { group_id: number; can_read: boolean; can_write: boolean }
interface CatPerm   { category: string; can_view: boolean; can_edit: boolean }
interface RolePerms { role: string; group_permissions: GroupPerm[]; field_category_permissions: CatPerm[] }

const SYSTEM_ROLE_ICONS: Record<string, string> = {
  admin: '👑', office: '🏢', teamlead: '👤', member: '🙋',
}

const FIELD_CATEGORIES = [
  { key: 'Mitgliederdaten', label: 'Mitgliederdaten',
    desc: 'Stammdaten, Kontakt, Mitgliedschaft und Notizen' },
  { key: 'Kontodaten', label: 'Kontodaten',
    desc: 'Bankverbindung und SEPA-Mandate' },
]

// ── helpers ────────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', border: '1px solid #d1d5db',
  borderRadius: 4, fontSize: 14, boxSizing: 'border-box',
}

function AccessLabel({ cv, ce }: { cv: boolean; ce: boolean }) {
  if (ce) return <span style={{ color: '#16a34a', fontWeight: 500, fontSize: 13 }}>Lesen & Schreiben</span>
  if (cv) return <span style={{ color: '#2563eb', fontWeight: 500, fontSize: 13 }}>Lesen</span>
  return <span style={{ color: '#9ca3af', fontSize: 13 }}>Kein Zugriff</span>
}

// ── recursive group tree ───────────────────────────────────────────────────
function GroupTree({
  nodes, perms, onChange, depth = 0,
}: {
  nodes: GroupNode[]
  perms: Map<number, GroupPerm>
  onChange: (id: number, field: 'can_read' | 'can_write', val: boolean) => void
  depth?: number
}) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set(nodes.map(n => n.id)))
  if (!nodes.length) return null
  return (
    <>
      {nodes.map(node => {
        const p = perms.get(node.id) ?? { group_id: node.id, can_read: false, can_write: false }
        const isOpen = expanded.has(node.id)
        return (
          <div key={node.id}>
            <div style={{
              display: 'flex', alignItems: 'center', padding: '7px 8px',
              paddingLeft: 8 + depth * 22, borderBottom: '1px solid #f3f4f6',
            }}>
              <span
                style={{ width: 18, cursor: node.children.length ? 'pointer' : 'default',
                  color: '#6b7280', fontSize: 10, userSelect: 'none', flexShrink: 0 }}
                onClick={() => {
                  if (!node.children.length) return
                  setExpanded(prev => { const s = new Set(prev); s.has(node.id) ? s.delete(node.id) : s.add(node.id); return s })
                }}>
                {node.children.length ? (isOpen ? '▼' : '▶') : ''}
              </span>
              <span style={{ flex: 1, fontSize: 13,
                color: p.can_read ? '#1d4ed8' : '#374151', fontWeight: p.can_read ? 500 : 400 }}>
                📁 {node.name}
              </span>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13,
                width: 80, cursor: 'pointer', userSelect: 'none', justifyContent: 'center' }}>
                <input type="checkbox" checked={p.can_read}
                  onChange={e => { onChange(node.id, 'can_read', e.target.checked); if (!e.target.checked) onChange(node.id, 'can_write', false) }} />
                Lesen
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13,
                width: 140, cursor: 'pointer', userSelect: 'none', justifyContent: 'center' }}>
                <input type="checkbox" checked={p.can_write}
                  onChange={e => { onChange(node.id, 'can_write', e.target.checked); if (e.target.checked) onChange(node.id, 'can_read', true) }} />
                Lesen & Schreiben
              </label>
            </div>
            {isOpen && node.children.length > 0 && (
              <GroupTree nodes={node.children} perms={perms} onChange={onChange} depth={depth + 1} />
            )}
          </div>
        )
      })}
    </>
  )
}

// ── role editor modal ──────────────────────────────────────────────────────
function RoleEditor({
  roleDef, initial, groups, onClose,
}: {
  roleDef: RoleDef
  initial: RolePerms
  groups: GroupNode[]
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [groupPerms, setGroupPerms] = useState<Map<number, GroupPerm>>(() => {
    const m = new Map<number, GroupPerm>()
    for (const gp of initial.group_permissions) m.set(gp.group_id, gp)
    return m
  })
  const [catPerms, setCatPerms] = useState<Map<string, CatPerm>>(() => {
    const m = new Map<string, CatPerm>()
    for (const cp of initial.field_category_permissions) m.set(cp.category, cp)
    return m
  })
  const [label, setLabel] = useState(roleDef.label)

  const savePerms = useMutation({
    mutationFn: () => api.put(`/role-permissions/${roleDef.name}`, {
      group_permissions: Array.from(groupPerms.values()),
      field_category_permissions: Array.from(catPerms.values()),
    }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['role-perms'] }),
  })
  const saveLabel = useMutation({
    mutationFn: () => api.put(`/roles/${roleDef.name}`, { label, description: roleDef.description }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles'] }),
  })

  const handleSave = async () => {
    if (label !== roleDef.label) await saveLabel.mutateAsync()
    await savePerms.mutateAsync()
    onClose()
  }

  const isAdmin = roleDef.name === 'admin'
  const isSaving = savePerms.isPending || saveLabel.isPending

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      zIndex: 1000, overflowY: 'auto', padding: '48px 16px' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 10, width: '100%', maxWidth: 680,
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden' }}>

        {/* header */}
        <div style={{ padding: '20px 28px', borderBottom: '1px solid #e5e7eb',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
            Die Rolle <em>{roleDef.label}</em> bearbeiten
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none',
            fontSize: 22, cursor: 'pointer', color: '#6b7280' }}>×</button>
        </div>

        <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* label field (editable for non-system or any custom role) */}
          {!isAdmin && (
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Name</label>
              <input style={inputStyle} value={label} onChange={e => setLabel(e.target.value)} />
            </div>
          )}

          {isAdmin ? (
            <div style={{ padding: 18, background: '#f0fdf4', borderRadius: 8,
              border: '1px solid #bbf7d0', color: '#15803d', fontSize: 14 }}>
              ✓ Administratoren haben immer vollständigen Zugriff. Diese Einstellungen sind gesperrt.
            </div>
          ) : (
            <>
              {/* group permissions */}
              <section>
                <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700 }}>Rechte auf Mitgliedergruppen</h3>
                <p style={{ margin: '0 0 10px', fontSize: 12, color: '#6b7280' }}>
                  Legen Sie fest, auf welche Gruppen diese Rolle Zugriff hat.
                </p>
                {groups.length === 0
                  ? <p style={{ color: '#9ca3af', fontSize: 13 }}>Keine Gruppen vorhanden.</p>
                  : (
                    <div style={{ border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'hidden' }}>
                      <div style={{ display: 'flex', padding: '6px 8px 6px 26px', background: '#f9fafb',
                        borderBottom: '1px solid #e5e7eb', fontSize: 12, color: '#6b7280', fontWeight: 600 }}>
                        <span style={{ flex: 1 }}>Gruppe</span>
                        <span style={{ width: 80, textAlign: 'center' }}>Lesen</span>
                        <span style={{ width: 140, textAlign: 'center' }}>Lesen & Schreiben</span>
                      </div>
                      <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                        <GroupTree nodes={groups} perms={groupPerms} onChange={(id, field, val) => {
                          setGroupPerms(prev => {
                            const m = new Map(prev)
                            const ex = m.get(id) ?? { group_id: id, can_read: false, can_write: false }
                            m.set(id, { ...ex, [field]: val })
                            return m
                          })
                        }} />
                      </div>
                    </div>
                  )}
              </section>

              {/* field category permissions */}
              <section>
                <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700 }}>Rechte auf Datenfelder</h3>
                <p style={{ margin: '0 0 10px', fontSize: 12, color: '#6b7280' }}>
                  Klicken Sie auf „ändern", um zwischen Kein Zugriff → Lesen → Lesen & Schreiben zu wechseln.
                </p>
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'hidden' }}>
                  {FIELD_CATEGORIES.map((fc, i) => {
                    const cp = catPerms.get(fc.key) ?? { category: fc.key, can_view: false, can_edit: false }
                    return (
                      <div key={fc.key} style={{ display: 'flex', alignItems: 'center',
                        padding: '12px 16px', gap: 12,
                        borderBottom: i < FIELD_CATEGORIES.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                        <span style={{ fontSize: 18 }}>🪪</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 500 }}>{fc.label}</div>
                          <div style={{ fontSize: 12, color: '#9ca3af' }}>{fc.desc}</div>
                        </div>
                        <AccessLabel cv={cp.can_view} ce={cp.can_edit} />
                        <button
                          onClick={() => setCatPerms(prev => {
                            const m = new Map(prev)
                            const cur = m.get(fc.key) ?? { category: fc.key, can_view: false, can_edit: false }
                            let next: CatPerm
                            if (!cur.can_view)       next = { category: fc.key, can_view: true,  can_edit: false }
                            else if (!cur.can_edit)  next = { category: fc.key, can_view: true,  can_edit: true  }
                            else                     next = { category: fc.key, can_view: false, can_edit: false }
                            m.set(fc.key, next)
                            return m
                          })}
                          style={{ padding: '4px 12px', border: '1px solid #d1d5db', borderRadius: 4,
                            cursor: 'pointer', fontSize: 12, background: '#f9fafb' }}>
                          ändern
                        </button>
                      </div>
                    )
                  })}
                </div>
              </section>
            </>
          )}
        </div>

        {!isAdmin && (
          <div style={{ padding: '16px 28px', borderTop: '1px solid #e5e7eb',
            display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button onClick={onClose}
              style={{ padding: '8px 20px', background: '#f3f4f6', border: '1px solid #d1d5db',
                borderRadius: 4, cursor: 'pointer', fontSize: 14 }}>
              Abbrechen
            </button>
            <button onClick={handleSave} disabled={isSaving}
              style={{ padding: '8px 20px', background: '#2a5298', color: '#fff',
                border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
              {isSaving ? 'Speichern…' : 'Speichern'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── new role modal ─────────────────────────────────────────────────────────
function NewRoleModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName]   = useState('')
  const [label, setLabel] = useState('')
  const [desc, setDesc]   = useState('')
  const [err, setErr]     = useState('')

  const create = useMutation({
    mutationFn: () => api.post('/roles', { name, label, description: desc }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles'] })
      qc.invalidateQueries({ queryKey: ['role-perms'] })
      onClose()
    },
    onError: (e: any) => setErr(e.response?.data?.detail ?? 'Fehler beim Erstellen'),
  })

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 10, width: 460,
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #e5e7eb',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Neue Rolle erstellen</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none',
            fontSize: 22, cursor: 'pointer', color: '#6b7280' }}>×</button>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 5 }}>
              Technischer Name <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input style={inputStyle} value={name} onChange={e => setName(e.target.value)}
              placeholder="z.B. bulletin (Kleinbuchstaben, keine Leerzeichen)" />
            <p style={{ margin: '4px 0 0', fontSize: 11, color: '#9ca3af' }}>
              Nur Buchstaben, Zahlen und Unterstriche. Kann nicht nachträglich geändert werden.
            </p>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 5 }}>
              Anzeigename <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input style={inputStyle} value={label} onChange={e => setLabel(e.target.value)}
              placeholder="z.B. Bulletin-Redaktion" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 5 }}>
              Beschreibung
            </label>
            <input style={inputStyle} value={desc} onChange={e => setDesc(e.target.value)}
              placeholder="Kurze Beschreibung der Rolle (optional)" />
          </div>
          {err && <p style={{ margin: 0, color: '#ef4444', fontSize: 13 }}>{err}</p>}
        </div>
        <div style={{ padding: '14px 24px', borderTop: '1px solid #e5e7eb',
          display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose}
            style={{ padding: '8px 18px', background: '#f3f4f6', border: '1px solid #d1d5db',
              borderRadius: 4, cursor: 'pointer', fontSize: 14 }}>
            Abbrechen
          </button>
          <button onClick={() => create.mutate()} disabled={!name || !label || create.isPending}
            style={{ padding: '8px 18px', background: '#2a5298', color: '#fff',
              border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14, fontWeight: 600,
              opacity: (!name || !label) ? 0.5 : 1 }}>
            {create.isPending ? 'Erstellen…' : 'Erstellen'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── main page ──────────────────────────────────────────────────────────────
export default function RolesPage() {
  const [editing, setEditing]     = useState<string | null>(null)
  const [creating, setCreating]   = useState(false)
  const [confirmDel, setConfirmDel] = useState<string | null>(null)
  const qc = useQueryClient()

  const { data: roles = [] } = useQuery<RoleDef[]>({
    queryKey: ['roles'],
    queryFn: () => api.get('/roles').then(r => r.data),
  })

  const { data: allPerms = {} } = useQuery<Record<string, RolePerms>>({
    queryKey: ['role-perms'],
    queryFn: () => api.get('/role-permissions').then(r => r.data),
  })

  const { data: groups = [] } = useQuery<GroupNode[]>({
    queryKey: ['groups-tree'],
    queryFn: () => api.get('/groups?tree=true').then(r => r.data),
  })

  const deleteRole = useMutation({
    mutationFn: (name: string) => api.delete(`/roles/${name}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles'] })
      qc.invalidateQueries({ queryKey: ['role-perms'] })
      setConfirmDel(null)
    },
    onError: (e: any) => alert(e.response?.data?.detail ?? 'Fehler beim Löschen'),
  })

  const editingRole = roles.find(r => r.name === editing)

  return (
    <div style={{ maxWidth: 820 }}>
      {/* page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700 }}>Rollenverwaltung</h1>
          <p style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>
            Gruppen- und Feldzugriffe pro Rolle konfigurieren. Eigene Rollen erstellen oder löschen.
          </p>
        </div>
        <button onClick={() => setCreating(true)}
          style={{ padding: '9px 18px', background: '#16a34a', color: '#fff',
            border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14,
            fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}>
          + Neue Rolle
        </button>
      </div>

      {/* role cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {roles.map(role => {
          const perms    = allPerms[role.name]
          const grpCount = perms?.group_permissions.filter(g => g.can_read).length ?? 0
          const isAdmin  = role.name === 'admin'
          const icon     = SYSTEM_ROLE_ICONS[role.name] ?? '🔑'

          return (
            <div key={role.name}
              style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
                padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14,
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>

              <div style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                background: isAdmin ? '#fef3c7' : role.is_system ? '#eff6ff' : '#f0fdf4',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                {icon}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{role.label}</span>
                  <span style={{ fontSize: 11, color: '#9ca3af',
                    background: '#f3f4f6', borderRadius: 4, padding: '1px 6px' }}>
                    {role.name}
                  </span>
                  {!role.is_system && (
                    <span style={{ fontSize: 11, color: '#15803d',
                      background: '#dcfce7', borderRadius: 4, padding: '1px 6px' }}>
                      benutzerdefiniert
                    </span>
                  )}
                </div>
                {role.description && (
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{role.description}</div>
                )}
                {!isAdmin && perms && (
                  <div style={{ display: 'flex', gap: 14, marginTop: 5, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: '#374151' }}>
                      📁 {grpCount === 0 ? 'Keine Gruppen' : `${grpCount} Gruppe(n)`}
                    </span>
                    {FIELD_CATEGORIES.map(fc => {
                      const cp = perms.field_category_permissions.find(c => c.category === fc.key)
                      return (
                        <span key={fc.key} style={{ fontSize: 12, color: '#374151' }}>
                          🪪 {fc.label}: {cp?.can_edit ? 'Schreiben' : cp?.can_view ? 'Lesen' : 'Kein Zugriff'}
                        </span>
                      )
                    })}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button onClick={() => setEditing(role.name)}
                  style={{ padding: '6px 16px',
                    background: isAdmin ? '#f3f4f6' : '#eff6ff',
                    color: isAdmin ? '#9ca3af' : '#2a5298',
                    border: `1px solid ${isAdmin ? '#e5e7eb' : '#bfdbfe'}`,
                    borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
                  {isAdmin ? 'Ansehen' : 'Bearbeiten'}
                </button>
                {!role.is_system && (
                  <button onClick={() => setConfirmDel(role.name)}
                    style={{ padding: '6px 14px', background: '#fff',
                      color: '#dc2626', border: '1px solid #fca5a5',
                      borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
                    Löschen
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* editor modal */}
      {editing && editingRole && allPerms[editing] && (
        <RoleEditor
          roleDef={editingRole}
          initial={allPerms[editing]}
          groups={groups}
          onClose={() => setEditing(null)}
        />
      )}

      {/* create modal */}
      {creating && <NewRoleModal onClose={() => setCreating(false)} />}

      {/* delete confirm */}
      {confirmDel && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}
          onClick={e => { if (e.target === e.currentTarget) setConfirmDel(null) }}>
          <div style={{ background: '#fff', borderRadius: 10, width: 400, padding: 28,
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 17, fontWeight: 700 }}>Rolle löschen</h3>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: '#374151' }}>
              Soll die Rolle <strong>{roles.find(r => r.name === confirmDel)?.label}</strong> wirklich
              gelöscht werden? Alle zugehörigen Berechtigungen werden entfernt.
              Benutzer mit dieser Rolle müssen zuvor neu zugewiesen werden.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmDel(null)}
                style={{ padding: '8px 18px', background: '#f3f4f6', border: '1px solid #d1d5db',
                  borderRadius: 4, cursor: 'pointer', fontSize: 14 }}>
                Abbrechen
              </button>
              <button onClick={() => deleteRole.mutate(confirmDel!)} disabled={deleteRole.isPending}
                style={{ padding: '8px 18px', background: '#dc2626', color: '#fff',
                  border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                {deleteRole.isPending ? 'Löschen…' : 'Ja, löschen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
