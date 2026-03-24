import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'

export default function MembersPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['members', page, search],
    queryFn: () => api.get('/members', { params: { page, size: 25, search: search || undefined } }).then(r => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (ids: number[]) => Promise.all(ids.map(id => api.delete(`/members/${id}`))),
    onSuccess: () => {
      setSelected(new Set())
      qc.invalidateQueries({ queryKey: ['members'] })
    },
  })

  const items: any[] = data?.items ?? []
  const allSelected = items.length > 0 && items.every(m => selected.has(m.id))

  function toggleAll() {
    if (allSelected) {
      setSelected(prev => { const s = new Set(prev); items.forEach(m => s.delete(m.id)); return s })
    } else {
      setSelected(prev => { const s = new Set(prev); items.forEach(m => s.add(m.id)); return s })
    }
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Mitglieder</h1>
        <button onClick={() => navigate('/members/new')}
          style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
          + Neu
        </button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <input
          placeholder="Suche nach Name oder E-Mail…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 4, width: 320 }}
        />
        {selected.size > 0 && (
          <button onClick={confirmDelete} disabled={deleteMutation.isPending}
            style={{ padding: '8px 16px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>
            {deleteMutation.isPending ? 'Löschen…' : `${selected.size} löschen`}
          </button>
        )}
      </div>

      {isLoading ? <div>Laden…</div> : (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <thead>
              <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
                <th style={{ padding: '10px 16px', width: 40 }}>
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                </th>
                {['Nr.', 'Name', 'E-Mail', 'Ort', 'Status', 'Beitrag'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600, color: '#374151' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((m: any) => (
                <tr key={m.id}
                  style={{ borderTop: '1px solid #f3f4f6', background: selected.has(m.id) ? '#eff6ff' : '' }}
                  onMouseEnter={e => { if (!selected.has(m.id)) e.currentTarget.style.background = '#f9fafb' }}
                  onMouseLeave={e => { e.currentTarget.style.background = selected.has(m.id) ? '#eff6ff' : '' }}>
                  <td style={{ padding: '10px 16px' }} onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(m.id)} onChange={() => toggle(m.id)} />
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: 13, color: '#6b7280' }}>{m.member_number || '—'}</td>
                  <td style={{ padding: '10px 16px', fontWeight: 500, cursor: 'pointer' }}
                    onClick={() => navigate(`/members/${m.id}`)}>
                    {m.last_name}, {m.first_name}
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: 13 }}>{m.email || '—'}</td>
                  <td style={{ padding: '10px 16px', fontSize: 13 }}>{m.city || '—'}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 12, background: m.status === 'active' ? '#dcfce7' : '#fee2e2', color: m.status === 'active' ? '#166534' : '#991b1b' }}>
                      {m.status}
                    </span>
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: 13 }}>{m.fee_status}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
              style={{ padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>‹</button>
            <span style={{ fontSize: 13 }}>Seite {page} · {data?.total} Einträge{selected.size > 0 ? ` · ${selected.size} ausgewählt` : ''}</span>
            <button disabled={page * 25 >= (data?.total || 0)} onClick={() => setPage(p => p + 1)}
              style={{ padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>›</button>
          </div>
        </>
      )}
    </div>
  )
}
