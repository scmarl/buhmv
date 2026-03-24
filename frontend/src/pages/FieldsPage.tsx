import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../api/client'

type FieldType =
  | 'text' | 'textarea' | 'number' | 'money' | 'date' | 'email'
  | 'select' | 'checkbox' | 'file' | 'image'

interface Field {
  id: number
  name: string
  label: string
  field_type: FieldType
  category: string | null
  options: string | null
  default_value: string | null
  is_required: boolean
  sort_order: number
  is_system: boolean
}

interface FieldForm {
  label: string
  field_type: FieldType
  category: string
  options: string[]
  default_value: string
  is_required: boolean
  sort_order: number
}

const TYPE_LABELS: Record<FieldType, string> = {
  text: 'Text (einzeilig)',
  textarea: 'Text (mehrzeilig)',
  number: 'Zahl',
  money: 'Betrag (€)',
  date: 'Datum',
  email: 'E-Mail-Adresse',
  select: 'Auswahl',
  checkbox: 'Checkbox (Ja/Nein)',
  file: 'Datei-Upload',
  image: 'Bild-Upload',
}

const TYPE_ICONS: Record<FieldType, string> = {
  text: 'T',
  textarea: '≡',
  number: '#',
  money: '€',
  date: '📅',
  email: '@',
  select: '▾',
  checkbox: '☑',
  file: '📎',
  image: '🖼',
}

function parseOptions(raw: string | null): string[] {
  if (!raw) return []
  try { return JSON.parse(raw) } catch { return [] }
}

// ── Default Value Input ───────────────────────────────────────────────────────

function DefaultValueInput({
  fieldType,
  options,
  value,
  onChange,
}: {
  fieldType: FieldType
  options: string[]
  value: string
  onChange: (v: string) => void
}) {
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '7px 10px', border: '1px solid #d1d5db',
    borderRadius: 6, fontSize: 14, boxSizing: 'border-box',
  }

  if (fieldType === 'checkbox') {
    return (
      <select style={inputStyle} value={value} onChange={e => onChange(e.target.value)}>
        <option value="">— kein Standard —</option>
        <option value="true">Ja</option>
        <option value="false">Nein</option>
      </select>
    )
  }

  if (fieldType === 'select') {
    return (
      <select style={inputStyle} value={value} onChange={e => onChange(e.target.value)}>
        <option value="">— kein Standard —</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    )
  }

  if (fieldType === 'number' || fieldType === 'money') {
    return (
      <input type="number" style={inputStyle} value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="z.B. 0" />
    )
  }

  if (fieldType === 'date') {
    return (
      <input type="date" style={inputStyle} value={value}
        onChange={e => onChange(e.target.value)} />
    )
  }

  if (fieldType === 'email') {
    return (
      <input type="email" style={inputStyle} value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="z.B. info@verein.de" />
    )
  }

  if (fieldType === 'file' || fieldType === 'image') {
    return (
      <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>
        Kein Standardwert für Datei-/Bild-Felder.
      </p>
    )
  }

  // text / textarea
  return (
    <input type="text" style={inputStyle} value={value}
      onChange={e => onChange(e.target.value)}
      placeholder="Standardtext eingeben" />
  )
}

// ── Context Menu ──────────────────────────────────────────────────────────────

function ContextMenu({
  items,
  onClose,
}: {
  items: { label: string; onClick: () => void; danger?: boolean }[]
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div ref={ref} style={{
      position: 'absolute', right: 0, top: '100%', zIndex: 100,
      background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
      boxShadow: '0 4px 16px rgba(0,0,0,0.10)', minWidth: 180, padding: '4px 0',
    }}>
      {items.map(item => (
        <button key={item.label} onClick={() => { item.onClick(); onClose() }}
          style={{
            display: 'block', width: '100%', textAlign: 'left',
            padding: '8px 16px', background: 'none', border: 'none',
            cursor: 'pointer', fontSize: 14,
            color: item.danger ? '#dc2626' : '#111827',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#f3f4f6')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

// ── Field Modal ───────────────────────────────────────────────────────────────

function FieldModal({
  initial,
  isSystem,
  categories,
  onSave,
  onClose,
  title,
}: {
  initial: FieldForm
  isSystem: boolean
  categories: string[]
  onSave: (form: FieldForm & { name?: string }) => void
  onClose: () => void
  title: string
}) {
  const isNew = title.startsWith('Neues')
  const [form, setForm] = useState<FieldForm & { name?: string }>({
    ...initial,
    name: isNew ? '' : undefined,
  })
  const [newOption, setNewOption] = useState('')
  const [newCat, setNewCat] = useState('')
  const [catMode, setCatMode] = useState<'select' | 'new'>('select')

  function set(k: string, v: unknown) {
    setForm(f => {
      const next = { ...f, [k]: v }
      // Reset default_value when type changes (incompatible)
      if (k === 'field_type') next.default_value = ''
      return next
    })
  }

  function addOption() {
    const o = newOption.trim()
    if (o && !form.options.includes(o)) {
      set('options', [...form.options, o])
      setNewOption('')
    }
  }

  function removeOption(o: string) {
    set('options', form.options.filter(x => x !== o))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const finalCat = catMode === 'new' ? newCat.trim() || 'Allgemein' : form.category
    onSave({ ...form, category: finalCat })
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '7px 10px', border: '1px solid #d1d5db',
    borderRadius: 6, fontSize: 14, boxSizing: 'border-box',
  }
  const lbl: React.CSSProperties = {
    display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4,
  }
  const noDefault = form.field_type === 'file' || form.field_type === 'image'

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, padding: 28, width: 500,
        maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: 0 }}>{title}</h2>
          {isSystem && (
            <span style={{
              fontSize: 11, fontWeight: 600, background: '#fef3c7', color: '#92400e',
              borderRadius: 20, padding: '2px 10px', border: '1px solid #fde68a',
            }}>Systemfeld</span>
          )}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {isNew && (
            <div>
              <label style={lbl}>Interner Name <span style={{ color: '#dc2626' }}>*</span></label>
              <input style={inp} value={form.name ?? ''} onChange={e => set('name', e.target.value)}
                placeholder="z.B. vereins_nr" required />
              <p style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>Technischer Bezeichner (eindeutig, keine Leerzeichen)</p>
            </div>
          )}

          <div>
            <label style={lbl}>Bezeichnung <span style={{ color: '#dc2626' }}>*</span></label>
            <input style={inp} value={form.label} onChange={e => set('label', e.target.value)}
              placeholder="z.B. Vereinsnummer" required />
          </div>

          <div>
            <label style={lbl}>Feldtyp</label>
            {isSystem ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input style={{ ...inp, background: '#f9fafb', color: '#6b7280' }}
                  value={TYPE_LABELS[form.field_type] ?? form.field_type} readOnly />
                <span style={{ fontSize: 12, color: '#9ca3af', whiteSpace: 'nowrap' }}>🔒 nicht änderbar</span>
              </div>
            ) : (
              <select style={inp} value={form.field_type}
                onChange={e => set('field_type', e.target.value as FieldType)}>
                {(Object.keys(TYPE_LABELS) as FieldType[]).map(t => (
                  <option key={t} value={t}>{TYPE_ICONS[t]} {TYPE_LABELS[t]}</option>
                ))}
              </select>
            )}
          </div>

          {/* Select options */}
          {form.field_type === 'select' && (
            <div>
              <label style={lbl}>Auswahloptionen</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {form.options.map(o => (
                  <span key={o} style={{
                    background: '#e0f2fe', color: '#0369a1', borderRadius: 20,
                    padding: '2px 10px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    {o}
                    <button type="button" onClick={() => removeOption(o)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0369a1', padding: 0, fontSize: 14 }}>×</button>
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input style={{ ...inp, flex: 1 }} value={newOption}
                  onChange={e => setNewOption(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addOption())}
                  placeholder="Option eingeben + Enter" />
                <button type="button" onClick={addOption}
                  style={{ padding: '7px 14px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
                  + Hinzu
                </button>
              </div>
            </div>
          )}

          {/* Default value */}
          {!noDefault && (
            <div>
              <label style={lbl}>Standardwert</label>
              <DefaultValueInput
                fieldType={form.field_type}
                options={form.options}
                value={form.default_value}
                onChange={v => set('default_value', v)}
              />
              <p style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                Wird beim Anlegen eines neuen Mitglieds automatisch vorausgefüllt.
              </p>
            </div>
          )}

          {/* Category */}
          <div>
            <label style={lbl}>Kategorie</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: catMode === 'new' ? 8 : 0 }}>
              {(['select', 'new'] as const).map(m => (
                <button key={m} type="button" onClick={() => setCatMode(m)}
                  style={{
                    padding: '4px 12px', borderRadius: 6, fontSize: 13, cursor: 'pointer',
                    background: catMode === m ? '#2a5298' : '#f3f4f6',
                    color: catMode === m ? '#fff' : '#374151',
                    border: '1px solid ' + (catMode === m ? '#2a5298' : '#d1d5db'),
                  }}>
                  {m === 'select' ? 'Bestehende' : 'Neue anlegen'}
                </button>
              ))}
            </div>
            {catMode === 'select' ? (
              <select style={inp} value={form.category} onChange={e => set('category', e.target.value)}>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
                {!categories.includes('Allgemein') && <option value="Allgemein">Allgemein</option>}
              </select>
            ) : (
              <input style={inp} value={newCat} onChange={e => setNewCat(e.target.value)}
                placeholder="Neue Kategorie eingeben" />
            )}
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.is_required} onChange={e => set('is_required', e.target.checked)}
              style={{ width: 16, height: 16 }} />
            <span style={{ fontSize: 14, color: '#374151' }}>Pflichtfeld</span>
          </label>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6 }}>
            <button type="button" onClick={onClose}
              style={{ padding: '8px 18px', borderRadius: 7, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 14 }}>
              Abbrechen
            </button>
            <button type="submit"
              style={{ padding: '8px 20px', borderRadius: 7, border: 'none', background: '#16a34a', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
              Speichern
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Category Modal ────────────────────────────────────────────────────────────

function CategoryModal({ onSave, onClose }: { onSave: (n: string) => void; onClose: () => void }) {
  const [name, setName] = useState('')
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: 360, boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 18, color: '#111827' }}>Neue Kategorie</h2>
        <input autoFocus value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && name.trim() && onSave(name.trim())}
          placeholder="Kategoriename"
          style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, boxSizing: 'border-box', marginBottom: 16 }} />
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose}
            style={{ padding: '8px 18px', borderRadius: 7, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 14 }}>Abbrechen</button>
          <button disabled={!name.trim()} onClick={() => name.trim() && onSave(name.trim())}
            style={{ padding: '8px 18px', borderRadius: 7, border: 'none', background: '#16a34a', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>Anlegen</button>
        </div>
      </div>
    </div>
  )
}

// ── Delete Confirm ────────────────────────────────────────────────────────────

function DeleteConfirmModal({ field, onConfirm, onClose }: { field: Field; onConfirm: () => void; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: 400, boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: '#111827' }}>Feld löschen</h2>
        <p style={{ fontSize: 14, color: '#374151', marginBottom: 8 }}>
          Soll das Datenfeld <strong>„{field.label}"</strong> wirklich gelöscht werden?
        </p>
        <p style={{ fontSize: 13, color: '#dc2626', background: '#fef2f2', borderRadius: 6, padding: '8px 12px', marginBottom: 20 }}>
          Alle gespeicherten Werte dieses Feldes werden unwiderruflich gelöscht.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose}
            style={{ padding: '8px 18px', borderRadius: 7, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 14 }}>Abbrechen</button>
          <button onClick={onConfirm}
            style={{ padding: '8px 18px', borderRadius: 7, border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>Löschen</button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function FieldsPage() {
  const qc = useQueryClient()
  const [menuFieldId, setMenuFieldId] = useState<number | null>(null)
  const [editField, setEditField] = useState<Field | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [showCatModal, setShowCatModal] = useState(false)
  const [deleteField, setDeleteField] = useState<Field | null>(null)
  const [pendingCategory, setPendingCategory] = useState<string | null>(null)

  const { data: fields = [], isLoading } = useQuery<Field[]>({
    queryKey: ['fields'],
    queryFn: () => api.get('/fields').then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: (body: object) => api.post('/fields', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fields'] }); setShowCreate(false); setPendingCategory(null) },
  })
  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: object }) => api.put(`/fields/${id}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fields'] }); setEditField(null) },
  })
  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(`/fields/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fields'] }); setDeleteField(null) },
  })

  // Group by category
  const grouped: Record<string, Field[]> = {}
  for (const f of fields) {
    const cat = f.category ?? 'Allgemein'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(f)
  }
  if (pendingCategory && !grouped[pendingCategory]) grouped[pendingCategory] = []

  const allCategories = [...new Set([...Object.keys(grouped), 'Allgemein'])].sort()
  const categoryOrder = ['Stammdaten', 'Kontakt', 'Mitgliedschaft', 'Sonstiges']
  const sortedCategories = [
    ...categoryOrder.filter(c => grouped[c]),
    ...Object.keys(grouped).filter(c => !categoryOrder.includes(c)).sort(),
  ]

  function handleSave(form: FieldForm & { name?: string }) {
    const body = {
      name: form.name,
      label: form.label,
      field_type: form.field_type,
      category: form.category,
      options: form.options.length ? form.options : null,
      default_value: form.default_value || null,
      is_required: form.is_required,
      sort_order: form.sort_order,
    }
    if (editField) {
      updateMut.mutate({ id: editField.id, body })
    } else {
      createMut.mutate(body)
    }
  }

  const emptyForm: FieldForm = {
    label: '', field_type: 'text',
    category: pendingCategory ?? 'Allgemein',
    options: [], default_value: '', is_required: false, sort_order: 0,
  }

  function defaultValueDisplay(field: Field): string | null {
    if (!field.default_value) return null
    if (field.field_type === 'checkbox') return field.default_value === 'true' ? 'Standard: Ja' : 'Standard: Nein'
    return `Standard: ${field.default_value}`
  }

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '32px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>Datenfelder</h1>
          <p style={{ fontSize: 14, color: '#6b7280', marginTop: 4 }}>
            Verwalte Standard- und benutzerdefinierte Felder für Mitglieder.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setShowCatModal(true)}
            style={{ padding: '8px 16px', borderRadius: 7, border: '1px solid #2a5298', background: '#fff', color: '#2a5298', cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>
            + Neue Kategorie
          </button>
          <button onClick={() => { setPendingCategory(null); setShowCreate(true) }}
            style={{ padding: '8px 16px', borderRadius: 7, border: 'none', background: '#16a34a', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
            + Neues Datenfeld
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 20, fontSize: 12, color: '#6b7280' }}>
        <span>🔒 = Systemfeld (Typ nicht änderbar, nicht löschbar)</span>
      </div>

      {isLoading && <p style={{ color: '#6b7280' }}>Lade Felder…</p>}

      {!isLoading && sortedCategories.map(cat => (
        <div key={cat} style={{ marginBottom: 28 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 0', borderBottom: '2px solid #e5e7eb', marginBottom: 6,
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {cat}
              <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 400, color: '#9ca3af', textTransform: 'none', letterSpacing: 0 }}>
                {grouped[cat]?.length ?? 0} Felder
              </span>
            </span>
            <button onClick={() => { setPendingCategory(cat); setShowCreate(true) }}
              style={{ fontSize: 12, color: '#2a5298', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>
              + Feld hinzufügen
            </button>
          </div>

          {(grouped[cat] ?? []).length === 0 && (
            <p style={{ fontSize: 13, color: '#9ca3af', padding: '8px 0' }}>Keine Felder in dieser Kategorie.</p>
          )}

          {(grouped[cat] ?? []).map(field => {
            const defVal = defaultValueDisplay(field)
            return (
              <div key={field.id} style={{
                display: 'flex', alignItems: 'center', padding: '10px 12px',
                background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 5, gap: 12,
              }}>
                <span style={{ color: '#d1d5db', fontSize: 16, cursor: 'grab', userSelect: 'none' }}>⠿</span>

                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <span style={{
                    width: 32, height: 32, background: field.is_system ? '#eff6ff' : '#f3f4f6',
                    borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, border: field.is_system ? '1px solid #bfdbfe' : '1px solid #e5e7eb',
                  }}>
                    {TYPE_ICONS[field.field_type as FieldType] ?? '?'}
                  </span>
                  {field.is_system && (
                    <span style={{ position: 'absolute', top: -4, right: -4, fontSize: 10 }}>🔒</span>
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: '#2a5298', fontSize: 14 }}>
                    {field.label}
                    {field.is_required && <span style={{ color: '#dc2626', marginLeft: 4, fontSize: 12 }}>*</span>}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 1, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span>{TYPE_LABELS[field.field_type as FieldType] ?? field.field_type}</span>
                    {field.field_type === 'select' && parseOptions(field.options).length > 0 && (
                      <span style={{ color: '#9ca3af' }}>({parseOptions(field.options).join(', ')})</span>
                    )}
                    {defVal && (
                      <span style={{
                        background: '#f0fdf4', color: '#15803d', borderRadius: 4,
                        padding: '0 6px', fontSize: 11, border: '1px solid #bbf7d0',
                      }}>{defVal}</span>
                    )}
                  </div>
                </div>

                <div style={{ position: 'relative' }}>
                  <button onClick={() => setMenuFieldId(menuFieldId === field.id ? null : field.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#6b7280', padding: '0 6px', lineHeight: 1, borderRadius: 4 }}
                    title="Optionen">···</button>
                  {menuFieldId === field.id && (
                    <ContextMenu
                      items={[
                        { label: 'Feld bearbeiten', onClick: () => setEditField(field) },
                        ...(!field.is_system ? [{ label: 'Feld löschen', onClick: () => setDeleteField(field), danger: true }] : []),
                      ]}
                      onClose={() => setMenuFieldId(null)}
                    />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ))}

      {!isLoading && fields.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <p style={{ fontSize: 15 }}>Keine Felder vorhanden.</p>
        </div>
      )}

      {showCreate && (
        <FieldModal title="Neues Datenfeld" isSystem={false}
          initial={{ ...emptyForm, category: pendingCategory ?? 'Allgemein' }}
          categories={allCategories}
          onSave={handleSave}
          onClose={() => { setShowCreate(false); setPendingCategory(null) }} />
      )}
      {editField && (
        <FieldModal
          title={editField.is_system ? 'Systemfeld bearbeiten' : 'Datenfeld bearbeiten'}
          isSystem={editField.is_system}
          initial={{
            label: editField.label,
            field_type: editField.field_type,
            category: editField.category ?? 'Allgemein',
            options: parseOptions(editField.options),
            default_value: editField.default_value ?? '',
            is_required: editField.is_required,
            sort_order: editField.sort_order,
          }}
          categories={allCategories}
          onSave={handleSave}
          onClose={() => setEditField(null)} />
      )}
      {showCatModal && (
        <CategoryModal
          onSave={name => { setPendingCategory(name); setShowCatModal(false); setShowCreate(true) }}
          onClose={() => setShowCatModal(false)} />
      )}
      {deleteField && (
        <DeleteConfirmModal field={deleteField}
          onConfirm={() => deleteMut.mutate(deleteField.id)}
          onClose={() => setDeleteField(null)} />
      )}
    </div>
  )
}
