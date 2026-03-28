import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useMe } from '../hooks/useAuth'
import api from '../api/client'

interface UserRow {
  id: number
  username: string
  email: string
  role: string
  is_active: boolean
  member_id: number | null
  failed_logins: number
  is_locked: boolean
}
interface RoleDef { name: string; label: string; is_system: boolean }

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', border: '1px solid #d1d5db',
  borderRadius: 4, fontSize: 14, boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 5,
}

// ── user form modal ────────────────────────────────────────────────────────
function UserModal({
  user, roles, onClose,
}: {
  user: UserRow | null   // null = create
  roles: RoleDef[]
  onClose: () => void
}) {
  const qc = useQueryClient()
  const unlockMut = useMutation({ mutationFn: (id: number) => api.post(`/users/${id}/unlock`), onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }) })
  const isNew = user === null
  const [username, setUsername]   = useState(user?.username ?? '')
  const [email, setEmail]         = useState(user?.email ?? '')
  const [role, setRole]           = useState(user?.role ?? 'member')
  const [isActive, setIsActive]   = useState(user?.is_active ?? true)
  const [password, setPassword]   = useState('')
  const [err, setErr]             = useState('')

  const save = useMutation({
    mutationFn: () => isNew
      ? api.post('/users', { username, email, password, role, is_active: isActive }).then(r => r.data)
      : api.put(`/users/${user!.id}`, { username, email, role, is_active: isActive,
          password: password || undefined }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); onClose() },
    onError: (e: any) => setErr(e.response?.data?.detail ?? 'Fehler beim Speichern'),
  })

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 10, width: 480,
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden' }}>

        <div style={{ padding: '18px 24px', borderBottom: '1px solid #e5e7eb',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
            {isNew ? 'Neuer Benutzer' : 'Benutzer bearbeiten'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none',
            fontSize: 22, cursor: 'pointer', color: '#6b7280' }}>×</button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>Benutzername <span style={{ color: '#ef4444' }}>*</span></label>
            <input style={inputStyle} value={username} onChange={e => setUsername(e.target.value)} autoFocus />
          </div>
          <div>
            <label style={labelStyle}>E-Mail-Adresse <span style={{ color: '#ef4444' }}>*</span></label>
            <input style={inputStyle} type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>
              {isNew ? <>Passwort <span style={{ color: '#ef4444' }}>*</span></> : 'Neues Passwort (leer = unverändert)'}
            </label>
            <input style={inputStyle} type="password" value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={isNew ? '' : 'Leer lassen, um Passwort beizubehalten'} />
          </div>
          <div>
            <label style={labelStyle}>Rolle <span style={{ color: '#ef4444' }}>*</span></label>
            <select style={inputStyle} value={role} onChange={e => setRole(e.target.value)}>
              {roles.map(r => (
                <option key={r.name} value={r.name}>{r.label}</option>
              ))}
            </select>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
            <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)}
              style={{ width: 15, height: 15 }} />
            <span style={{ fontSize: 14 }}>Benutzer ist aktiv</span>
          </label>
          {err && <p style={{ margin: 0, color: '#ef4444', fontSize: 13 }}>{err}</p>}
        </div>

        <div style={{ padding: '14px 24px', borderTop: '1px solid #e5e7eb',
          display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose}
            style={{ padding: '8px 18px', background: '#f3f4f6', border: '1px solid #d1d5db',
              borderRadius: 4, cursor: 'pointer', fontSize: 14 }}>
            Abbrechen
          </button>
          <button
            onClick={() => save.mutate()}
            disabled={!username || !email || (isNew && !password) || save.isPending}
            style={{ padding: '8px 18px', background: '#2a5298', color: '#fff',
              border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14, fontWeight: 600,
              opacity: (!username || !email || (isNew && !password)) ? 0.5 : 1 }}>
            {save.isPending ? 'Speichern…' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── main page ──────────────────────────────────────────────────────────────
export default function UsersPage() {
  const qc = useQueryClient()
  const unlockMut = useMutation({ mutationFn: (id: number) => api.post(`/users/${id}/unlock`), onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }) })
  const { data: me } = useMe()
  const [selected, setSelected]   = useState<Set<number>>(new Set())
  const [editUser, setEditUser]   = useState<UserRow | 'new' | null>(null)
  const [confirmDel, setConfirmDel] = useState(false)
  const [search, setSearch]       = useState('')
  const [sortDir, setSortDir]     = useState<'asc' | 'desc'>('asc')
  const [delErr, setDelErr]       = useState('')

  const { data: users = [] } = useQuery<UserRow[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then(r => r.data),
  })

  const { data: roles = [] } = useQuery<RoleDef[]>({
    queryKey: ['roles'],
    queryFn: () => api.get('/roles').then(r => r.data),
  })

  const roleMap = useMemo(() => {
    const m: Record<string, string> = {}
    for (const r of roles) m[r.name] = r.label
    return m
  }, [roles])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    const list = users.filter(u =>
      !q || u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) ||
      (roleMap[u.role] ?? u.role).toLowerCase().includes(q)
    )
    return [...list].sort((a, b) => {
      const cmp = a.username.localeCompare(b.username, 'de')
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [users, search, sortDir, roleMap])

  const selCount = selected.size
  const allSelected = filtered.length > 0 && filtered.every(u => selected.has(u.id))
  const someSelected = selCount > 0 && !allSelected

  const toggleAll = () => {
    if (allSelected) setSelected(new Set())
    else setSelected(new Set(filtered.map(u => u.id)))
  }

  const deleteSelected = useMutation({
    mutationFn: async () => {
      for (const id of selected) {
        await api.delete(`/users/${id}`)
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      setSelected(new Set())
      setConfirmDel(false)
      setDelErr('')
    },
    onError: (e: any) => setDelErr(e.response?.data?.detail ?? 'Fehler beim Löschen'),
  })

  const selectedUsers = filtered.filter(u => selected.has(u.id))
  const singleSelected = selectedUsers.length === 1 ? selectedUsers[0] : null

  return (
    <div style={{ maxWidth: 960 }}>
      {/* page header */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ margin: '0 0 2px', fontSize: 22, fontWeight: 700 }}>Alle Benutzer</h1>
        <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
          {users.length} Benutzer{selCount > 0 ? `, ${selCount} ausgewählt` : ''}
        </p>
      </div>

      {/* action bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <button onClick={() => setEditUser('new')}
          style={{ padding: '8px 18px', background: '#16a34a', color: '#fff',
            border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
          Neuer Benutzer
        </button>
        <button
          onClick={() => singleSelected && setEditUser(singleSelected)}
          disabled={!singleSelected}
          style={{ padding: '8px 16px', background: '#fff',
            border: '1px solid #d1d5db', borderRadius: 6, cursor: singleSelected ? 'pointer' : 'not-allowed',
            fontSize: 14, color: singleSelected ? '#374151' : '#9ca3af' }}>
          Bearbeiten
        </button>
        <button
          onClick={() => { setDelErr(''); setConfirmDel(true) }}
          disabled={selCount === 0}
          style={{ padding: '8px 16px', background: '#fff',
            border: `1px solid ${selCount > 0 ? '#fca5a5' : '#e5e7eb'}`, borderRadius: 6,
            cursor: selCount > 0 ? 'pointer' : 'not-allowed', fontSize: 14,
            color: selCount > 0 ? '#dc2626' : '#9ca3af' }}>
          Löschen
        </button>
      </div>

      {/* search + sort bar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#6b7280' }}>
          Sortieren nach: Name
          <button onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
            style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 4,
              cursor: 'pointer', padding: '2px 6px', fontSize: 12 }}>
            {sortDir === 'asc' ? '↑' : '↓'}
          </button>
        </div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Liste durchsuchen …"
          style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6,
            fontSize: 13, width: 220 }} />
      </div>

      {/* table */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
        overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ width: 40, padding: '10px 12px' }}>
                <input type="checkbox" checked={allSelected}
                  ref={el => { if (el) el.indeterminate = someSelected }}
                  onChange={toggleAll} style={{ width: 14, height: 14 }} />
              </th>
              <th style={{ width: 32 }}></th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12,
                fontWeight: 700, color: '#374151', letterSpacing: '0.05em' }}>NAME</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12,
                fontWeight: 700, color: '#374151', letterSpacing: '0.05em' }}>E-MAIL</th>
              <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12,
                fontWeight: 700, color: '#374151', letterSpacing: '0.05em', width: 70 }}>ADMIN</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12,
                fontWeight: 700, color: '#374151', letterSpacing: '0.05em' }}>ROLLE</th>
              <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12,
                fontWeight: 700, color: '#374151', letterSpacing: '0.05em', width: 80 }}>AKTIV</th>
              <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12,
                fontWeight: 700, color: '#374151', letterSpacing: '0.05em', width: 100 }}>GESPERRT</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
                  {search ? 'Keine Treffer.' : 'Noch keine Benutzer angelegt.'}
                </td>
              </tr>
            )}
            {filtered.map(user => {
              const isSel = selected.has(user.id)
              const isMe  = user.id === me?.id
              return (
                <tr key={user.id}
                  onClick={() => setSelected(prev => {
                    const s = new Set(prev)
                    s.has(user.id) ? s.delete(user.id) : s.add(user.id)
                    return s
                  })}
                  style={{
                    background: isSel ? '#eff6ff' : 'transparent',
                    borderBottom: '1px solid #f3f4f6',
                    cursor: 'pointer',
                  }}>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}
                    onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={isSel}
                      onChange={() => setSelected(prev => {
                        const s = new Set(prev)
                        s.has(user.id) ? s.delete(user.id) : s.add(user.id)
                        return s
                      })}
                      style={{ width: 14, height: 14 }} />
                  </td>
                  <td style={{ padding: '10px 4px', textAlign: 'center', color: '#9ca3af', fontSize: 16 }}>
                    👤
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ fontSize: 14, fontWeight: isSel ? 600 : 400,
                      color: isSel ? '#1d4ed8' : '#111827' }}>
                      {user.username}
                    </span>
                    {isMe && (
                      <span style={{ marginLeft: 6, fontSize: 11, background: '#dbeafe',
                        color: '#1d4ed8', borderRadius: 4, padding: '1px 5px' }}>
                        Ich
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: 14, color: '#374151' }}>
                    {user.email}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 16 }}>
                    {user.role === 'admin' ? '✔' : ''}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{
                      fontSize: 12, borderRadius: 4, padding: '2px 8px',
                      background: user.role === 'admin' ? '#fef3c7' :
                                  user.role === 'office' ? '#eff6ff' :
                                  user.role === 'teamlead' ? '#f0fdf4' : '#f3f4f6',
                      color: user.role === 'admin' ? '#92400e' :
                             user.role === 'office' ? '#1e40af' :
                             user.role === 'teamlead' ? '#15803d' : '#374151',
                    }}>
                      {roleMap[user.role] ?? user.role}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 16 }}>
                    {user.is_active
                      ? <span style={{ color: '#16a34a' }}>✔</span>
                      : <span style={{ color: '#9ca3af', fontSize: 12 }}>inaktiv</span>}
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                    {user.is_locked
                      ? <button
                          onClick={() => unlockMut.mutate(user.id)}
                          title="Sperre aufheben"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: '#dc2626', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 5, padding: '3px 10px', cursor: 'pointer' }}>
                          🔒 Entsperren
                        </button>
                      : user.failed_logins > 0
                        ? <span style={{ fontSize: 12, color: '#d97706' }}>{user.failed_logins} Fehlversuch{user.failed_logins !== 1 ? 'e' : ''}</span>
                        : <span style={{ color: '#d1d5db', fontSize: 12 }}>—</span>
                    }
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* edit / create modal */}
      {editUser !== null && (
        <UserModal
          user={editUser === 'new' ? null : editUser}
          roles={roles}
          onClose={() => setEditUser(null)}
        />
      )}

      {/* delete confirm */}
      {confirmDel && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={e => { if (e.target === e.currentTarget) setConfirmDel(false) }}>
          <div style={{ background: '#fff', borderRadius: 10, width: 420, padding: 28,
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 17, fontWeight: 700 }}>Benutzer löschen</h3>
            <p style={{ margin: '0 0 6px', fontSize: 14, color: '#374151' }}>
              {selCount === 1
                ? <>Soll <strong>{selectedUsers[0]?.username}</strong> wirklich gelöscht werden?</>
                : <>Sollen <strong>{selCount} Benutzer</strong> wirklich gelöscht werden?</>}
            </p>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#6b7280' }}>
              Diese Aktion kann nicht rückgängig gemacht werden.
            </p>
            {delErr && <p style={{ margin: '0 0 12px', color: '#ef4444', fontSize: 13 }}>{delErr}</p>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmDel(false)}
                style={{ padding: '8px 18px', background: '#f3f4f6', border: '1px solid #d1d5db',
                  borderRadius: 4, cursor: 'pointer', fontSize: 14 }}>
                Abbrechen
              </button>
              <button onClick={() => deleteSelected.mutate()} disabled={deleteSelected.isPending}
                style={{ padding: '8px 18px', background: '#dc2626', color: '#fff',
                  border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                {deleteSelected.isPending ? 'Löschen…' : 'Ja, löschen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
