import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'

export default function MembersPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['members', page, search],
    queryFn: () => api.get('/members', { params: { page, size: 25, search: search || undefined } }).then(r => r.data),
  })

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Mitglieder</h1>
        <button onClick={() => navigate('/members/new')} style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
          + Neu
        </button>
      </div>
      <input placeholder="Suche nach Name oder E-Mail…" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
        style={{ marginBottom: 16, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 4, width: 320 }} />
      {isLoading ? <div>Laden…</div> : (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <thead>
              <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
                {['Nr.', 'Name', 'E-Mail', 'Status', 'Beitrag'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600, color: '#374151' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data?.items.map((m: any) => (
                <tr key={m.id} onClick={() => navigate(`/members/${m.id}`)}
                  style={{ borderTop: '1px solid #f3f4f6', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}>
                  <td style={{ padding: '10px 16px', fontSize: 13, color: '#6b7280' }}>{m.member_number || '—'}</td>
                  <td style={{ padding: '10px 16px', fontWeight: 500 }}>{m.last_name}, {m.first_name}</td>
                  <td style={{ padding: '10px 16px', fontSize: 13 }}>{m.email || '—'}</td>
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
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} style={{ padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>‹</button>
            <span style={{ fontSize: 13 }}>Seite {page} · {data?.total} Einträge</span>
            <button disabled={page * 25 >= (data?.total || 0)} onClick={() => setPage(p => p + 1)} style={{ padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>›</button>
          </div>
        </>
      )}
    </div>
  )
}
