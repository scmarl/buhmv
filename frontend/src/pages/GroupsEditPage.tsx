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

export default function GroupsEditPage() {
  const qc = useQueryClient()
  const { data: tree = [], isLoading } = useQuery<GroupNode[]>({
    queryKey: ['groups-tree'],
    queryFn: () => api.get('/groups', { params: { tree: true } }).then(r => r.data),
  })

  const createGroup = useMutation({
    mutationFn: (data: { name: string; parent_id: number | null }) =>
      api.post('/groups', { ...data, sort_order: 0 }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups-tree'] }),
  })

  const renameGroup = useMutation({
    mutationFn: ({ id, name, parent_id }: { id: number; name: string; parent_id: number | null }) =>
      api.put(`/groups/${id}`, { name, parent_id, sort_order: 0 }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups-tree'] }),
  })

  const deleteGroup = useMutation({
    mutationFn: (id: number) => api.delete(`/groups/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups-tree'] }),
  })

  function handleNew() {
    const name = window.prompt('Name der neuen Gruppe:')
    if (name?.trim()) createGroup.mutate({ name: name.trim(), parent_id: null })
  }

  return (
    <div style={{ maxWidth: 800 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>Mitgliedergruppen bearbeiten</h1>

      <button onClick={handleNew}
        style={{ padding: '8px 20px', background: '#5a8a3c', color: '#fff', border: 'none', borderRadius: 4, fontWeight: 600, fontSize: 14, cursor: 'pointer', marginBottom: 24 }}>
        + Neue Mitgliedergruppe
      </button>

      {isLoading ? <div>Laden…</div> : (
        <div>
          {tree.map(node => (
            <GroupRow key={node.id} node={node} depth={0}
              onCreate={(parent_id) => {
                const name = window.prompt('Name der Untergruppe:')
                if (name?.trim()) createGroup.mutate({ name: name.trim(), parent_id })
              }}
              onRename={(id, current, parent_id) => {
                const name = window.prompt('Neuer Name:', current)
                if (name?.trim() && name !== current) renameGroup.mutate({ id, name: name.trim(), parent_id })
              }}
              onDelete={(id) => {
                if (window.confirm('Gruppe wirklich löschen?')) deleteGroup.mutate(id)
              }}
            />
          ))}
          {tree.length === 0 && (
            <div style={{ color: '#9ca3af', fontSize: 14, padding: 24, textAlign: 'center', background: '#fff', borderRadius: 6, border: '1px solid #e5e7eb' }}>
              Noch keine Gruppen vorhanden.
            </div>
          )}
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
        {/* Expand toggle */}
        <span style={{ width: 16, color: '#9ca3af', cursor: hasChildren ? 'pointer' : 'default', fontSize: 11 }}
          onClick={() => hasChildren && setExpanded(e => !e)}>
          {hasChildren ? (expanded ? '▼' : '▶') : ''}
        </span>

        {/* Drag handle */}
        <span style={{ color: '#d1d5db', fontSize: 16, cursor: 'grab', userSelect: 'none' }}>⠿</span>

        {/* Folder icon */}
        <span style={{ fontSize: 18 }}>📁</span>

        {/* Name + count */}
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 500, fontSize: 14 }}>{node.name}</div>
          <div style={{ fontSize: 12, color: '#9ca3af' }}>{node.member_count} Mitglied{node.member_count !== 1 ? 'er' : ''}</div>
        </div>

        {/* Context menu button */}
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button onClick={() => setMenuOpen(o => !o)}
            style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 4, padding: '3px 10px', cursor: 'pointer', color: '#6b7280', fontSize: 16 }}>
            ···
          </button>
          {menuOpen && (
            <div style={{
              position: 'absolute', right: 0, top: '110%', zIndex: 100,
              background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6,
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)', minWidth: 190, overflow: 'hidden',
            }}>
              {[
                { label: 'Neue Untergruppe', action: () => { setMenuOpen(false); onCreate(node.id) } },
                { label: 'Gruppe umbenennen', action: () => { setMenuOpen(false); onRename(node.id, node.name, node.parent_id) } },
                { label: 'Gruppe löschen', action: () => { setMenuOpen(false); onDelete(node.id) }, danger: true },
              ].map(item => (
                <button key={item.label} onClick={item.action}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '10px 16px', background: 'none', border: 'none',
                    fontSize: 14, cursor: 'pointer',
                    color: item.danger ? '#dc2626' : '#374151',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}>
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Children */}
      {expanded && node.children.map(child => (
        <GroupRow key={child.id} node={child} depth={depth + 1}
          onCreate={onCreate} onRename={onRename} onDelete={onDelete} />
      ))}
    </div>
  )
}
