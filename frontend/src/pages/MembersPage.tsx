import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../api/client'

interface GroupNode {
  id: number
  name: string
  member_count: number
  children: GroupNode[]
}

function findGroupName(nodes: GroupNode[], id: number): string | null {
  for (const n of nodes) {
    if (n.id === id) return n.name
    const found = findGroupName(n.children, id)
    if (found) return found
  }
  return null
}

export default function MembersPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const qc = useQueryClient()

  const groupId = searchParams.get('group') ? Number(searchParams.get('group')) : null

  // Reset page when group/search changes
  useEffect(() => { setPage(1); setSelected(new Set()) }, [groupId, search])

  const { data, isLoading } = useQuery({
    queryKey: ['members', page, search, groupId],
    queryFn: () => api.get('/members', {
      params: {
        page, size: 25,
        search: search || undefined,
        group_id: groupId ?? undefined,
        active_only: false,
      }
    }).then(r => r.data),
  })

  const { data: groupsTree = [] } = useQuery<GroupNode[]>({
    queryKey: ['groups-tree'],
    queryFn: () => api.get('/groups', { params: { tree: true } }).then(r => r.data),
    staleTime: 30_000,
  })

  const groupName = groupId ? findGroupName(groupsTree, groupId) : null

  const deleteMutation = useMutation({
    mutationFn: (ids: number[]) => Promise.all(ids.map(id => api.delete(`/members/${id}`))),
    onSuccess: () => { setSelected(new Set()); qc.invalidateQueries({ queryKey: ['members'] }) },
  })

  const items: any[] = data?.items ?? []
  const allSelected = items.length > 0 && items.every(m => selected.has(m.id))

  function toggleAll() {
    if (allSelected) setSelected(prev => { const s = new Set(prev); items.forEach(m => s.delete(m.id)); return s })
    else setSelected(prev => { const s = new Set(prev); items.forEach(m => s.add(m.id)); return s })
  }

  function toggle(id: number) {
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }

  function confirmDelete() {
    if (selected.size === 0) return
    if (window.confirm(`${selected.size} Mitglied(er) wirklich löschen?`)) {
      deleteMutation.mutate(Array.from(selected))
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
            {groupName ?? 'Alle Mitglieder'}
          </h1>
          {groupName && (
            <button onClick={() => navigate('/members')}
              style={{ marginTop: 4, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#6b7280', padding: 0 }}>
              ← Alle anzeigen
            </button>
          )}
        </div>
        <button onClick={() => navigate('/members/new')}
          style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
          + Neu
        </button>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center' }}>
        <input
          placeholder="Suche nach Name oder E-Mail…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: '7px 12px', border: '1px solid #d1d5db', borderRadius: 6, width: 300, fontSize: 13 }}
        />
        {selected.size > 0 && (
          <button onClick={confirmDelete} disabled={deleteMutation.isPending}
            style={{ padding: '7px 16px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
            {deleteMutation.isPending ? 'Löschen…' : `${selected.size} löschen`}
          </button>
        )}
        {data && (
          <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 'auto' }}>
            {data.total} Einträge{selected.size > 0 ? ` · ${selected.size} ausgewählt` : ''}
          </span>
        )}
      </div>

      {isLoading ? (
        <div style={{ color: '#6b7280', padding: 32, textAlign: 'center' }}>Laden…</div>
      ) : items.length === 0 ? (
        <div style={{ color: '#9ca3af', padding: 48, textAlign: 'center', background: '#fff', borderRadius: 8 }}>
          {groupName ? `Keine Mitglieder in „${groupName}"` : 'Keine Mitglieder gefunden'}
        </div>
      ) : (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <thead>
              <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
                <th style={{ padding: '10px 14px', width: 36 }}>
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                </th>
                {['Nr.', 'Name', 'E-Mail', 'Ort', 'Eingetreten'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((m: any) => (
                <tr key={m.id}
                  style={{ borderTop: '1px solid #f3f4f6', background: selected.has(m.id) ? '#eff6ff' : '' }}
                  onMouseEnter={e => { if (!selected.has(m.id)) e.currentTarget.style.background = '#f9fafb' }}
                  onMouseLeave={e => { e.currentTarget.style.background = selected.has(m.id) ? '#eff6ff' : '' }}>
                  <td style={{ padding: '9px 14px' }} onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(m.id)} onChange={() => toggle(m.id)} />
                  </td>
                  <td style={{ padding: '9px 14px', fontSize: 12, color: '#9ca3af' }}>{m.member_number || '—'}</td>
                  <td style={{ padding: '9px 14px', fontWeight: 500, cursor: 'pointer', color: '#111827' }}
                    onClick={() => navigate(`/members/${m.id}`)}>
                    {m.last_name}, {m.first_name}
                  </td>
                  <td style={{ padding: '9px 14px', fontSize: 13, color: '#374151' }}>{m.email || '—'}</td>
                  <td style={{ padding: '9px 14px', fontSize: 13, color: '#374151' }}>{m.city || '—'}</td>
                  <td style={{ padding: '9px 14px', fontSize: 13, color: '#374151' }}>
                    {m.entry_date ? new Date(m.entry_date).toLocaleDateString('de-DE', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          <div style={{ marginTop: 14, display: 'flex', gap: 8, alignItems: 'center' }}>
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
              style={{ padding: '5px 12px', border: '1px solid #d1d5db', borderRadius: 5, cursor: 'pointer', background: '#fff' }}>‹</button>
            <span style={{ fontSize: 13, color: '#6b7280' }}>Seite {page} von {Math.ceil((data?.total || 0) / 25)}</span>
            <button disabled={page * 25 >= (data?.total || 0)} onClick={() => setPage(p => p + 1)}
              style={{ padding: '5px 12px', border: '1px solid #d1d5db', borderRadius: 5, cursor: 'pointer', background: '#fff' }}>›</button>
          </div>
        </>
      )}
    </div>
  )
}
