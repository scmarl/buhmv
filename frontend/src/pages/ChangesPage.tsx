import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'
import { useMe } from '../hooks/useAuth'

interface LogEntry {
  id: number
  timestamp: string   // "2026-03-25 20:15:52"
  username: string
  category: string    // members | email | auth | ...
  action: string
  target: string      // "Max Mustermann||42"  or plain text
  detail: string      // JSON for member changes, plain text for email
}

const CATEGORY_LABELS: Record<string, string> = {
  members: 'Mitglieder',
  email:   'E-Mail',
  auth:    'Anmeldung',
  fields:  'Datenfelder',
  users:   'Benutzer',
  import:  'Import',
  export:  'Export',
}

const CATEGORY_COLORS: Record<string, string> = {
  members: '#16a34a',
  email:   '#2a5298',
  auth:    '#9ca3af',
  fields:  '#7c3aed',
  users:   '#0891b2',
  import:  '#d97706',
  export:  '#d97706',
}

function parseMemberTarget(target: string): { name: string; id: number | null } {
  const parts = target.split('||')
  return { name: parts[0] || target, id: parts[1] ? Number(parts[1]) : null }
}

function formatDetail(action: string, target: string, detail: string): React.ReactNode {
  const { name, id } = parseMemberTarget(target)

  const memberLink = (
    <a href={`/members/${id}`}
      style={{ color:'#2a5298', textDecoration:'none', fontWeight:600,
        background:'#eff4ff', borderRadius:3, padding:'0 4px', fontSize:12 }}>
      👤 {name}
    </a>
  )

  // Member field change (detail is JSON)
  if (action === 'Feld geaendert' && detail.startsWith('{')) {
    try {
      const d = JSON.parse(detail)
      const field = <span style={{ fontWeight:600 }}>{d.field}</span>
      const newVal = <span style={{ background:'#dcfce7', borderRadius:3, padding:'0 5px', fontWeight:600, fontSize:12 }}>{d.new || '<leer>'}</span>
      const oldVal = d.old ? <span style={{ background:'#fee2e2', borderRadius:3, padding:'0 5px', fontWeight:600, fontSize:12 }}>{d.old}</span> : null

      if (!d.old) {
        return <span>{field} bei {memberLink} auf {newVal} gesetzt</span>
      }
      if (!d.new) {
        return <span>{field} bei {memberLink} von {oldVal} auf <span style={{ background:'#f3f4f6', borderRadius:3, padding:'0 5px', fontSize:12, color:'#6b7280' }}>&lt;leer&gt;</span> geändert</span>
      }
      return <span>{field} bei {memberLink} von {oldVal} auf {newVal} geändert</span>
    } catch { /* fall through */ }
  }

  // Group add/remove
  if ((action === 'Gruppe hinzugefuegt' || action === 'Gruppe entfernt') && detail.startsWith('{')) {
    try {
      const d = JSON.parse(detail)
      const verb = action === 'Gruppe hinzugefuegt' ? 'zur Gruppe' : 'aus Gruppe'
      const dir  = action === 'Gruppe hinzugefuegt' ? 'hinzugefügt' : 'entfernt'
      return <span>{memberLink} {verb} <span style={{ background:'#fef9c3', borderRadius:3, padding:'0 5px', fontWeight:600, fontSize:12 }}>📁 {d.group}</span> {dir}</span>
    } catch { /* fall through */ }
  }

  // Member created / deleted
  if (action === 'Mitglied erstellt') {
    return <span>Mitglied {memberLink} erstellt</span>
  }
  if (action === 'Mitglied geloescht') {
    return <span style={{ color:'#dc2626' }}>Mitglied <b>{name}</b> gelöscht</span>
  }

  // Email / generic
  return <span>{action}{target ? ` – ${target}` : ''}{detail ? `: ${detail}` : ''}</span>
}

function groupByDate(entries: LogEntry[]): { dateKey: string; label: string; items: LogEntry[] }[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)

  const map = new Map<string, LogEntry[]>()
  for (const e of entries) {
    const dateKey = e.timestamp.slice(0, 10)
    if (!map.has(dateKey)) map.set(dateKey, [])
    map.get(dateKey)!.push(e)
  }

  return Array.from(map.entries()).map(([dateKey, items]) => {
    const d = new Date(dateKey + 'T00:00:00')
    const weekday = d.toLocaleDateString('de-DE', { weekday: 'long' })
    const dateStr = d.toLocaleDateString('de-DE', { day:'2-digit', month:'2-digit', year:'numeric' })
    let suffix = ''
    if (d.getTime() === today.getTime())     suffix = ' – Heute'
    if (d.getTime() === yesterday.getTime()) suffix = ' – Gestern'
    return { dateKey, label: `${weekday} ${dateStr}${suffix}`, items }
  })
}

export default function ChangesPage() {
  const { data: me } = useMe()
  const isAdmin = me?.role === 'admin'
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [category, setCategory] = useState('')

  const { data: logs = [], isLoading, refetch } = useQuery<LogEntry[]>({
    queryKey: ['audit-logs', category],
    queryFn: () => api.get('/audit-logs', { params: { days: 10, ...(category ? { category } : {}) } }).then(r => r.data),
  })

  async function handleClear() {
    if (!window.confirm('Alle Protokolleinträge unwiderruflich löschen?')) return
    await api.delete('/audit-logs')
    qc.invalidateQueries({ queryKey: ['audit-logs'] })
  }

  const groups = groupByDate(logs)

  return (
    <div style={{ maxWidth: 820 }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <h1 style={{ fontSize:22, fontWeight:700, margin:0 }}>Letzte Änderungen</h1>
      </div>

      {/* Controls */}
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:28, flexWrap:'wrap' }}>
        <select value={category} onChange={e => setCategory(e.target.value)}
          style={{ padding:'7px 12px', border:'2px solid #2a5298', borderRadius:6, fontSize:13, color:'#2a5298', fontWeight:600, background:'#fff', cursor:'pointer' }}>
          <option value="">Alle Änderungen anzeigen</option>
          {Object.entries(CATEGORY_LABELS).map(([k,v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <button onClick={() => refetch()}
          style={{ padding:'7px 14px', border:'1px solid #d1d5db', borderRadius:5, background:'#fff', fontSize:13, cursor:'pointer', color:'#374151', display:'flex', alignItems:'center', gap:5 }}>
          ↻ aktualisieren
        </button>

        {isAdmin && (
          <button onClick={handleClear}
            style={{ padding:'7px 14px', border:'1px solid #d1d5db', borderRadius:5, background:'#fff', fontSize:13, cursor:'pointer', color:'#374151' }}>
            Daten vollständig löschen
          </button>
        )}
      </div>

      {isLoading && (
        <div style={{ color:'#9ca3af', fontSize:14, padding:'40px 0', textAlign:'center' }}>Laden…</div>
      )}

      {!isLoading && logs.length === 0 && (
        <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:8, padding:'48px 24px', textAlign:'center', color:'#9ca3af' }}>
          <div style={{ fontSize:32, marginBottom:10 }}>📋</div>
          <div style={{ fontSize:15, fontWeight:600, color:'#374151', marginBottom:4 }}>Keine Einträge</div>
          <div style={{ fontSize:13 }}>In den letzten 10 Tagen wurden keine Änderungen protokolliert.</div>
        </div>
      )}

      {/* Timeline */}
      {groups.map(({ dateKey, label, items }) => (
        <div key={dateKey} style={{ marginBottom:32 }}>
          {/* Date header */}
          <div style={{ display:'inline-block', padding:'4px 16px', border:'2px solid #16a34a', borderRadius:20,
            fontSize:13, fontWeight:700, color:'#15803d', marginBottom:16 }}>
            {label}
          </div>

          {/* Entries */}
          <div style={{ position:'relative', paddingLeft:32 }}>
            {/* Vertical line */}
            <div style={{ position:'absolute', left:10, top:0, bottom:0, width:2, background:'#d1fae5' }}/>

            {items.map(entry => {
              const dotColor = CATEGORY_COLORS[entry.category] || '#9ca3af'
              const time = entry.timestamp.slice(11, 16)
              return (
                <div key={entry.id} style={{ position:'relative', marginBottom:20 }}>
                  {/* Dot */}
                  <div style={{ position:'absolute', left:-26, top:4, width:10, height:10,
                    borderRadius:'50%', background:dotColor, border:'2px solid #fff',
                    boxShadow:`0 0 0 2px ${dotColor}` }}/>

                  <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                    {/* Time */}
                    <span style={{ fontSize:12, color:'#9ca3af', minWidth:36, flexShrink:0, lineHeight:'1.6' }}>
                      {time}
                    </span>

                    <div>
                      {/* Username */}
                      <div style={{ fontSize:12, color:'#6b7280', marginBottom:2 }}>
                        {entry.username}
                      </div>
                      {/* Description */}
                      <div style={{ fontSize:14, color:'#111827', lineHeight:1.5 }}>
                        {formatDetail(entry.action, entry.target, entry.detail)}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
