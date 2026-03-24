import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../api/client'

// ── Types ─────────────────────────────────────────────────────────────────────

interface GroupNode { id: number; name: string; member_count: number; children: GroupNode[] }
interface FieldDef { name: string; label: string; field_type: string }
interface ListView { id: number; name: string; columns: string[]; is_default: boolean }

function findGroupName(nodes: GroupNode[], id: number): string | null {
  for (const n of nodes) {
    if (n.id === id) return n.name
    const found = findGroupName(n.children, id)
    if (found) return found
  }
  return null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const DEFAULT_COLS = ['member_number', 'last_name', 'first_name', 'email', 'age', 'city', 'entry_date']

// Virtual fields not in the fields API
const VIRTUAL_FIELDS: FieldDef[] = [
  { name: 'age', label: 'Alter', field_type: 'number' },
]

const NON_DISPLAYABLE = new Set(['photo_url', 'notes_field', 'file', 'image'])

function formatCell(value: unknown, fieldType: string, fieldName: string): string {
  if (value == null || value === '') return '—'
  if (fieldName === 'age') return value + ' J.'
  if (fieldName === 'is_active') return value ? 'Ja' : 'Nein'
  if (fieldType === 'date') {
    const d = new Date(value as string)
    if (isNaN(d.getTime())) return String(value)
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }
  if (fieldType === 'checkbox') return value ? 'Ja' : 'Nein'
  if (fieldType === 'money') return Number(value).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
  return String(value)
}


// ── Action Dropdown ───────────────────────────────────────────────────────────

interface ActionItem { label: string; onClick: () => void; divider?: boolean }

function ActionDropdown({ label, items, variant = 'default' }: {
  label: string; items: ActionItem[]; variant?: 'default' | 'primary'
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
        border: variant === 'primary' ? 'none' : '1px solid #d1d5db', borderRadius: 6,
        background: variant === 'primary' ? '#16a34a' : '#fff',
        color: variant === 'primary' ? '#fff' : '#374151',
        cursor: 'pointer', fontSize: 13, fontWeight: 600,
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
      }}>
        {label} <span style={{ fontSize: 9, opacity: 0.7 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 300,
          background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
          boxShadow: '0 6px 24px rgba(0,0,0,0.12)', minWidth: 210, padding: '4px 0',
        }}>
          {items.map((item, i) => (
            item.divider
              ? <div key={i} style={{ height: 1, background: '#f3f4f6', margin: '4px 0' }} />
              : <button key={i} onClick={() => { item.onClick(); setOpen(false) }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#111827' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                  {item.label}
                </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Felder Dropdown ───────────────────────────────────────────────────────────

function FelderDropdown({
  allFields,
  columns,
  onChange,
}: {
  allFields: FieldDef[]
  columns: string[]
  onChange: (cols: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [dragOver, setDragOver] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const visible = allFields.filter(f => f.label.toLowerCase().includes(search.toLowerCase()))
  // Ordered: selected cols first (in order), then rest
  const selected = columns.filter(c => allFields.find(f => f.name === c))
  const unselected = allFields.filter(f => !columns.includes(f.name)).map(f => f.name)

  function toggle(name: string) {
    if (columns.includes(name)) onChange(columns.filter(c => c !== name))
    else onChange([...columns, name])
  }

  function handleDragStart(e: React.DragEvent, name: string) {
    e.dataTransfer.setData('col', name)
  }

  function handleDrop(e: React.DragEvent, targetName: string) {
    e.preventDefault()
    const src = e.dataTransfer.getData('col')
    if (src === targetName) return
    const cols = [...columns]
    const si = cols.indexOf(src)
    const ti = cols.indexOf(targetName)
    if (si === -1 || ti === -1) return
    cols.splice(si, 1)
    cols.splice(ti, 0, src)
    onChange(cols)
    setDragOver(null)
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
        border: '1px solid #d1d5db', borderRadius: 6, background: open ? '#eff4ff' : '#fff',
        cursor: 'pointer', fontSize: 13, fontWeight: 500, color: open ? '#2a5298' : '#374151',
      }}>
        Felder
        <span style={{ fontSize: 10, color: '#9ca3af' }}>▾</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 200, marginTop: 4,
          background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
          boxShadow: '0 6px 24px rgba(0,0,0,0.12)', width: 260, maxHeight: 420, display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ padding: '10px 12px 6px' }}>
            <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Feld suchen"
              style={{ width: '100%', padding: '6px 10px', border: '1px solid #e5e7eb', borderRadius: 5, fontSize: 13, boxSizing: 'border-box', color: '#9ca3af' }} />
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {/* Selected (in order, draggable) */}
            {selected.filter(c => {
              const f = allFields.find(x => x.name === c)
              return f && f.label.toLowerCase().includes(search.toLowerCase())
            }).map(name => {
              const f = allFields.find(x => x.name === name)!
              return (
                <div key={name}
                  draggable
                  onDragStart={e => handleDragStart(e, name)}
                  onDragOver={e => { e.preventDefault(); setDragOver(name) }}
                  onDrop={e => handleDrop(e, name)}
                  onDragLeave={() => setDragOver(null)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px',
                    cursor: 'grab', background: dragOver === name ? '#eff4ff' : 'transparent',
                    borderBottom: dragOver === name ? '2px solid #2a5298' : '2px solid transparent',
                  }}
                >
                  <span style={{ color: '#d1d5db', fontSize: 14, flexShrink: 0 }}>≡</span>
                  <input type="checkbox" checked onChange={() => toggle(name)} style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: '#111827', flex: 1 }}>{f.label}</span>
                </div>
              )
            })}
            {/* Divider if both exist */}
            {selected.length > 0 && unselected.some(c => {
              const f = allFields.find(x => x.name === c)
              return f && f.label.toLowerCase().includes(search.toLowerCase())
            }) && (
              <div style={{ height: 1, background: '#f3f4f6', margin: '4px 0' }} />
            )}
            {/* Unselected */}
            {unselected.filter(name => {
              const f = allFields.find(x => x.name === name)
              return f && f.label.toLowerCase().includes(search.toLowerCase())
            }).map(name => {
              const f = allFields.find(x => x.name === name)!
              return (
                <div key={name}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', cursor: 'pointer' }}
                  onClick={() => toggle(name)}
                >
                  <span style={{ color: '#e5e7eb', fontSize: 14, flexShrink: 0 }}>≡</span>
                  <input type="checkbox" checked={false} onChange={() => toggle(name)} style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: '#6b7280', flex: 1 }}>{f.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Ansicht Dropdown ──────────────────────────────────────────────────────────

function AnsichtDropdown({
  views,
  currentCols,
  activeViewId,
  onLoad,
  onSave,
  onUpdate,
  onDelete,
}: {
  views: ListView[]
  currentCols: string[]
  activeViewId: number | null
  onLoad: (view: ListView) => void
  onSave: (name: string, isDefault: boolean) => void
  onUpdate: (id: number, name: string, isDefault: boolean) => void
  onDelete: (id: number) => void
}) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'list' | 'save' | 'edit'>('list')
  const [saveName, setSaveName] = useState('')
  const [saveDefault, setSaveDefault] = useState(false)
  const [editView, setEditView] = useState<ListView | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setMode('list') } }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const activeView = views.find(v => v.id === activeViewId)

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
        border: '1px solid #d1d5db', borderRadius: 6, background: open ? '#eff4ff' : '#fff',
        cursor: 'pointer', fontSize: 13, fontWeight: 500, color: open ? '#2a5298' : '#374151',
        maxWidth: 180, overflow: 'hidden',
      }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {activeView ? activeView.name : 'Ansicht'}
        </span>
        <span style={{ fontSize: 10, color: '#9ca3af', flexShrink: 0 }}>▾</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 200, marginTop: 4,
          background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
          boxShadow: '0 6px 24px rgba(0,0,0,0.12)', width: 240,
        }}>
          {mode === 'list' && (
            <>
              {views.map(v => (
                <div key={v.id} style={{
                  display: 'flex', alignItems: 'center', padding: '8px 12px', gap: 8,
                  background: v.id === activeViewId ? '#eff4ff' : 'transparent',
                  borderLeft: v.id === activeViewId ? '3px solid #2a5298' : '3px solid transparent',
                }}>
                  <span onClick={() => { onLoad(v); setOpen(false) }}
                    style={{ flex: 1, fontSize: 13, cursor: 'pointer', color: v.id === activeViewId ? '#2a5298' : '#374151', fontWeight: v.id === activeViewId ? 600 : 400 }}>
                    {v.name}
                    {v.is_default && <span style={{ marginLeft: 6, fontSize: 10, color: '#9ca3af' }}>Standard</span>}
                  </span>
                  <button onClick={() => { setEditView(v); setSaveName(v.name); setSaveDefault(v.is_default); setMode('edit') }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#9ca3af', padding: '2px 4px' }}>✎</button>
                  <button onClick={() => onDelete(v.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#dc2626', padding: '2px 4px' }}>✕</button>
                </div>
              ))}
              {views.length === 0 && (
                <p style={{ fontSize: 13, color: '#9ca3af', padding: '12px', margin: 0 }}>Noch keine gespeicherten Ansichten.</p>
              )}
              <div style={{ borderTop: '1px solid #f3f4f6', padding: '8px 12px' }}>
                <button onClick={() => { setSaveName(''); setSaveDefault(false); setMode('save') }}
                  style={{ width: '100%', padding: '7px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                  + Aktuelle Ansicht speichern
                </button>
              </div>
            </>
          )}

          {(mode === 'save' || mode === 'edit') && (
            <div style={{ padding: 14 }}>
              <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 10px', color: '#111827' }}>
                {mode === 'save' ? 'Ansicht speichern' : 'Ansicht bearbeiten'}
              </p>
              <input autoFocus value={saveName} onChange={e => setSaveName(e.target.value)}
                placeholder="Name der Ansicht"
                style={{ width: '100%', padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 5, fontSize: 13, boxSizing: 'border-box', marginBottom: 8 }} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', marginBottom: 12 }}>
                <input type="checkbox" checked={saveDefault} onChange={e => setSaveDefault(e.target.checked)} />
                Als Standard-Ansicht
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setMode('list')}
                  style={{ flex: 1, padding: '6px', border: '1px solid #d1d5db', borderRadius: 5, cursor: 'pointer', fontSize: 13, background: '#fff' }}>
                  Abbrechen
                </button>
                <button
                  disabled={!saveName.trim()}
                  onClick={() => {
                    if (mode === 'save') onSave(saveName.trim(), saveDefault)
                    else if (editView) onUpdate(editView.id, saveName.trim(), saveDefault)
                    setMode('list'); setOpen(false)
                  }}
                  style={{ flex: 1, padding: '6px', background: '#2a5298', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                  Speichern
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MembersPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [columns, setColumns] = useState<string[]>(DEFAULT_COLS)
  const [activeViewId, setActiveViewId] = useState<number | null>(null)
  const [sortBy, setSortBy] = useState('last_name')
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('asc')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const qc = useQueryClient()
  const groupId = searchParams.get('group') ? Number(searchParams.get('group')) : null

  useEffect(() => { setPage(1); setSelected(new Set()) }, [groupId, search, sortBy, sortDir])

  // Data queries
  const { data, isLoading } = useQuery({
    queryKey: ['members', page, search, groupId, sortBy, sortDir],
    queryFn: () => api.get('/members', { params: { page, size: 25, search: search || undefined, group_id: groupId ?? undefined, active_only: false, sort_by: sortBy, sort_dir: sortDir } }).then(r => r.data),
  })

  const { data: groupsTree = [] } = useQuery<GroupNode[]>({
    queryKey: ['groups-tree'],
    queryFn: () => api.get('/groups', { params: { tree: true } }).then(r => r.data),
    staleTime: 30_000,
  })

  const { data: rawFields = [] } = useQuery<FieldDef[]>({
    queryKey: ['fields'],
    queryFn: () => api.get('/fields').then(r => r.data),
  })

  const { data: listViews = [] } = useQuery<ListView[]>({
    queryKey: ['list-views'],
    queryFn: () => api.get('/list-views').then(r => r.data),
  })

  // Load default view on first load
  useEffect(() => {
    if (listViews.length > 0 && activeViewId === null) {
      const def = listViews.find(v => v.is_default)
      if (def) { setColumns(def.columns); setActiveViewId(def.id) }
    }
  }, [listViews])

  // Available fields for column selector (exclude file/image/photo_url/notes_field)
  const allFields: FieldDef[] = [
    ...rawFields.filter(f => !NON_DISPLAYABLE.has(f.name) && f.field_type !== 'file' && f.field_type !== 'image'),
    ...VIRTUAL_FIELDS,
  ]

  // Mutations
  const deleteMut = useMutation({
    mutationFn: (ids: number[]) => Promise.all(ids.map(id => api.delete(`/members/${id}`))),
    onSuccess: () => { setSelected(new Set()); qc.invalidateQueries({ queryKey: ['members'] }) },
  })

  const saveViewMut = useMutation({
    mutationFn: (body: object) => api.post('/list-views', body),
    onSuccess: (res) => { qc.invalidateQueries({ queryKey: ['list-views'] }); setActiveViewId(res.data.id) },
  })

  const updateViewMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: object }) => api.put(`/list-views/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['list-views'] }),
  })

  const deleteViewMut = useMutation({
    mutationFn: (id: number) => api.delete(`/list-views/${id}`),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['list-views'] })
      if (activeViewId === id) { setActiveViewId(null); setColumns(DEFAULT_COLS) }
    },
  })

  function handleColumnsChange(cols: string[]) {
    setColumns(cols)
    setActiveViewId(null)   // mark as unsaved
  }

  const groupName = groupId ? findGroupName(groupsTree, groupId) : null
  const items: any[] = data?.items ?? []
  const allSelected = items.length > 0 && items.every(m => selected.has(m.id))

  function toggleAll() {
    if (allSelected) setSelected(prev => { const s = new Set(prev); items.forEach(m => s.delete(m.id)); return s })
    else setSelected(prev => { const s = new Set(prev); items.forEach(m => s.add(m.id)); return s })
  }
  function toggle(id: number) {
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }

  function handleSort(name: string) {
    if (name === 'age') return  // calculated, not sortable in DB
    if (sortBy === name) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(name); setSortDir('asc') }
  }

  // Column headers (visible columns only, in order)
  const visibleFields = columns.map(name => allFields.find(f => f.name === name)).filter(Boolean) as FieldDef[]

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 14 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
          {groupName ?? 'Alle Mitglieder'}
        </h1>
        {groupName && (
          <button onClick={() => navigate('/members')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#6b7280', padding: 0 }}>
            ← Alle anzeigen
          </button>
        )}
        {data && <p style={{ fontSize: 13, color: '#6b7280', margin: '2px 0 0' }}>{data.total} Mitglieder{selected.size > 0 ? ` · ${selected.size} ausgewählt` : ''}</p>}
      </div>

      {/* Action Toolbar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <ActionDropdown variant="primary" label="Erfassen" items={[
          { label: 'Neues Mitglied', onClick: () => navigate('/members/new') },
          { label: 'Neue Untergruppe', onClick: () => navigate('/groups-edit') },
          { divider: true, label: '', onClick: () => {} },
          { label: 'Mitglieder importieren', onClick: () => navigate('/import') },
        ]} />
        <ActionDropdown label="Exportieren" items={[
          { label: 'Als CSV exportieren', onClick: () => navigate('/export') },
          { label: 'Als Excel exportieren', onClick: () => navigate('/export') },
        ]} />
        <ActionDropdown label="Drucken" items={[
          { label: 'Liste drucken', onClick: () => window.print() },
          { label: 'Etiketten drucken', onClick: () => alert('Kommt') },
        ]} />
        <ActionDropdown label="Versenden" items={[
          { label: 'E-Mail senden', onClick: () => {
            const addrs = items.filter((m: any) => selected.has(m.id) && m.email).map((m: any) => m.email)
            if (addrs.length) window.location.href = 'mailto:?bcc=' + addrs.join(',')
            else alert('Keine Mitglieder mit E-Mail ausgewählt')
          }},
          { label: 'E-Mail-Adressen kopieren', onClick: () => {
            const addrs = items.filter((m: any) => selected.has(m.id) && m.email).map((m: any) => m.email).join('; ')
            navigator.clipboard.writeText(addrs)
          }},
        ]} />
        <ActionDropdown label="Extras" items={[
          { label: 'Duplikate prüfen', onClick: () => navigate('/duplicates') },
          { divider: true, label: '', onClick: () => {} },
          { label: 'Datenfelder bearbeiten', onClick: () => navigate('/fields') },
          { label: 'Gruppen bearbeiten', onClick: () => navigate('/groups-edit') },
        ]} />
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Felder + Ansicht */}
        <FelderDropdown allFields={allFields} columns={columns} onChange={handleColumnsChange} />
        <AnsichtDropdown
          views={listViews}
          currentCols={columns}
          activeViewId={activeViewId}
          onLoad={v => { setColumns(v.columns); setActiveViewId(v.id) }}
          onSave={(name, isDefault) => saveViewMut.mutate({ name, columns, is_default: isDefault })}
          onUpdate={(id, name, isDefault) => updateViewMut.mutate({ id, body: { name, columns, is_default: isDefault } })}
          onDelete={id => deleteViewMut.mutate(id)}
        />

        <div style={{ width: 1, height: 24, background: '#e5e7eb', margin: '0 4px' }} />

        {/* Search */}
        <input
          placeholder="Suche nach Name oder E-Mail…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: '7px 12px', border: '1px solid #d1d5db', borderRadius: 6, width: 260, fontSize: 13 }}
        />

        {selected.size > 0 && (
          <button onClick={() => {
            if (window.confirm(`${selected.size} Mitglied(er) wirklich löschen?`))
              deleteMut.mutate(Array.from(selected))
          }} disabled={deleteMut.isPending}
            style={{ padding: '7px 14px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
            {deleteMut.isPending ? 'Löschen…' : `${selected.size} löschen`}
          </button>
        )}

      </div>

      {/* Table */}
      {isLoading ? (
        <div style={{ color: '#6b7280', padding: 32, textAlign: 'center' }}>Laden…</div>
      ) : items.length === 0 ? (
        <div style={{ color: '#9ca3af', padding: 48, textAlign: 'center', background: '#fff', borderRadius: 8 }}>
          {groupName ? `Keine Mitglieder in „${groupName}"` : 'Keine Mitglieder gefunden'}
        </div>
      ) : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <thead>
                <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
                  <th style={{ padding: '9px 12px', width: 36 }}>
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                  </th>
                  {visibleFields.map(f => {
                    const sortable = f.name !== 'age'
                    const active = sortBy === f.name
                    return (
                      <th key={f.name}
                        onClick={() => handleSort(f.name)}
                        style={{ padding: '9px 12px', fontSize: 11, fontWeight: 700, color: active ? '#2a5298' : '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap', cursor: sortable ? 'pointer' : 'default', userSelect: 'none' }}>
                        {f.label}
                        {sortable && (
                          <span style={{ marginLeft: 4, opacity: active ? 1 : 0.25 }}>
                            {active ? (sortDir === 'asc' ? '▲' : '▼') : '▲'}
                          </span>
                        )}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {items.map((m: any) => (
                  <tr key={m.id}
                    style={{ borderTop: '1px solid #f3f4f6', background: selected.has(m.id) ? '#eff6ff' : '' }}
                    onMouseEnter={e => { if (!selected.has(m.id)) e.currentTarget.style.background = '#f9fafb' }}
                    onMouseLeave={e => { e.currentTarget.style.background = selected.has(m.id) ? '#eff6ff' : '' }}>
                    <td style={{ padding: '9px 12px' }} onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(m.id)} onChange={() => toggle(m.id)} />
                    </td>
                    {visibleFields.map(f => (
                      <td key={f.name}
                        style={{ padding: '9px 12px', fontSize: 13, color: f.name === 'last_name' || f.name === 'first_name' ? '#111827' : '#374151', fontWeight: f.name === 'last_name' ? 500 : 400, cursor: f.name === 'last_name' ? 'pointer' : 'default', whiteSpace: 'nowrap' }}
                        onClick={f.name === 'last_name' ? () => navigate(`/members/${m.id}`) : undefined}
                      >
                        {formatCell(m[f.name], f.field_type, f.name)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

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
