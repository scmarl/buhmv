import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useRef, useEffect } from 'react'
import api from '../api/client'

interface GroupNode {
  id: number
  name: string
  description?: string
  parent_id: number | null
  sort_order: number
  member_count: number
  children: GroupNode[]
}

interface Dialog {
  mode: 'create' | 'rename'
  parent_id: number | null
  group_id?: number
  current_name?: string
}

export default function GroupsEditPage() {
  const qc = useQueryClient()
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [inputVal, setInputVal] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const { data: tree = [], isLoading } = useQuery<GroupNode[]>({
    queryKey: ['groups-tree'],
    queryFn: () => api.get('/groups', { params: { tree: true } }).then(r => r.data),
  })

  const createGroup = useMutation({
    mutationFn: (data: { name: string; parent_id: number | null }) =>
      api.post('/groups', { ...data, sort_order: 0 }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['groups-tree'] }); setDialog(null) },
  })

  const renameGroup = useMutation({
    mutationFn: ({ id, name, parent_id }: { id: number; name: string; parent_id: number | null }) =>
      api.put(`/groups/${id}`, { name, parent_id, sort_order: 0 }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['groups-tree'] }); setDialog(null) },
  })

  const deleteGroup = useMutation({
    mutationFn: (id: number) => api.delete(`/groups/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups-tree'] }),
  })

  function openDialog(d: Dialog) {
    setInputVal(d.current_name ?? '')
    setDialog(d)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function submitDialog() {
    if (!inputVal.trim() || !dialog) return
    if (dialog.mode === 'create') {
      createGroup.mutate({ name: inputVal.trim(), parent_id: dialog.parent_id })
    } else if (dialog.mode === 'rename' && dialog.group_id !== undefined) {
      renameGroup.mutate({ id: dialog.group_id, name: inputVal.trim(), parent_id: dialog.parent_id ?? null })
    }
  }

  const isPending = createGroup.isPending || renameGroup.isPending

  return (
    <div style={{ maxWidth: 800 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>Mitgliedergruppen bearbeiten</h1>

      <button onClick={() => openDialog({ mode: 'create', parent_id: null })}
        style={{ padding: '8px 20px', background: '#5a8a3c', color: '#fff', border: 'none', borderRadius: 4, fontWeight: 600, fontSize: 14, cursor: 'pointer', marginBottom: 24 }}>
        + Neue Mitgliedergruppe
      </button>

      {isLoading ? <div>Laden…</div> : (
        <div>
          {tree.map(node => (
            <GroupRow key={node.id} node={node} depth={0}
              onCreate={(parent_id) => openDialog({ mode: 'create', parent_id })}
              onRename={(id, name, parent_id) => openDialog({ mode: 'rename', group_id: id, current_name: name, parent_id })}
              onDelete={(id) => { if (window.confirm('Gruppe wirklich löschen?')) deleteGroup.mutate(id) }}
            />
          ))}
          {tree.length === 0 && (
            <div style={{ color: '#9ca3af', fontSize: 14, padding: 24, textAlign: 'center', background: '#fff', borderRadius: 6, border: '1px solid #e5e7eb' }}>
              Noch keine Gruppen vorhanden.
            </div>
          )}
        </div>
      )}

      {/* Dialog */}
      {dialog && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={(e) => { if (e.target === e.currentTarget) setDialog(null) }}>
          <div style={{ background: '#fff', borderRadius: 8, padding: 28, width: 380, boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
              {dialog.mode === 'create' ? (dialog.parent_id ? 'Neue Untergruppe' : 'Neue Mitgliedergruppe') : 'Gruppe umbenennen'}
            </h2>
            <input
              ref={inputRef}
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submitDialog(); if (e.key === 'Escape') setDialog(null) }}
              placeholder="Gruppenname"
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 14, marginBottom: 20 }}
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setDialog(null)}
                style={{ padding: '7px 18px', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer', fontSize: 14 }}>
                Abbrechen
              </button>
              <button onClick={submitDialog} disabled={!inputVal.trim() || isPending}
                style={{ padding: '7px 18px', background: '#2a5298', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                {isPending ? 'Speichern…' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function GroupRow({ node, depth, onCreate, onRename, onDelete }: {
  node: GroupNode
  depth: number
  onCreate: (parent_id: number) => void
  onRename: (id: number, name: string, parent_id: number | null) => void
  onDelete: (id: number) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const hasChildren = node.children.length > 0

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: `10px 16px 10px ${16 + depth * 24}px`,
        background: '#fff', border: '1px solid #e5e7eb',
        borderRadius: 6, marginBottom: 4, position: 'relative',
      }}>
        <span style={{ width: 16, color: '#9ca3af', cursor: hasChildren ? 'pointer' : 'default', fontSize: 11 }}
          onClick={() => hasChildren && setExpanded(e => !e)}>
          {hasChildren ? (expanded ? '▼' : '▶') : ''}
        </span>
        <span style={{ color: '#d1d5db', fontSize: 16, userSelect: 'none' }}>⠿</span>
        <span style={{ fontSize: 18 }}>📁</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 500, fontSize: 14 }}>{node.name}</div>
          <div style={{ fontSize: 12, color: '#9ca3af' }}>{node.member_count} Mitglied{node.member_count !== 1 ? 'er' : ''}</div>
        </div>
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button onClick={() => setMenuOpen(o => !o)}
            style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 4, padding: '3px 10px', cursor: 'pointer', color: '#6b7280', fontSize: 16 }}>
            ···
          </button>
          {menuOpen && (
            <div style={{ position: 'absolute', right: 0, top: '110%', zIndex: 100, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', minWidth: 190, overflow: 'hidden' }}>
              {[
                { label: 'Neue Untergruppe', action: () => { setMenuOpen(false); onCreate(node.id) } },
                { label: 'Gruppe umbenennen', action: () => { setMenuOpen(false); onRename(node.id, node.name, node.parent_id) } },
                { label: 'Gruppe löschen', action: () => { setMenuOpen(false); onDelete(node.id) }, danger: true },
              ].map(item => (
                <button key={item.label} onClick={item.action}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 16px', background: 'none', border: 'none', fontSize: 14, cursor: 'pointer', color: item.danger ? '#dc2626' : '#374151' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}>
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {expanded && node.children.map(child => (
        <GroupRow key={child.id} node={child} depth={depth + 1}
          onCreate={onCreate} onRename={onRename} onDelete={onDelete} />
      ))}
    </div>
  )
}
