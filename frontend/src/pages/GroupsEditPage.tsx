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

type DialogMode = 'create' | 'rename' | 'move'

interface Dialog {
  mode: DialogMode
  parent_id?: number | null
  group_id?: number
  group_name?: string
}

export default function GroupsEditPage() {
  const qc = useQueryClient()
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [inputVal, setInputVal] = useState('')
  const [moveTarget, setMoveTarget] = useState<number | null>(null)
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

  const moveGroup = useMutation({
    mutationFn: ({ id, name, new_parent_id }: { id: number; name: string; new_parent_id: number | null }) =>
      api.put(`/groups/${id}`, { name, parent_id: new_parent_id, sort_order: 0 }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['groups-tree'] }); setDialog(null); setMoveTarget(null) },
  })

  const deleteGroup = useMutation({
    mutationFn: (id: number) => api.delete(`/groups/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups-tree'] }),
  })

  function openDialog(d: Dialog) {
    setInputVal(d.group_name ?? '')
    setMoveTarget(null)
    setDialog(d)
    if (d.mode !== 'move') setTimeout(() => inputRef.current?.focus(), 50)
  }

  function submitDialog() {
    if (!dialog) return
    if (dialog.mode === 'create') {
      if (!inputVal.trim()) return
      createGroup.mutate({ name: inputVal.trim(), parent_id: dialog.parent_id ?? null })
    } else if (dialog.mode === 'rename') {
      if (!inputVal.trim() || dialog.group_id == null) return
      renameGroup.mutate({ id: dialog.group_id, name: inputVal.trim(), parent_id: dialog.parent_id ?? null })
    } else if (dialog.mode === 'move') {
      if (dialog.group_id == null || moveTarget === undefined) return
      moveGroup.mutate({ id: dialog.group_id, name: dialog.group_name!, new_parent_id: moveTarget })
    }
  }

  const isPending = createGroup.isPending || renameGroup.isPending || moveGroup.isPending

  // Collect all group IDs that are descendants of a given ID (to disable in move picker)
  function getDescendantIds(nodes: GroupNode[], id: number): Set<number> {
    const result = new Set<number>()
    function walk(ns: GroupNode[]) {
      for (const n of ns) {
        if (n.id === id || result.has(n.parent_id!)) {
          result.add(n.id)
          walk(n.children)
        } else {
          walk(n.children)
        }
      }
    }
    walk(nodes)
    return result
  }

  const disabledIds = dialog?.mode === 'move' && dialog.group_id != null
    ? getDescendantIds(tree, dialog.group_id)
    : new Set<number>()

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
              onCreate={(pid) => openDialog({ mode: 'create', parent_id: pid })}
              onRename={(id, name, pid) => openDialog({ mode: 'rename', group_id: id, group_name: name, parent_id: pid })}
              onMove={(id, name) => openDialog({ mode: 'move', group_id: id, group_name: name })}
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

      {/* Modal */}
      {dialog && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={(e) => { if (e.target === e.currentTarget) { setDialog(null); setMoveTarget(null) } }}>
          <div style={{ background: '#fff', borderRadius: 8, padding: 32, width: dialog.mode === 'move' ? 480 : 380, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', position: 'relative' }}>

            {/* Close X */}
            <button onClick={() => { setDialog(null); setMoveTarget(null) }}
              style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280', lineHeight: 1 }}>×</button>

            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>
              {dialog.mode === 'create' ? (dialog.parent_id ? 'Neue Untergruppe' : 'Neue Mitgliedergruppe')
                : dialog.mode === 'rename' ? 'Gruppe umbenennen'
                : 'Gruppe verschieben'}
            </h2>

            {dialog.mode === 'move' ? (
              <>
                <p style={{ fontSize: 14, color: '#374151', marginBottom: 16 }}>
                  Wähle aus, in welche Gruppe du die Gruppe „<strong>{dialog.group_name}</strong>" verschieben möchtest.
                </p>
                <div style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 0', maxHeight: 320, overflowY: 'auto', marginBottom: 24 }}>
                  {tree.map(node => (
                    <MovePickerRow key={node.id} node={node} depth={0}
                      disabledIds={disabledIds}
                      selected={moveTarget}
                      onSelect={setMoveTarget} />
                  ))}
                </div>
              </>
            ) : (
              <input
                ref={inputRef}
                value={inputVal}
                onChange={e => setInputVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') submitDialog(); if (e.key === 'Escape') setDialog(null) }}
                placeholder="Gruppenname"
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 14, marginBottom: 20 }}
              />
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              {dialog.mode === 'move' ? (
                <>
                  <button onClick={submitDialog}
                    disabled={moveTarget === undefined || isPending}
                    style={{ padding: '8px 20px', background: moveTarget !== undefined ? '#5a8a3c' : '#d1d5db', color: '#fff', border: 'none', borderRadius: 4, cursor: moveTarget !== undefined ? 'pointer' : 'default', fontWeight: 600, fontSize: 14 }}>
                    {isPending ? 'Verschieben…' : `„${dialog.group_name}" verschieben`}
                  </button>
                  <button onClick={() => { setDialog(null); setMoveTarget(null) }}
                    style={{ padding: '8px 20px', background: '#e5e7eb', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14 }}>
                    Schliessen
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => setDialog(null)}
                    style={{ padding: '7px 18px', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer', fontSize: 14 }}>
                    Abbrechen
                  </button>
                  <button onClick={submitDialog} disabled={!inputVal.trim() || isPending}
                    style={{ padding: '7px 18px', background: '#2a5298', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                    {isPending ? 'Speichern…' : 'Speichern'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function GroupRow({ node, depth, onCreate, onRename, onMove, onDelete }: {
  node: GroupNode; depth: number
  onCreate: (pid: number) => void
  onRename: (id: number, name: string, pid: number | null) => void
  onMove: (id: number, name: string) => void
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: `10px 16px 10px ${16 + depth * 24}px`, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, marginBottom: 4, position: 'relative' }}>
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
                { label: 'Gruppe verschieben', action: () => { setMenuOpen(false); onMove(node.id, node.name) } },
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
          onCreate={onCreate} onRename={onRename} onMove={onMove} onDelete={onDelete} />
      ))}
    </div>
  )
}

function MovePickerRow({ node, depth, disabledIds, selected, onSelect }: {
  node: GroupNode; depth: number
  disabledIds: Set<number>
  selected: number | null
  onSelect: (id: number) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const isDisabled = disabledIds.has(node.id)
  const isSelected = selected === node.id

  return (
    <div>
      <div
        onClick={() => !isDisabled && onSelect(node.id)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: `8px 16px 8px ${16 + depth * 20}px`,
          cursor: isDisabled ? 'default' : 'pointer',
          background: isSelected ? '#eff4ff' : 'transparent',
          opacity: isDisabled ? 0.4 : 1,
        }}
        onMouseEnter={e => { if (!isDisabled && !isSelected) e.currentTarget.style.background = '#f9fafb' }}
        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}>
        <span style={{ width: 14, fontSize: 10, color: '#9ca3af', cursor: node.children.length ? 'pointer' : 'default' }}
          onClick={e => { e.stopPropagation(); node.children.length && setExpanded(x => !x) }}>
          {node.children.length > 0 ? (expanded ? '▼' : '▶') : ''}
        </span>
        <span style={{ fontSize: 16 }}>{isDisabled ? '📁' : '📁'}</span>
        <span style={{ fontSize: 14, color: isDisabled ? '#9ca3af' : '#374151' }}>{node.name}</span>
        {isSelected && <span style={{ marginLeft: 'auto', color: '#2a5298', fontSize: 13 }}>✓</span>}
      </div>
      {expanded && node.children.map(child => (
        <MovePickerRow key={child.id} node={child} depth={depth + 1}
          disabledIds={disabledIds} selected={selected} onSelect={onSelect} />
      ))}
    </div>
  )
}
