import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../api/client'

// ── Types ────────────────────────────────────────────────────────────────────

type FieldType =
  | 'text' | 'textarea' | 'number' | 'money' | 'date'
  | 'select' | 'checkbox' | 'file' | 'image'

interface Field {
  id: number
  name: string
  label: string
  field_type: FieldType
  category: string | null
  options: string | null   // JSON string
  is_required: boolean
  sort_order: number
}

interface FieldForm {
  label: string
  field_type: FieldType
  category: string
  options: string[]
  is_required: boolean
  sort_order: number
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<FieldType, string> = {
  text: 'Text (einzeilig)',
  textarea: 'Text (mehrzeilig)',
  number: 'Zahl',
  money: 'Betrag (€)',
  date: 'Datum',
  select: 'Auswahl',
  checkbox: 'Checkbox (Ja/Nein)',
  file: 'Datei-Upload',
  image: 'Bild-Upload',
}

const TYPE_ICONS: Record<FieldType, string> = {
  text: '𝐓',
  textarea: '≡',
  number: '#',
  money: '€',
  date: '📅',
  select: '▾',
  checkbox: '☑',
  file: '📎',
  image: '🖼',
}

function parseOptions(raw: string | null): string[] {
  if (!raw) return []
  try { return JSON.parse(raw) } catch { return [] }
}

// ── Context Menu ─────────────────────────────────────────────────────────────

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
    <div
      ref={ref}
      style={{
        position: 'absolute', right: 0, top: '100%', zIndex: 100,
        background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
        boxShadow: '0 4px 16px rgba(0,0,0,0.10)', minWidth: 180, padding: '4px 0',
      }}
    >
      {items.map((item) => (
        <button
          key={item.label}
          onClick={() => { item.onClick(); onClose() }}
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
  categories,
  onSave,
  onClose,
  title,
}: {
  initial: FieldForm
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
    setForm(f => ({ ...f, [k]: v }))
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

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '7px 10px', border: '1px solid #d1d5db',
    borderRadius: 6, fontSize: 14, boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 13, fontWeight: 600,
    color: '#374151', marginBottom: 4,
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, padding: 28, width: 480,
        maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: '#111827' }}>
          {title}
        </h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Name (only for new fields) */}
          {isNew && (
            <div>
              <label style={labelStyle}>Interner Name <span style={{ color: '#dc2626' }}>*</span></label>
              <input
                style={inputStyle}
                value={form.name ?? ''}
                onChange={e => set('name', e.target.value)}
                placeholder="z.B. mitglieds_nr"
                required
              />
              <p style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                Technischer Bezeichner (keine Leerzeichen, eindeutig)
              </p>
            </div>
          )}

          {/* Label */}
          <div>
            <label style={labelStyle}>Bezeichnung <span style={{ color: '#dc2626' }}>*</span></label>
            <input
              style={inputStyle}
              value={form.label}
              onChange={e => set('label', e.target.value)}
              placeholder="z.B. Mitgliedsnummer"
              required
            />
          </div>

          {/* Type */}
          <div>
            <label style={labelStyle}>Feldtyp <span style={{ color: '#dc2626' }}>*</span></label>
            <select
              style={inputStyle}
              value={form.field_type}
              onChange={e => set('field_type', e.target.value as FieldType)}
            >
              {(Object.keys(TYPE_LABELS) as FieldType[]).map(t => (
                <option key={t} value={t}>{TYPE_ICONS[t]} {TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>

          {/* Select options */}
          {form.field_type === 'select' && (
            <div>
              <label style={labelStyle}>Auswahloptionen</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {form.options.map(o => (
                  <span key={o} style={{
                    background: '#e0f2fe', color: '#0369a1',
                    borderRadius: 20, padding: '2px 10px', fontSize: 13,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    {o}
                    <button type="button" onClick={() => removeOption(o)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0369a1', padding: 0, fontSize: 14 }}>×</button>
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  value={newOption}
                  onChange={e => setNewOption(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addOption())}
                  placeholder="Option eingeben + Enter"
                />
                <button type="button" onClick={addOption}
                  style={{
                    padding: '7px 14px', background: '#f3f4f6',
                    border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer', fontSize: 13,
                  }}>
                  + Hinzufügen
                </button>
              </div>
            </div>
          )}

          {/* Category */}
          <div>
            <label style={labelStyle}>Kategorie</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: catMode === 'new' ? 8 : 0 }}>
              <button type="button"
                onClick={() => setCatMode('select')}
                style={{
                  padding: '4px 12px', borderRadius: 6, fontSize: 13, cursor: 'pointer',
                  background: catMode === 'select' ? '#2a5298' : '#f3f4f6',
                  color: catMode === 'select' ? '#fff' : '#374151',
                  border: '1px solid ' + (catMode === 'select' ? '#2a5298' : '#d1d5db'),
                }}>
                Bestehende
              </button>
              <button type="button"
                onClick={() => setCatMode('new')}
                style={{
                  padding: '4px 12px', borderRadius: 6, fontSize: 13, cursor: 'pointer',
                  background: catMode === 'new' ? '#2a5298' : '#f3f4f6',
                  color: catMode === 'new' ? '#fff' : '#374151',
                  border: '1px solid ' + (catMode === 'new' ? '#2a5298' : '#d1d5db'),
                }}>
                Neue anlegen
              </button>
            </div>
            {catMode === 'select' ? (
              <select style={inputStyle} value={form.category} onChange={e => set('category', e.target.value)}>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
                {!categories.includes('Allgemein') && <option value="Allgemein">Allgemein</option>}
              </select>
            ) : (
              <input
                style={inputStyle}
                value={newCat}
                onChange={e => setNewCat(e.target.value)}
                placeholder="Neue Kategorie eingeben"
              />
            )}
          </div>

          {/* Required */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.is_required}
              onChange={e => set('is_required', e.target.checked)}
              style={{ width: 16, height: 16 }}
            />
            <span style={{ fontSize: 14, color: '#374151' }}>Pflichtfeld</span>
          </label>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6 }}>
            <button type="button" onClick={onClose}
              style={{
                padding: '8px 18px', borderRadius: 7, border: '1px solid #d1d5db',
                background: '#fff', cursor: 'pointer', fontSize: 14, color: '#374151',
              }}>
              Abbrechen
            </button>
            <button type="submit"
              style={{
                padding: '8px 20px', borderRadius: 7, border: 'none',
                background: '#16a34a', color: '#fff', cursor: 'pointer',
                fontSize: 14, fontWeight: 600,
              }}>
              Speichern
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Category Name Modal ───────────────────────────────────────────────────────

function CategoryModal({
  onSave,
  onClose,
}: {
  onSave: (name: string) => void
  onClose: () => void
}) {
  const [name, setName] = useState('')
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, padding: 28, width: 360,
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 18, color: '#111827' }}>
          Neue Kategorie
        </h2>
        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && name.trim() && onSave(name.trim())}
          placeholder="Kategoriename"
          style={{
            width: '100%', padding: '8px 10px', border: '1px solid #d1d5db',
            borderRadius: 6, fontSize: 14, boxSizing: 'border-box', marginBottom: 16,
          }}
        />
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose}
            style={{
              padding: '8px 18px', borderRadius: 7, border: '1px solid #d1d5db',
              background: '#fff', cursor: 'pointer', fontSize: 14,
            }}>
            Abbrechen
          </button>
          <button
            disabled={!name.trim()}
            onClick={() => name.trim() && onSave(name.trim())}
            style={{
              padding: '8px 18px', borderRadius: 7, border: 'none',
              background: '#16a34a', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600,
            }}>
            Anlegen
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Delete Confirm ────────────────────────────────────────────────────────────

function DeleteConfirmModal({
  field,
  onConfirm,
  onClose,
}: {
  field: Field
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, padding: 28, width: 400,
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: '#111827' }}>
          Feld löschen
        </h2>
        <p style={{ fontSize: 14, color: '#374151', marginBottom: 8 }}>
          Soll das Datenfeld <strong>„{field.label}"</strong> wirklich gelöscht werden?
        </p>
        <p style={{ fontSize: 13, color: '#dc2626', background: '#fef2f2', borderRadius: 6, padding: '8px 12px', marginBottom: 20 }}>
          Alle gespeicherten Werte dieses Feldes werden unwiderruflich gelöscht.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose}
            style={{
              padding: '8px 18px', borderRadius: 7, border: '1px solid #d1d5db',
              background: '#fff', cursor: 'pointer', fontSize: 14,
            }}>
            Abbrechen
          </button>
          <button onClick={onConfirm}
            style={{
              padding: '8px 18px', borderRadius: 7, border: 'none',
              background: '#dc2626', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600,
            }}>
            Löschen
          </button>
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
  const categories = Object.keys(grouped).sort()
  // Include pending new category even if empty
  if (pendingCategory && !grouped[pendingCategory]) {
    grouped[pendingCategory] = []
    categories.push(pendingCategory)
  }
  const allCategories = [...new Set([...categories, 'Allgemein'])].sort()

  function handleSave(form: FieldForm & { name?: string }) {
    const body = {
      name: form.name,
      label: form.label,
      field_type: form.field_type,
      category: form.category,
      options: form.options.length ? form.options : null,
      is_required: form.is_required,
      sort_order: form.sort_order,
    }
    if (editField) {
      updateMut.mutate({ id: editField.id, body: { ...body, name: editField.name } })
    } else {
      createMut.mutate(body)
    }
  }

  const emptyForm: FieldForm = {
    label: '',
    field_type: 'text',
    category: pendingCategory ?? 'Allgemein',
    options: [],
    is_required: false,
    sort_order: 0,
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>Datenfelder</h1>
          <p style={{ fontSize: 14, color: '#6b7280', marginTop: 4 }}>
            Hier kannst du die Datenfelder deiner Mitglieder verwalten.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => setShowCatModal(true)}
            style={{
              padding: '8px 16px', borderRadius: 7, border: '1px solid #2a5298',
              background: '#fff', color: '#2a5298', cursor: 'pointer', fontSize: 14, fontWeight: 500,
            }}
          >
            + Neue Kategorie
          </button>
          <button
            onClick={() => { setPendingCategory(null); setShowCreate(true) }}
            style={{
              padding: '8px 16px', borderRadius: 7, border: 'none',
              background: '#16a34a', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600,
            }}
          >
            + Neues Datenfeld
          </button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && <p style={{ color: '#6b7280' }}>Lade Felder…</p>}

      {/* Field groups */}
      {!isLoading && Object.keys(grouped).sort().map(cat => (
        <div key={cat} style={{ marginBottom: 24 }}>
          {/* Category header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 0', borderBottom: '2px solid #e5e7eb', marginBottom: 4,
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1 }}>
              {cat}
            </span>
            <button
              onClick={() => { setPendingCategory(cat); setShowCreate(true) }}
              style={{
                fontSize: 12, color: '#2a5298', background: 'none', border: 'none',
                cursor: 'pointer', padding: '2px 6px',
              }}
            >
              + Feld hinzufügen
            </button>
          </div>

          {/* Rows */}
          {grouped[cat].length === 0 && (
            <p style={{ fontSize: 13, color: '#9ca3af', padding: '8px 0' }}>Keine Felder in dieser Kategorie.</p>
          )}
          {grouped[cat].map(field => (
            <div key={field.id}
              style={{
                display: 'flex', alignItems: 'center', padding: '10px 12px',
                background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
                marginBottom: 6, gap: 12,
              }}
            >
              {/* Drag handle */}
              <span style={{ color: '#d1d5db', fontSize: 16, cursor: 'grab', userSelect: 'none' }}>⠿</span>

              {/* Type icon */}
              <span style={{
                width: 32, height: 32, background: '#f3f4f6', borderRadius: 6,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 15, flexShrink: 0,
              }}>
                {TYPE_ICONS[field.field_type as FieldType] ?? '?'}
              </span>

              {/* Name + type */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: '#2a5298', fontSize: 14 }}>
                  {field.label}
                  {field.is_required && (
                    <span style={{ color: '#dc2626', marginLeft: 4, fontSize: 12 }}>*</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 1 }}>
                  {TYPE_LABELS[field.field_type as FieldType] ?? field.field_type}
                  {field.field_type === 'select' && parseOptions(field.options).length > 0 && (
                    <span style={{ marginLeft: 6, color: '#9ca3af' }}>
                      ({parseOptions(field.options).join(', ')})
                    </span>
                  )}
                </div>
              </div>

              {/* Context menu trigger */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setMenuFieldId(menuFieldId === field.id ? null : field.id)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 18, color: '#6b7280', padding: '0 6px', lineHeight: 1,
                    borderRadius: 4,
                  }}
                  title="Optionen"
                >
                  ···
                </button>
                {menuFieldId === field.id && (
                  <ContextMenu
                    items={[
                      {
                        label: 'Feld bearbeiten',
                        onClick: () => setEditField(field),
                      },
                      {
                        label: 'Feld löschen',
                        onClick: () => setDeleteField(field),
                        danger: true,
                      },
                    ]}
                    onClose={() => setMenuFieldId(null)}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* Empty state */}
      {!isLoading && fields.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '60px 0', color: '#9ca3af',
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <p style={{ fontSize: 15 }}>Noch keine Datenfelder angelegt.</p>
          <button
            onClick={() => setShowCreate(true)}
            style={{
              marginTop: 16, padding: '9px 20px', borderRadius: 7, border: 'none',
              background: '#16a34a', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600,
            }}
          >
            Erstes Datenfeld anlegen
          </button>
        </div>
      )}

      {/* Modals */}
      {showCreate && (
        <FieldModal
          title="Neues Datenfeld"
          initial={{ ...emptyForm, category: pendingCategory ?? 'Allgemein' }}
          categories={allCategories}
          onSave={handleSave}
          onClose={() => { setShowCreate(false); setPendingCategory(null) }}
        />
      )}
      {editField && (
        <FieldModal
          title="Datenfeld bearbeiten"
          initial={{
            label: editField.label,
            field_type: editField.field_type,
            category: editField.category ?? 'Allgemein',
            options: parseOptions(editField.options),
            is_required: editField.is_required,
            sort_order: editField.sort_order,
          }}
          categories={allCategories}
          onSave={handleSave}
          onClose={() => setEditField(null)}
        />
      )}
      {showCatModal && (
        <CategoryModal
          onSave={(name) => { setPendingCategory(name); setShowCatModal(false); setShowCreate(true) }}
          onClose={() => setShowCatModal(false)}
        />
      )}
      {deleteField && (
        <DeleteConfirmModal
          field={deleteField}
          onConfirm={() => deleteMut.mutate(deleteField.id)}
          onClose={() => setDeleteField(null)}
        />
      )}
    </div>
  )
}
