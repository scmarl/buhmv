import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'

const FIELDS = [
  { value: '', label: 'beliebiges Feld' },
  { value: 'last_name', label: 'Nachname' },
  { value: 'first_name', label: 'Vorname' },
  { value: 'email', label: 'E-Mail' },
  { value: 'city', label: 'Ort' },
  { value: 'zip_code', label: 'PLZ' },
  { value: 'member_number', label: 'Mitgliedsnr.' },
  { value: 'status', label: 'Status' },
  { value: 'fee_status', label: 'Beitragsstatus' },
]

const OPERATORS: Record<string, { value: string; label: string }[]> = {
  default: [
    { value: 'contains', label: 'enthält' },
    { value: 'eq', label: 'ist' },
    { value: 'startsWith', label: 'beginnt mit' },
    { value: 'isEmpty', label: 'ist leer' },
  ],
}

interface Condition {
  id: number
  field: string
  operator: string
  value: string
}

interface Block {
  id: number
  conditions: Condition[]
}

let nextId = 1
const makeCondition = (): Condition => ({ id: nextId++, field: '', operator: 'contains', value: '' })
const makeBlock = (): Block => ({ id: nextId++, conditions: [makeCondition()] })

export default function SearchPage() {
  const [blocks, setBlocks] = useState<Block[]>([makeBlock()])
  const [results, setResults] = useState<any[] | null>(null)
  const navigate = useNavigate()

  const search = useMutation({
    mutationFn: () => {
      const conditions = blocks.flatMap(b => b.conditions)
        .filter(c => c.value || c.operator === 'isEmpty')
        .map(c => ({ field: c.field || 'last_name', operator: c.operator, value: c.value || null }))
      return api.post('/members/search', { conditions, logic: 'AND', page: 1, size: 50 }).then(r => r.data)
    },
    onSuccess: (data) => setResults(data.items),
  })

  function reset() {
    setBlocks([makeBlock()])
    setResults(null)
  }

  function updateCondition(blockId: number, condId: number, patch: Partial<Condition>) {
    setBlocks(bs => bs.map(b => b.id !== blockId ? b : {
      ...b, conditions: b.conditions.map(c => c.id !== condId ? c : { ...c, ...patch })
    }))
  }

  function addCondition(blockId: number) {
    setBlocks(bs => bs.map(b => b.id !== blockId ? b : { ...b, conditions: [...b.conditions, makeCondition()] }))
  }

  function removeCondition(blockId: number, condId: number) {
    setBlocks(bs => bs.map(b => b.id !== blockId ? b : {
      ...b, conditions: b.conditions.filter(c => c.id !== condId)
    }).filter(b => b.conditions.length > 0))
  }

  function addBlock() {
    setBlocks(bs => [...bs, makeBlock()])
  }

  return (
    <div style={{ maxWidth: 860 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>Mitglieder suchen</h1>

      {blocks.map((block, bi) => (
        <div key={block.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: '20px 24px', marginBottom: 12 }}>
          {block.conditions.map((cond, ci) => (
            <div key={cond.id} style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: ci < block.conditions.length - 1 ? 10 : 0 }}>
              <select value={cond.field} onChange={e => updateCondition(block.id, cond.id, { field: e.target.value })}
                style={selectStyle}>
                {FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>

              <select value={cond.operator} onChange={e => updateCondition(block.id, cond.id, { operator: e.target.value })}
                style={{ ...selectStyle, width: 160 }}>
                {OPERATORS.default.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>

              {cond.operator !== 'isEmpty' && (
                <input value={cond.value} onChange={e => updateCondition(block.id, cond.id, { value: e.target.value })}
                  onKeyDown={e => e.key === 'Enter' && search.mutate()}
                  style={{ flex: 1, padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 14 }} />
              )}

              {(block.conditions.length > 1 || blocks.length > 1) && (
                <button onClick={() => removeCondition(block.id, cond.id)}
                  style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 4px' }}>×</button>
              )}
            </div>
          ))}

          <button onClick={() => addCondition(block.id)}
            style={{ marginTop: 12, background: 'none', border: 'none', color: '#2a5298', cursor: 'pointer', fontSize: 13, padding: 0 }}>
            + Weitere Bedingung
          </button>
        </div>
      ))}

      <div style={{ background: '#fff', border: '1px dashed #d1d5db', borderRadius: 6, padding: '14px 24px', marginBottom: 24, textAlign: 'center' }}>
        <button onClick={addBlock}
          style={{ background: 'none', border: 'none', color: '#2a5298', cursor: 'pointer', fontSize: 13 }}>
          + Bedingungsblock hinzufügen
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <button onClick={() => search.mutate()} disabled={search.isPending}
          style={{ padding: '9px 28px', background: '#5a8a3c', color: '#fff', border: 'none', borderRadius: 4, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
          {search.isPending ? 'Suche…' : 'Suchen'}
        </button>
        <button onClick={reset}
          style={{ background: 'none', border: 'none', color: '#2a5298', cursor: 'pointer', fontSize: 14 }}>
          Zurücksetzen
        </button>
      </div>

      {/* Ergebnisse */}
      {results !== null && (
        <div style={{ marginTop: 32 }}>
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>{results.length} Ergebnis(se)</div>
          {results.length === 0 ? (
            <div style={{ background: '#fff', padding: 24, borderRadius: 6, border: '1px solid #e5e7eb', color: '#6b7280' }}>Keine Mitglieder gefunden.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 6, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['Nr.', 'Name', 'E-Mail', 'Ort', 'Status'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600, color: '#374151', textAlign: 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((m: any) => (
                  <tr key={m.id} onClick={() => navigate(`/members/${m.id}`)}
                    style={{ borderTop: '1px solid #f3f4f6', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}>
                    <td style={{ padding: '10px 16px', fontSize: 13, color: '#6b7280' }}>{m.member_number || '—'}</td>
                    <td style={{ padding: '10px 16px', fontWeight: 500 }}>{m.last_name}, {m.first_name}</td>
                    <td style={{ padding: '10px 16px', fontSize: 13 }}>{m.email || '—'}</td>
                    <td style={{ padding: '10px 16px', fontSize: 13 }}>{m.city || '—'}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 12, background: m.status === 'active' ? '#dcfce7' : '#fee2e2', color: m.status === 'active' ? '#166534' : '#991b1b' }}>
                        {m.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

const selectStyle: React.CSSProperties = {
  padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 14,
  background: '#fff', cursor: 'pointer', width: 200,
}
