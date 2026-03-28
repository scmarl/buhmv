import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../api/client'
import { useMe } from '../hooks/useAuth'
import EmailComposeModal from '../components/EmailComposeModal'

interface FieldDef  { name: string; label: string; field_type: string; options?: string }
interface ListView  { id: number; name: string; columns: string[]; is_default: boolean; is_shared: boolean; owner_id?: number|null }

const DEFAULT_COLS    = ['member_number','last_name','first_name','email','age','city','entry_date']
const VIRTUAL_FIELDS: FieldDef[] = [
  { name:'age',    label:'Alter',  field_type:'number' },
  { name:'groups', label:'Gruppe', field_type:'text'   },
]
const NON_DISPLAYABLE = new Set(['photo_url','notes_field','file','image'])

function formatCell(value: unknown, fieldType: string, fieldName: string): string {
  if (value == null || value === '') return '—'
  if (fieldName === 'age') return value + ' J.'
  if (fieldName === 'groups') {
    if (Array.isArray(value)) return value.map((g: any) => g.name).join(', ') || '—'
    return '—'
  }
  if (fieldName === 'is_active') return value ? 'Ja' : 'Nein'
  if (fieldType === 'date') {
    const d = new Date(value as string)
    if (isNaN(d.getTime())) return String(value)
    return d.toLocaleDateString('de-DE', { day:'2-digit', month:'2-digit', year:'numeric' })
  }
  if (fieldType === 'checkbox') return value ? 'Ja' : 'Nein'
  if (fieldType === 'money')    return Number(value).toLocaleString('de-DE', { style:'currency', currency:'EUR' })
  return String(value)
}

function FelderDropdown({ allFields, columns, onChange }: {
  allFields: FieldDef[]; columns: string[]; onChange:(cols:string[])=>void
}) {
  const [open, setOpen]         = useState(false)
  const [search, setSearch]     = useState('')
  const [dragOver, setDragOver] = useState<string|null>(null)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [])
  const selected   = columns.filter(c => allFields.find(f => f.name === c))
  const unselected = allFields.filter(f => !columns.includes(f.name)).map(f => f.name)
  function toggle(name: string) {
    columns.includes(name) ? onChange(columns.filter(c => c !== name)) : onChange([...columns, name])
  }
  function handleDrop(e: React.DragEvent, targetName: string) {
    e.preventDefault(); const src = e.dataTransfer.getData('col'); if (src === targetName) return
    const cols = [...columns]; const si = cols.indexOf(src); const ti = cols.indexOf(targetName)
    if (si === -1 || ti === -1) return; cols.splice(si, 1); cols.splice(ti, 0, src); onChange(cols); setDragOver(null)
  }
  return (
    <div ref={ref} style={{ position:'relative' }}>
      <button onClick={()=>setOpen(o=>!o)} style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', border:'1px solid #d1d5db', borderRadius:6, background:open?'#eff4ff':'#fff', cursor:'pointer', fontSize:13, fontWeight:500, color:open?'#2a5298':'#374151' }}>
        Felder <span style={{ fontSize:10, color:'#9ca3af' }}>▾</span>
      </button>
      {open && (
        <div style={{ position:'absolute', top:'100%', left:0, zIndex:200, marginTop:4, background:'#fff', border:'1px solid #e5e7eb', borderRadius:8, boxShadow:'0 6px 24px rgba(0,0,0,.12)', width:260, maxHeight:420, display:'flex', flexDirection:'column' }}>
          <div style={{ padding:'10px 12px 6px' }}>
            <input autoFocus value={search} onChange={e=>setSearch(e.target.value)} placeholder="Feld suchen" style={{ width:'100%', padding:'6px 10px', border:'1px solid #e5e7eb', borderRadius:5, fontSize:13, boxSizing:'border-box' }} />
          </div>
          <div style={{ overflowY:'auto', flex:1 }}>
            {selected.filter(c=>allFields.find(x=>x.name===c)?.label.toLowerCase().includes(search.toLowerCase())).map(name=>{
              const f=allFields.find(x=>x.name===name)!
              return (
                <div key={name} draggable onDragStart={e=>e.dataTransfer.setData('col',name)} onDragOver={e=>{e.preventDefault();setDragOver(name)}} onDrop={e=>handleDrop(e,name)} onDragLeave={()=>setDragOver(null)}
                  style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 12px', cursor:'grab', background:dragOver===name?'#eff4ff':'transparent', borderBottom:dragOver===name?'2px solid #2a5298':'2px solid transparent' }}>
                  <span style={{ color:'#d1d5db', fontSize:14 }}>≡</span>
                  <input type="checkbox" checked onChange={()=>toggle(name)} />
                  <span style={{ fontSize:13, color:'#111827', flex:1 }}>{f.label}</span>
                </div>
              )
            })}
            {selected.length>0 && <div style={{ height:1, background:'#f3f4f6', margin:'4px 0' }} />}
            {unselected.filter(name=>allFields.find(x=>x.name===name)?.label.toLowerCase().includes(search.toLowerCase())).map(name=>{
              const f=allFields.find(x=>x.name===name)!
              return (
                <div key={name} onClick={()=>toggle(name)} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 12px', cursor:'pointer' }}>
                  <span style={{ color:'#e5e7eb', fontSize:14 }}>≡</span>
                  <input type="checkbox" checked={false} onChange={()=>toggle(name)} />
                  <span style={{ fontSize:13, color:'#6b7280', flex:1 }}>{f.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function AnsichtDropdown({ views, currentCols, activeViewId, pinnedViewIds, onLoad, onTogglePin, onSave, onUpdate, onDelete }: {
  views: ListView[]; currentCols: string[]; activeViewId: number|null; pinnedViewIds: number[]
  onLoad:(v:ListView)=>void; onTogglePin:(id:number)=>void
  onSave:(name:string,isDefault:boolean,isShared:boolean)=>void
  onUpdate:(id:number,name:string,isDefault:boolean,isShared:boolean)=>void
  onDelete:(id:number)=>void
}) {
  const [open, setOpen]               = useState(false)
  const [mode, setMode]               = useState<'list'|'save'|'edit'>('list')
  const [saveName, setSaveName]       = useState('')
  const [saveDefault, setSaveDefault] = useState(false)
  const [saveShared, setSaveShared]   = useState(false)
  const [editView, setEditView]       = useState<ListView|null>(null)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function h(e:MouseEvent){ if(ref.current&&!ref.current.contains(e.target as Node)){setOpen(false);setMode('list')} }
    document.addEventListener('mousedown',h); return ()=>document.removeEventListener('mousedown',h)
  },[])
  const activeView = views.find(v=>v.id===activeViewId)
  return (
    <div ref={ref} style={{ position:'relative' }}>
      <button onClick={()=>setOpen(o=>!o)} style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', border:'1px solid #d1d5db', borderRadius:6, background:open?'#eff4ff':'#fff', cursor:'pointer', fontSize:13, fontWeight:500, color:open?'#2a5298':'#374151', maxWidth:180, overflow:'hidden' }}>
        <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{activeView?activeView.name:'Ansicht'}</span>
        <span style={{ fontSize:10, color:'#9ca3af', flexShrink:0 }}>▾</span>
      </button>
      {open && (
        <div style={{ position:'absolute', top:'100%', left:0, zIndex:200, marginTop:4, background:'#fff', border:'1px solid #e5e7eb', borderRadius:8, boxShadow:'0 6px 24px rgba(0,0,0,.12)', width:240 }}>
          {mode==='list' && (
            <>
              {views.map(v=>(
                <div key={v.id} style={{ display:'flex', alignItems:'center', padding:'8px 12px', gap:8, background:v.id===activeViewId?'#eff4ff':'transparent', borderLeft:v.id===activeViewId?'3px solid #2a5298':'3px solid transparent' }}>
                  <span onClick={()=>{onLoad(v);setOpen(false)}} style={{ flex:1, fontSize:13, cursor:'pointer', color:v.id===activeViewId?'#2a5298':'#374151', fontWeight:v.id===activeViewId?600:400 }}>
                    {v.name}{v.is_default&&<span style={{ marginLeft:6, fontSize:10, color:'#9ca3af' }}>Standard</span>}{v.is_shared&&<span style={{ marginLeft:4, fontSize:10, color:'#7c3aed' }}>Geteilt</span>}
                  </span>
                  <button onClick={()=>{setEditView(v);setSaveName(v.name);setSaveDefault(v.is_default);setSaveShared(v.is_shared);setMode('edit')}} style={{ background:'none', border:'none', cursor:'pointer', fontSize:12, color:'#9ca3af', padding:'2px 4px' }}>✎</button>
                  <button onClick={()=>onTogglePin(v.id)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:13, color:pinnedViewIds.includes(v.id)?'#2a5298':'#d1d5db', padding:'2px 4px' }}>📌</button>
                  <button onClick={()=>onDelete(v.id)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:12, color:'#dc2626', padding:'2px 4px' }}>✕</button>
                </div>
              ))}
              {views.length===0&&<p style={{ fontSize:13, color:'#9ca3af', padding:'12px', margin:0 }}>Noch keine gespeicherten Ansichten.</p>}
              <div style={{ borderTop:'1px solid #f3f4f6', padding:'8px 12px' }}>
                <button onClick={()=>{setSaveName('');setSaveDefault(false);setSaveShared(false);setMode('save')}} style={{ width:'100%', padding:'7px', background:'#16a34a', color:'#fff', border:'none', borderRadius:5, cursor:'pointer', fontSize:13, fontWeight:600 }}>+ Aktuelle Ansicht speichern</button>
              </div>
            </>
          )}
          {(mode==='save'||mode==='edit') && (
            <div style={{ padding:14 }}>
              <p style={{ fontSize:13, fontWeight:600, margin:'0 0 10px', color:'#111827' }}>{mode==='save'?'Ansicht speichern':'Ansicht bearbeiten'}</p>
              <input autoFocus value={saveName} onChange={e=>setSaveName(e.target.value)} placeholder="Name der Ansicht" style={{ width:'100%', padding:'7px 10px', border:'1px solid #d1d5db', borderRadius:5, fontSize:13, boxSizing:'border-box', marginBottom:8 }} />
              <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, cursor:'pointer', marginBottom:8 }}>
                <input type="checkbox" checked={saveDefault} onChange={e=>setSaveDefault(e.target.checked)} /> Als Standard-Ansicht
              </label>
              <div style={{ marginBottom:12 }}>
                <p style={{ fontSize:12, color:'#6b7280', margin:'0 0 6px', fontWeight:500 }}>Sichtbarkeit</p>
                <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, cursor:'pointer', marginBottom:4 }}>
                  <input type="radio" name="visibility" checked={!saveShared} onChange={()=>setSaveShared(false)} />
                  <span>Nur ich (privat)</span>
                </label>
                <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, cursor:'pointer' }}>
                  <input type="radio" name="visibility" checked={saveShared} onChange={()=>setSaveShared(true)} />
                  <span>Alle Benutzer (geteilt)</span>
                </label>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={()=>setMode('list')} style={{ flex:1, padding:'6px', border:'1px solid #d1d5db', borderRadius:5, cursor:'pointer', fontSize:13, background:'#fff' }}>Abbrechen</button>
                <button disabled={!saveName.trim()} onClick={()=>{ if(mode==='save') onSave(saveName.trim(),saveDefault,saveShared); else if(editView) onUpdate(editView.id,saveName.trim(),saveDefault,saveShared); setMode('list');setOpen(false) }} style={{ flex:1, padding:'6px', background:'#2a5298', color:'#fff', border:'none', borderRadius:5, cursor:'pointer', fontSize:13, fontWeight:600 }}>Speichern</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// operators per field type
function getOperators(fieldType: string) {
  switch (fieldType) {
    case 'date':
      return [
        { value:'eq',        label:'ist'        },
        { value:'lt',        label:'vor'        },
        { value:'gt',        label:'nach'       },
        { value:'between',   label:'zwischen'   },
        { value:'isEmpty',   label:'ist leer'   },
        { value:'isNotEmpty',label:'ist gesetzt'},
      ]
    case 'number': case 'money':
      return [
        { value:'eq',        label:'gleich'     },
        { value:'lt',        label:'kleiner als'},
        { value:'gt',        label:'größer als' },
        { value:'between',   label:'zwischen'   },
        { value:'isEmpty',   label:'ist leer'   },
      ]
    case 'checkbox':
      return [{ value:'eq', label:'ist' }]
    case 'select':
      return [
        { value:'eq',        label:'ist'        },
        { value:'in',        label:'ist eines von'},
        { value:'isEmpty',   label:'ist leer'   },
        { value:'isNotEmpty',label:'ist gesetzt'},
      ]
    case 'group':
      return [
        { value:'in_group',     label:'ist in Gruppe'        },
        { value:'not_in_group', label:'ist nicht in Gruppe'  },
      ]
    default: // text, email, textarea, iban
      return [
        { value:'contains',   label:'enthält'      },
        { value:'eq',         label:'ist'          },
        { value:'startsWith', label:'beginnt mit'  },
        { value:'isEmpty',    label:'ist leer'     },
        { value:'isNotEmpty', label:'ist nicht leer'},
      ]
  }
}
interface Condition { id:number; field:string; operator:string; value:string; value2?:string }
interface Block     { id:number; conditions:Condition[] }
let nextId = 1
const makeCondition = (): Condition => ({ id:nextId++, field:'', operator:'contains', value:'' })
const makeBlock     = (): Block     => ({ id:nextId++, conditions:[makeCondition()] })

export default function SearchPage() {
  const navigate  = useNavigate()
  const [searchParams] = useSearchParams()
  const savedId   = searchParams.get('saved_id') ? Number(searchParams.get('saved_id')) : null
  const qc        = useQueryClient()
  const { data: me } = useMe()
  const canDelete = me?.role === 'admin' || me?.role === 'office'

  const [blocks,      setBlocks]      = useState<Block[]>([makeBlock()])
  const [columns,     setColumns]     = useState<string[]>(DEFAULT_COLS)
  const [activeViewId, setActiveViewId] = useState<number|null>(null)
  const [pinnedViewIds, setPinnedViewIds] = useState<number[]>([])
  const [sortBy,      setSortBy]      = useState('last_name')
  const [sortDir,     setSortDir]     = useState<'asc'|'desc'>('asc')
  const [results,     setResults]     = useState<any[]|null>(null)
  const [total,       setTotal]       = useState(0)
  const [selected,    setSelected]    = useState<Set<number>>(new Set())
  const [deleting,    setDeleting]    = useState(false)
  const [emailModal,  setEmailModal]  = useState(false)
  const [saveSearchOpen, setSaveSearchOpen] = useState(false)
  const [saveSearchName, setSaveSearchName] = useState('')
  const [saveSearchShared, setSaveSearchShared] = useState(false)

  const { data: rawFields  = [] } = useQuery<FieldDef[]>({ queryKey:['fields'],     queryFn:()=>api.get('/fields').then(r=>r.data) })
  const { data: groupsFlat = [] } = useQuery<{id:number;name:string;parent_id:number|null}[]>({
    queryKey:['groups-flat'], queryFn:()=>api.get('/groups').then(r=>r.data)
  })
  const { data: listViews  = [] } = useQuery<ListView[]>({ queryKey:['list-views'], queryFn:()=>api.get('/list-views').then(r=>r.data) })
  const { data: savedSearch } = useQuery<{id:number;name:string;query_json:string;is_shared:boolean}>({
    queryKey:['saved-search', savedId],
    queryFn:()=>api.get('/views').then(r=>(r.data as any[]).find((s:any)=>s.id===savedId)),
    enabled: !!savedId,
  })

  useEffect(() => {
    if (listViews.length > 0 && activeViewId === null) {
      const def = listViews.find(v => v.is_default)
      if (def) { setColumns(def.columns); setActiveViewId(def.id) }
    }
  }, [listViews])

  const allFields: FieldDef[] = [
    ...rawFields.filter(f => !NON_DISPLAYABLE.has(f.name) && f.field_type !== 'file' && f.field_type !== 'image'),
    ...VIRTUAL_FIELDS,
  ]

  // All fields available for search conditions (broader than display fields)
  const GROUP_FIELD: FieldDef = { name:'group', label:'Gruppe', field_type:'group' }
  const searchableFields: FieldDef[] = [
    { name:'', label:'— Feld wählen —', field_type:'text' },
    // standard member fields
    ...rawFields.filter(f =>
      !['photo_url','notes_field'].includes(f.name) &&
      !['file','image'].includes(f.field_type)
    ),
    // virtual
    { name:'age',    label:'Alter',  field_type:'number' },
    GROUP_FIELD,
  ]

  const saveViewMut   = useMutation({ mutationFn:(body:object)=>api.post('/list-views',body),                   onSuccess:(res)=>{qc.invalidateQueries({queryKey:['list-views']});setActiveViewId(res.data.id)} })
  const updateViewMut = useMutation({ mutationFn:({id,body}:{id:number;body:object})=>api.put(`/list-views/${id}`,body), onSuccess:()=>qc.invalidateQueries({queryKey:['list-views']}) })
  const deleteViewMut = useMutation({ mutationFn:(id:number)=>api.delete(`/list-views/${id}`),                 onSuccess:(_,id)=>{qc.invalidateQueries({queryKey:['list-views']});if(activeViewId===id){setActiveViewId(null);setColumns(DEFAULT_COLS)}} })

  const { data: savedSearches = [] } = useQuery<{id:number;name:string;query_json:string;is_shared:boolean;owner_id:number}[]>({
    queryKey:['saved-searches'], queryFn:()=>api.get('/views').then(r=>r.data)
  })
  const saveSearchMut = useMutation({
    mutationFn:(body:object)=>api.post('/views',body),
    onSuccess:()=>{ qc.invalidateQueries({queryKey:['saved-searches']}); setSaveSearchOpen(false); setSaveSearchName('') }
  })

  const searchMut = useMutation({
    mutationFn: () => {
      const conditions = blocks.flatMap(b=>b.conditions)
        .filter(c=>c.value||['isEmpty','isNotEmpty'].includes(c.operator)||c.field==='group')
        .map(c=>({ field:c.field||'last_name', operator:c.operator, value:c.value||null, value2:c.value2||null }))
      return api.post('/members/search', { conditions, logic:'AND', page:1, size:500, sort_by:sortBy, sort_dir:sortDir }).then(r=>r.data)
    },
    onSuccess:(data)=>{ setResults(data.items); setTotal(data.total); setSelected(new Set()) },
  })


  // Load & auto-run saved search when saved_id param changes
  useEffect(() => {
    if (!savedSearch) return
    try {
      const conds = JSON.parse(savedSearch.query_json)
      if (!Array.isArray(conds)) return
      let id = nextId++
      const newBlocks: Block[] = [{ id: id++, conditions: conds.map((c: any) => ({ id: id++, field: c.field, operator: c.operator, value: c.value || '', value2: c.value2 || '' })) }]
      setBlocks(newBlocks)
    } catch { /* ignore */ }
  }, [savedSearch?.id])

  // Auto-run search when blocks are loaded from saved search
  useEffect(() => {
    if (savedSearch && blocks.length > 0 && blocks[0].conditions[0]?.field) {
      searchMut.mutate()
    }
  }, [savedSearch?.id, blocks.length > 0 && blocks[0].conditions[0]?.field ? savedSearch?.id : null])

  function reset() { setBlocks([makeBlock()]); setResults(null); setTotal(0); setSelected(new Set()) }

  function updateCondition(blockId:number, condId:number, patch:Partial<Condition>) {
    setBlocks(bs=>bs.map(b=>b.id!==blockId?b:{...b,conditions:b.conditions.map(c=>c.id!==condId?c:{...c,...patch})}))
  }
  function addCondition(blockId:number) {
    setBlocks(bs=>bs.map(b=>b.id!==blockId?b:{...b,conditions:[...b.conditions,makeCondition()]}))
  }
  function removeCondition(blockId:number, condId:number) {
    setBlocks(bs=>bs.map(b=>b.id!==blockId?b:{...b,conditions:b.conditions.filter(c=>c.id!==condId)}).filter(b=>b.conditions.length>0))
  }
  function togglePin(id:number) {
    setPinnedViewIds(prev=>prev.includes(id)?prev.filter(x=>x!==id):prev.length<4?[...prev,id]:prev)
  }
  function handleSort(name:string) {
    if (name==='age'||name==='groups') return
    sortBy===name ? setSortDir(d=>d==='asc'?'desc':'asc') : (setSortBy(name), setSortDir('asc'))
  }

  const allIds      = (results??[]).map((m:any)=>m.id as number)
  const allSelected = allIds.length>0 && allIds.every(id=>selected.has(id))
  const someSelected= allIds.some(id=>selected.has(id)) && !allSelected

  function toggleAll() { allSelected ? setSelected(new Set()) : setSelected(new Set(allIds)) }

  async function handleBulkDelete() {
    const ids   = Array.from(selected)
    const names = (results??[]).filter((m:any)=>selected.has(m.id)).map((m:any)=>`${m.last_name} ${m.first_name}`).join(', ')
    if (!window.confirm(`${ids.length} Mitglied${ids.length>1?'er':''} löschen?\n\n${names}`)) return
    setDeleting(true)
    for (const id of ids) { try { await api.delete(`/members/${id}`) } catch { /* skip */ } }
    setDeleting(false); setSelected(new Set()); searchMut.mutate()
  }

  const visibleFields = columns.map(name=>allFields.find(f=>f.name===name)).filter(Boolean) as FieldDef[]
  const selCount      = selected.size
  const emailRecipients = (results??[])
    .filter((m:any)=>selected.has(m.id))
    .map((m:any)=>({ id:m.id, name:`${m.last_name} ${m.first_name}`, email:m.email||'' }))
  const emailCount = emailRecipients.filter(r=>r.email).length

  const selStyle: React.CSSProperties = { padding:'7px 10px', border:'1px solid #d1d5db', borderRadius:4, fontSize:14, background:'#fff', cursor:'pointer', width:200 }

  return (
    <div>
      {savedId && savedSearch ? (
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, color: '#111827' }}>{savedSearch.name}</h1>
          {results !== null && <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 6px' }}>{total} Mitglied{total !== 1 ? 'er' : ''}</p>}
          <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 8px' }}>
            {(() => {
              try {
                const conds = JSON.parse(savedSearch.query_json) as any[]
                const ops: Record<string,string> = { contains:'enthält', eq:'ist', startsWith:'beginnt mit', isEmpty:'ist leer', isNotEmpty:'ist gesetzt', lt:'vor', gt:'nach', between:'zwischen', in:'ist eines von', in_group:'in Gruppe', not_in_group:'nicht in Gruppe' }
                return 'Mitglieder mit: ' + conds.map(c => {
                  const fl = allFields.find(f=>f.name===c.field)?.label || c.field
                  const op = ops[c.operator] || c.operator
                  const val = c.value2 ? `${c.value} – ${c.value2}` : (c.value || '')
                  return `${fl} ${op}${val ? ' ' + val : ''}`
                }).join(' und ')
              } catch { return '' }
            })()}
          </p>
          <button onClick={() => navigate('/search', { replace: true })} style={{ background: 'none', border: 'none', color: '#2a5298', cursor: 'pointer', fontSize: 13, padding: 0, textDecoration: 'underline' }}>Bearbeiten</button>
        </div>
      ) : (
        <>
          <h1 style={{ fontSize:22, fontWeight:700, marginBottom:20 }}>Mitglieder suchen</h1>

      {blocks.map((block,bi)=>(
        <div key={block.id} style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:6, padding:'16px 20px', marginBottom:10 }}>
          {bi>0 && <div style={{ fontSize:12, color:'#9ca3af', fontWeight:600, marginBottom:10 }}>ODER</div>}
          {block.conditions.map((cond,ci)=>(
            <div key={cond.id} style={{ display:'flex', gap:10, alignItems:'center', marginBottom:ci<block.conditions.length-1?8:0 }}>
              {ci>0 && <span style={{ fontSize:12, color:'#9ca3af', width:30, flexShrink:0 }}>UND</span>}
              {/* field selector */}
              <select value={cond.field}
                onChange={e => {
                  const newField = e.target.value
                  const fdef = searchableFields.find(f => f.name === newField)
                  const ops  = getOperators(fdef?.field_type ?? 'text')
                  updateCondition(block.id, cond.id, { field: newField, operator: ops[0].value, value: '', value2: '' })
                }}
                style={selStyle}>
                {searchableFields.map(f => <option key={f.name} value={f.name}>{f.label}</option>)}
              </select>

              {/* operator selector */}
              {(() => {
                const fdef = searchableFields.find(f => f.name === cond.field)
                const ops  = getOperators(fdef?.field_type ?? 'text')
                return (
                  <select value={cond.operator}
                    onChange={e => updateCondition(block.id, cond.id, { operator: e.target.value, value: '', value2: '' })}
                    style={{ ...selStyle, width: 160 }}>
                    {ops.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                )
              })()}

              {/* value input — context-aware */}
              {(() => {
                if (cond.operator === 'isEmpty' || cond.operator === 'isNotEmpty') return null
                const fdef = searchableFields.find(f => f.name === cond.field)
                const ft   = fdef?.field_type ?? 'text'
                const inpStyle = { flex:1, padding:'7px 10px', border:'1px solid #d1d5db', borderRadius:4, fontSize:14 } as React.CSSProperties
                const inp2Style = { width:140, padding:'7px 10px', border:'1px solid #d1d5db', borderRadius:4, fontSize:14 } as React.CSSProperties

                if (ft === 'group') {
                  // build recursive tree preserving parent→child hierarchy with depth
                  const buildGroupTree = (groups: typeof groupsFlat) => {
                    const result: { id: number; name: string; depth: number }[] = []
                    const add = (parentId: number | null, depth: number) => {
                      groups
                        .filter(g => g.parent_id === parentId)
                        .sort((a, b) => a.name.localeCompare(b.name, 'de'))
                        .forEach(g => { result.push({ id: g.id, name: g.name, depth }); add(g.id, depth + 1) })
                    }
                    add(null, 0)
                    return result
                  }
                  const treeGroups = buildGroupTree(groupsFlat)
                  return (
                    <select value={cond.value}
                      onChange={e => updateCondition(block.id, cond.id, { value: e.target.value })}
                      style={{ ...inpStyle, flex: 1 }}>
                      <option value="">Gruppe w\u00E4hlen \u2026</option>
                      {treeGroups.map(g => (
                        <option key={g.id} value={String(g.id)}>
                          {'\u00A0'.repeat(g.depth * 3)}{g.depth > 0 ? '\u21B3 ' : ''}{g.name}
                        </option>
                      ))}
                    </select>
                  )
                }

                if (ft === 'checkbox') return (
                  <select value={cond.value}
                    onChange={e => updateCondition(block.id, cond.id, { value: e.target.value })}
                    style={{ ...inpStyle, flex: 1 }}>
                    <option value="true">Ja</option>
                    <option value="false">Nein</option>
                  </select>
                )

                if (ft === 'select') {
                  try {
                    const opts: string[] = JSON.parse(fdef?.options ?? '[]')
                    return (
                      <select value={cond.value}
                        onChange={e => updateCondition(block.id, cond.id, { value: e.target.value })}
                        style={{ ...inpStyle, flex: 1 }}>
                        <option value="">Wert wählen …</option>
                        {opts.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    )
                  } catch { /* fall through to text */ }
                }

                if (ft === 'date') return (
                  <div style={{ display:'flex', gap:6, alignItems:'center', flex:1 }}>
                    <input type="date" value={cond.value}
                      onChange={e => updateCondition(block.id, cond.id, { value: e.target.value })}
                      style={cond.operator === 'between' ? inp2Style : { ...inpStyle, flex:1 }} />
                    {cond.operator === 'between' && <>
                      <span style={{ fontSize:13, color:'#6b7280' }}>bis</span>
                      <input type="date" value={cond.value2 ?? ''}
                        onChange={e => updateCondition(block.id, cond.id, { value2: e.target.value })}
                        style={inp2Style} />
                    </>}
                  </div>
                )

                if (ft === 'number' || ft === 'money') return (
                  <div style={{ display:'flex', gap:6, alignItems:'center', flex:1 }}>
                    <input type="number" value={cond.value}
                      onChange={e => updateCondition(block.id, cond.id, { value: e.target.value })}
                      onKeyDown={e => e.key==='Enter' && searchMut.mutate()}
                      style={cond.operator === 'between' ? inp2Style : { ...inpStyle, flex:1 }} />
                    {cond.operator === 'between' && <>
                      <span style={{ fontSize:13, color:'#6b7280' }}>bis</span>
                      <input type="number" value={cond.value2 ?? ''}
                        onChange={e => updateCondition(block.id, cond.id, { value2: e.target.value })}
                        style={inp2Style} />
                    </>}
                  </div>
                )

                // default: text
                return (
                  <input value={cond.value}
                    onChange={e => updateCondition(block.id, cond.id, { value: e.target.value })}
                    onKeyDown={e => e.key==='Enter' && searchMut.mutate()}
                    style={{ ...inpStyle, flex:1 }} />
                )
              })()}
              {(block.conditions.length>1||blocks.length>1) && (
                <button onClick={()=>removeCondition(block.id,cond.id)} style={{ background:'none', border:'none', color:'#9ca3af', cursor:'pointer', fontSize:18, lineHeight:1, padding:'0 4px' }}>×</button>
              )}
            </div>
          ))}
          <button onClick={()=>addCondition(block.id)} style={{ marginTop:10, background:'none', border:'none', color:'#2a5298', cursor:'pointer', fontSize:13, padding:0 }}>+ Weitere Bedingung</button>
        </div>
      ))}

      <div style={{ background:'#fff', border:'1px dashed #d1d5db', borderRadius:6, padding:'12px 20px', marginBottom:16, textAlign:'center' }}>
        <button onClick={()=>setBlocks(bs=>[...bs,makeBlock()])} style={{ background:'none', border:'none', color:'#2a5298', cursor:'pointer', fontSize:13 }}>+ ODER-Block hinzufügen</button>
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:24 }}>
        <button onClick={()=>searchMut.mutate()} disabled={searchMut.isPending}
          style={{ padding:'9px 28px', background:'#5a8a3c', color:'#fff', border:'none', borderRadius:4, fontWeight:600, fontSize:14, cursor:'pointer' }}>
          {searchMut.isPending?'Suche…':'Suchen'}
        </button>
        <button onClick={reset} style={{ background:'none', border:'none', color:'#6b7280', cursor:'pointer', fontSize:14 }}>Zurücksetzen</button>
        <button onClick={()=>setSaveSearchOpen(o=>!o)} style={{ background:'none', border:'1px solid #d1d5db', borderRadius:4, color:'#374151', cursor:'pointer', fontSize:13, padding:'8px 14px' }}>
          🔖 Suche speichern
        </button>
      </div>
      {saveSearchOpen && (
        <div style={{ background:'#f9fafb', border:'1px solid #e5e7eb', borderRadius:8, padding:16, marginBottom:16, maxWidth:360 }}>
          <p style={{ fontSize:13, fontWeight:600, margin:'0 0 10px', color:'#111827' }}>Suche speichern</p>
          <input autoFocus value={saveSearchName} onChange={e=>setSaveSearchName(e.target.value)} placeholder="Name der Suche" style={{ width:'100%', padding:'7px 10px', border:'1px solid #d1d5db', borderRadius:5, fontSize:13, boxSizing:'border-box', marginBottom:10 }} />
          <div style={{ marginBottom:12 }}>
            <p style={{ fontSize:12, color:'#6b7280', margin:'0 0 6px', fontWeight:500 }}>Sichtbarkeit</p>
            <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, cursor:'pointer', marginBottom:4 }}>
              <input type="radio" name="ss-visibility" checked={!saveSearchShared} onChange={()=>setSaveSearchShared(false)} />
              Nur ich (privat)
            </label>
            <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, cursor:'pointer' }}>
              <input type="radio" name="ss-visibility" checked={saveSearchShared} onChange={()=>setSaveSearchShared(true)} />
              Alle Benutzer (geteilt)
            </label>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={()=>setSaveSearchOpen(false)} style={{ flex:1, padding:'6px', border:'1px solid #d1d5db', borderRadius:5, cursor:'pointer', fontSize:13, background:'#fff' }}>Abbrechen</button>
            <button disabled={!saveSearchName.trim()||saveSearchMut.isPending} onClick={()=>{
              const conditions = blocks.flatMap(b=>b.conditions)
                .filter(c=>c.value||['isEmpty','isNotEmpty'].includes(c.operator)||c.field==='group')
                .map(c=>({ field:c.field||'last_name', operator:c.operator, value:c.value||null, value2:c.value2||null }))
              saveSearchMut.mutate({ name:saveSearchName.trim(), query_json:JSON.stringify(conditions), is_shared:saveSearchShared })
            }} style={{ flex:1, padding:'6px', background:'#2a5298', color:'#fff', border:'none', borderRadius:5, cursor:'pointer', fontSize:13, fontWeight:600 }}>
              {saveSearchMut.isPending?'…':'Speichern'}
            </button>
          </div>
        </div>
      )}

        </>
      )}

      {results !== null && (
        <div>
          <div style={{ display:'flex', gap:8, marginBottom:selCount>0?0:12, alignItems:'center', flexWrap:'wrap' }}>
            <FelderDropdown allFields={allFields} columns={columns} onChange={cols=>{setColumns(cols);setActiveViewId(null)}} />
            <AnsichtDropdown
              views={listViews} currentCols={columns} activeViewId={activeViewId} pinnedViewIds={pinnedViewIds}
              onLoad={v=>{setColumns(v.columns);setActiveViewId(v.id)}}
              onTogglePin={togglePin}
              onSave={(name,isDefault,isShared)=>saveViewMut.mutate({name,columns,is_default:isDefault,is_shared:isShared})}
              onUpdate={(id,name,isDefault,isShared)=>updateViewMut.mutate({id,body:{name,columns,is_default:isDefault,is_shared:isShared}})}
              onDelete={id=>deleteViewMut.mutate(id)}
            />
            {pinnedViewIds.map(id=>{
              const v=listViews.find(x=>x.id===id); if(!v) return null
              const isActive=activeViewId===id
              return (
                <button key={id} onClick={()=>{setColumns(v.columns);setActiveViewId(v.id)}}
                  style={{ padding:'6px 14px', borderRadius:20, fontSize:13, fontWeight:500, cursor:'pointer', whiteSpace:'nowrap', background:isActive?'#2a5298':'#fff', color:isActive?'#fff':'#374151', border:isActive?'none':'1px solid #d1d5db' }}>
                  {v.name}
                </button>
              )
            })}
            <span style={{ fontSize:13, color:'#6b7280', marginLeft:8 }}>{total} Ergebnis{total!==1?'se':''}</span>
          </div>

          {selCount > 0 && (
            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 16px', margin:'8px 0 12px', background:'#eff4ff', border:'1px solid #c7d2fe', borderRadius:7, flexWrap:'wrap' }}>
              <span style={{ fontSize:13, fontWeight:600, color:'#2a5298', marginRight:4 }}>{selCount} ausgewählt</span>
              <div style={{ width:1, height:18, background:'#c7d2fe' }} />
              <button onClick={()=>setEmailModal(true)}
                style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 14px', background:'#2a5298', color:'#fff', border:'none', borderRadius:5, cursor:'pointer', fontSize:13, fontWeight:600 }}>
                ✉️ E-Mail senden{emailCount>0?` (${emailCount})`:''}
              </button>
              {canDelete && (
                <button onClick={handleBulkDelete} disabled={deleting}
                  style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 14px', background:deleting?'#9ca3af':'#ef4444', color:'#fff', border:'none', borderRadius:5, cursor:deleting?'not-allowed':'pointer', fontSize:13, fontWeight:600 }}>
                  {deleting?'⏳ Löscht…':'🗑 Löschen'}
                </button>
              )}
              <button onClick={()=>setSelected(new Set())}
                style={{ marginLeft:'auto', padding:'5px 12px', background:'none', border:'1px solid #c7d2fe', borderRadius:5, cursor:'pointer', fontSize:12, color:'#6b7280' }}>
                Auswahl aufheben
              </button>
            </div>
          )}

          {results.length===0 ? (
            <div style={{ background:'#fff', padding:24, borderRadius:6, border:'1px solid #e5e7eb', color:'#6b7280' }}>Keine Mitglieder gefunden.</div>
          ) : (
            <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:8, overflow:'hidden' }}>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', minWidth:500 }}>
                  <thead>
                    <tr style={{ background:'#f9fafb', borderBottom:'2px solid #e5e7eb' }}>
                      <th style={{ padding:'10px 12px', width:36 }}>
                        <input type="checkbox" ref={el=>{ if(el){ el.indeterminate=someSelected; el.checked=allSelected } }}
                          onChange={toggleAll} style={{ cursor:'pointer', accentColor:'#2a5298', width:15, height:15 }} />
                      </th>
                      {visibleFields.map(f=>{
                        const sortable=f.name!=='age'&&f.name!=='groups'; const active=sortBy===f.name
                        return (
                          <th key={f.name} onClick={sortable?()=>handleSort(f.name):undefined}
                            style={{ padding:'10px 12px', fontSize:11, fontWeight:700, color:active?'#2a5298':'#6b7280', textAlign:'left', textTransform:'uppercase', letterSpacing:'0.05em', cursor:sortable?'pointer':'default', userSelect:'none', whiteSpace:'nowrap' }}>
                            {f.label}{active?(sortDir==='asc'?' ▲':' ▼'):''}
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((m:any)=>{
                      const isSelected=selected.has(m.id)
                      return (
                        <tr key={m.id}
                          style={{ borderTop:'1px solid #f3f4f6', cursor:'pointer', background:isSelected?'#eff4ff':'transparent', transition:'background .08s' }}
                          onClick={()=>navigate(`/members/${m.id}`)}
                          onMouseEnter={e=>{ if(!isSelected)(e.currentTarget as HTMLElement).style.background='#f9fafb' }}
                          onMouseLeave={e=>{ (e.currentTarget as HTMLElement).style.background=isSelected?'#eff4ff':'' }}>
                          <td style={{ padding:'9px 12px', width:36 }} onClick={e=>e.stopPropagation()}>
                            <input type="checkbox" checked={isSelected}
                              onChange={()=>setSelected(prev=>{ const n=new Set(prev); isSelected?n.delete(m.id):n.add(m.id); return n })}
                              style={{ cursor:'pointer', accentColor:'#2a5298', width:15, height:15 }} />
                          </td>
                          {visibleFields.map(f=>(
                            <td key={f.name} style={{ padding:'9px 12px', fontSize:13, color:f.name==='last_name'||f.name==='first_name'?'#111827':'#374151', fontWeight:f.name==='last_name'?500:400, whiteSpace:'nowrap' }}>
                              {formatCell(m[f.name],f.field_type,f.name)}
                            </td>
                          ))}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {emailModal && (
        <EmailComposeModal recipients={emailRecipients} onClose={()=>setEmailModal(false)} />
      )}
    </div>
  )
}
