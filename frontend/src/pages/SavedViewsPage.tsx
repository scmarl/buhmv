import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'
import { useMe } from '../hooks/useAuth'

interface SavedSearch {
  id: number
  name: string
  query_json: string
  is_shared: boolean
  owner_id: number
}

function parseConditions(queryJson: string): string {
  try {
    const conds = JSON.parse(queryJson)
    if (!Array.isArray(conds) || conds.length === 0) return 'Alle Mitglieder'
    return conds.slice(0, 3).map((c: any) => `${c.field} ${c.operator}${c.value ? ' "' + c.value + '"' : ''}`).join(' · ') + (conds.length > 3 ? ' …' : '')
  } catch { return queryJson }
}

export default function SavedViewsPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { data: me } = useMe()

  const { data: searches = [], isLoading } = useQuery<SavedSearch[]>({
    queryKey: ['saved-searches'],
    queryFn: () => api.get('/views').then(r => r.data),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(`/views/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved-searches'] }),
  })

  const toggleShareMut = useMutation({
    mutationFn: ({ id, s }: { id: number; s: SavedSearch }) =>
      api.patch ? api.patch(`/views/${id}`, { is_shared: !s.is_shared }) : api.put(`/views/${id}`, { name: s.name, query_json: s.query_json, is_shared: !s.is_shared }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved-searches'] }),
  })

  if (isLoading) return <p style={{ padding: 32, color: '#6b7280' }}>Lädt…</p>

  const mySearches = searches.filter(s => s.owner_id === me?.id)
  const sharedByOthers = searches.filter(s => s.is_shared && s.owner_id !== me?.id)

  function loadSearch(s: SavedSearch) {
    sessionStorage.setItem('loadSearch', s.query_json)
    navigate('/search')
  }

  function Card({ s, canEdit }: { s: SavedSearch; canEdit: boolean }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{s.name}</span>
            {s.is_shared && <span style={{ fontSize: 11, color: '#7c3aed', background: '#ede9fe', borderRadius: 4, padding: '2px 6px' }}>Geteilt</span>}
          </div>
          <p style={{ fontSize: 12, color: '#9ca3af', margin: '4px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {parseConditions(s.query_json)}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button
            onClick={() => loadSearch(s)}
            style={{ padding: '5px 12px', fontSize: 12, border: '1px solid #2a5298', borderRadius: 5, background: '#fff', color: '#2a5298', cursor: 'pointer', fontWeight: 500 }}>
            Laden
          </button>
          {canEdit && (
            <>
              <button
                onClick={() => toggleShareMut.mutate({ id: s.id, s })}
                title={s.is_shared ? 'Nur für mich sichtbar machen' : 'Für alle sichtbar machen'}
                style={{ padding: '5px 12px', fontSize: 12, border: `1px solid ${s.is_shared ? '#7c3aed' : '#d1d5db'}`, borderRadius: 5, background: s.is_shared ? '#ede9fe' : '#fff', color: s.is_shared ? '#7c3aed' : '#6b7280', cursor: 'pointer', fontWeight: 500 }}>
                {s.is_shared ? 'Geteilt' : 'Teilen'}
              </button>
              <button
                onClick={() => { if (confirm(`Suche "${s.name}" löschen?`)) deleteMut.mutate(s.id) }}
                style={{ padding: '5px 10px', fontSize: 12, border: '1px solid #fca5a5', borderRadius: 5, background: '#fff', color: '#dc2626', cursor: 'pointer' }}>
                ✕
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 800 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, color: '#111827' }}>Gespeicherte Suchen</h1>
      <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 28 }}>
        Gespeicherte Suchanfragen. Können privat oder für alle Benutzer geteilt werden.
      </p>

      {searches.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#9ca3af' }}>
          <p style={{ fontSize: 16 }}>Noch keine gespeicherten Suchen.</p>
          <p style={{ fontSize: 13, marginTop: 8 }}>Erstelle Suchen über den Button "Suche speichern" auf der Suchseite.</p>
          <button onClick={() => navigate('/search')} style={{ marginTop: 16, padding: '8px 20px', background: '#2a5298', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            Zur Suche
          </button>
        </div>
      ) : (
        <>
          {mySearches.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: '#374151', marginBottom: 12 }}>Meine Suchen</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {mySearches.map(s => <Card key={s.id} s={s} canEdit={true} />)}
              </div>
            </div>
          )}
          {sharedByOthers.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: '#374151', marginBottom: 12 }}>Von anderen geteilt</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {sharedByOthers.map(s => <Card key={s.id} s={s} canEdit={false} />)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
