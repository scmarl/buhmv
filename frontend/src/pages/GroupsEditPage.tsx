import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useRef, useEffect } from 'react'
import api from '../api/client'

interface GroupNode {
  id: number
  name: string
  parent_id: number | null
  sort_order: number
  member_count: number
  children: GroupNode[]
}

type DialogMode = 'create' | 'rename' | 'move' | 'delete'

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
    mutationFn: (d: { name: string; parent_id: number | null }) =>
      api.post('/groups', { ...d, sort_order: 0 }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['groups-tree'] }); closeDialog() },
  })
  const renameGroup = useMutation({
    mutationFn: (d: { id: number; name: string; parent_id: number | null }) =>
      api.put(`/groups/${d.id}`, { name: d.name, parent_id: d.parent_id, sort_order: 0 }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['groups-tree'] }); closeDialog() },
  })
  const moveGroup = useMutation({
    mutationFn: (d: { id: number; name: string; new_parent_id: number | null }) =>
      api.put(`/groups/${d.id}`, { name: d.name, parent_id: d.new_parent_id, sort_order: 0 }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['groups-tree'] }); closeDialog() },
  })
  const deleteGroup = useMutation({
    mutationFn: (id: number) => api.delete(`/groups/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['groups-tree'] }); closeDialog() },
  })

  function closeDialog() { setDialog(null); setMoveTarget(null); setInputVal('') }

  function openDialog(d: Dialog) {
    setInputVal(d.group_name ?? '')
    setMoveTarget(null)
    setDialog(d)
    if (d.mode !== 'move' && d.mode !== 'delete')
      setTimeout(() => inputRef.current?.focus(), 50)
  }

  function submitDialog() {
    if (!dialog) return
    if (dialog.mode === 'create') {
      if (!inputVal.trim()) return
      createGroup.mutate({ name: inputVal.trim(), parent_id: dialog.parent_id ?? null })
    } else if (dialog.mode === 'rename') {
      if (!inputVal.trim() || dialog.group_id == null) return
      renameGroup.mutate({ id: dialog.group_id, name: inputVal.trim(), parent_id: dialog.parent_id ?? null })
    } else if (dialog.mode === 'delete') {
      if (dialog.group_id == null) return
      deleteGroup.mutate(dialog.group_id)
    } else if (dialog.mode === 'move') {
      if (dialog.group_id == null || moveTarget === null) return
      moveGroup.mutate({ id: dialog.group_id, name: dialog.group_name!, new_parent_id: moveTarget })
    }
  }

  const isPending = createGroup.isPending || renameGroup.isPending || moveGroup.isPending || deleteGroup.isPending

  function getDescendantIds(nodes: GroupNode[], id: number): Set<number> {
    const result = new Set<number>([id])
    function walk(ns: GroupNode[]) {
      for (const n of ns) {
        if (result.has(n.parent_id!)) { result.add(n.id); walk(n.children) }
        else walk(n.children)
      }
    }
    walk(nodes)
    return result
  }

  const disabledIds = dialog?.mode === 'move' && dialog.group_id != null
    ? getDescendantIds(tree, dialog.group_id) : new Set<number>()

  const modalTitle =
    dialog?.mode === 'create' ? (dialog.parent_id ? 'Neue Untergruppe' : 'Neue Mitgliedergruppe')
    : dialog?.mode === 'rename' ? 'Gruppe umbenennen'
    : dialog?.mode === 'delete' ? 'Gruppe löschen'
    : 'Gruppe verschieben'

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
              onDelete={(id, name) => openDialog({ mode: 'delete', group_id: id, group_name: name })}
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
          onClick={(e) => { if (e.target === e.currentTarget) closeDialog() }}>
          <div style={{ background: '#fff', borderRadius: 8, padding: 32, width: dialog.mode === 'move' ? 480 : 400, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', position: 'relative' }}>
            <button onClick={closeDialog}
              style={{ position: 'absolute', top: 14, right: 16, background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#6b7280', lineHeight: 1 }}>×</button>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>{modalTitle}</h2>

            {dialog.mode === 'delete' && (
              <>
                <p style={{ fontSize: 14, color: '#374151', marginBottom: 8 }}>
                  Soll die Gruppe <strong>„{dialog.group_name}"</strong> wirklich gelöscht werden?
                </p>
                <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 24 }}>Untergruppen werden ebenfalls gelöscht.</p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button onClick={closeDialog}
                    style={{ padding: '7px 18px', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer', fontSize: 14 }}>
                    Abbrechen
                  </button>
                  <button onClick={submitDialog} disabled={isPending}
                    style={{ padding: '7px 18px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                    {isPending ? 'Löschen…' : 'Löschen'}
                  </button>
                </div>
              </>
            )}

            {dialog.mode === 'move' && (
              <>
                <p style={{ fontSize: 14, color: '#374151', marginBottom: 16 }}>
                  Wähle aus, in welche Gruppe du die Gruppe „<strong>{dialog.group_name}</strong>" verschieben möchtest.
                </p>
                <div style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 0', maxHeight: 300, overflowY: 'auto', marginBottom: 24 }}>
                  {tree.map(node => (
                    <MovePickerRow key={node.id} node={node} depth={0}
                      disabledIds={disabledIds} selected={moveTarget} onSelect={setMoveTarget} />
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={submitDialog} disabled={moveTarget === null || isPending}
                    style={{ padding: '8px 20px', background: moveTarget !== null ? '#5a8a3c' : '#d1d5db', color: '#fff', border: 'none', borderRadius: 4, cursor: moveTarget !== null ? 'pointer' : 'default', fontWeight: 600, fontSize: 14 }}>
                    {isPending ? 'Verschieben…' : `„${dialog.group_name}" verschieben`}
                  </button>
                  <button onClick={closeDialog}
                    style={{ padding: '8px 20px', background: '#e5e7eb', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14 }}>
                    Schliessen
                  </button>
                </div>
              </>
            )}

            {(dialog.mode === 'create' || dialog.mode === 'rename') && (
              <>
                <input ref={inputRef} value={inputVal} onChange={e => setInputVal(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') submitDialog(); if (e.key === 'Escape') closeDialog() }}
                  placeholder="Gruppenname"
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 14, marginBottom: 20 }} />
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button onClick={closeDialog}
                    style={{ padding: '7px 18px', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer', fontSize: 14 }}>
                    Abbrechen
                  </button>
                  <button onClick={submitDialog} disabled={!inputVal.trim() || isPending}
                    style={{ padding: '7px 18px', background: '#2a5298', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                    {isPending ? 'Speichern…' : 'Speichern'}
                  </button>
                </div>
              </>
            )}
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
  onDelete: (id: number, name: string) => void
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

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: `10px 16px 10px ${16 + depth * 24}px`, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, marginBottom: 4 }}>
        <span style={{ width: 16, color: '#9ca3af', cursor: node.children.length ? 'pointer' : 'default', fontSize: 11 }}
          onClick={() => node.children.length && setExpanded(e => !e)}>
          {node.children.length ? (expanded ? '▼' : '▶') : ''}
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
                { label: 'Gruppe löschen', action: () => { setMenuOpen(false); onDelete(node.id, node.name) }, danger: true },
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
  disabledIds: Set<number>; selected: number | null
  onSelect: (id: number) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const isDisabled = disabledIds.has(node.id)
  const isSelected = selected === node.id

  return (
    <div>
      <div onClick={() => !isDisabled && onSelect(node.id)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: `8px 16px 8px ${16 + depth * 20}px`, cursor: isDisabled ? 'default' : 'pointer', background: isSelected ? '#eff4ff' : 'transparent', opacity: isDisabled ? 0.4 : 1 }}
        onMouseEnter={e => { if (!isDisabled && !isSelected) e.currentTarget.style.background = '#f9fafb' }}
        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}>
        <span style={{ width: 14, fontSize: 10, color: '#9ca3af', cursor: node.children.length ? 'pointer' : 'default' }}
          onClick={e => { e.stopPropagation(); node.children.length && setExpanded(x => !x) }}>
          {node.children.length > 0 ? (expanded ? '▼' : '▶') : ''}
        </span>
        <span style={{ fontSize: 16 }}>📁</span>
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
