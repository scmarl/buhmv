import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useEffect, useState } from 'react'
import api from '../api/client'

type Tab = 'stammdaten' | 'kontakt' | 'mitgliedschaft' | 'gruppen' | 'notizen'

const TABS: { id: Tab; label: string }[] = [
  { id: 'stammdaten', label: 'Stammdaten' },
  { id: 'kontakt', label: 'Kontakt' },
  { id: 'mitgliedschaft', label: 'Mitgliedschaft' },
  { id: 'gruppen', label: 'Gruppen' },
  { id: 'notizen', label: 'Notizen' },
]

export default function MemberDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const isNew = id === 'new'
  const [activeTab, setActiveTab] = useState<Tab>('stammdaten')
  const [noteText, setNoteText] = useState('')

  const { data: member, isLoading } = useQuery({
    queryKey: ['member', id],
    queryFn: () => api.get(`/members/${id}`).then(r => r.data),
    enabled: !isNew,
  })

  const { data: allGroups = [] } = useQuery<any[]>({
    queryKey: ['groups-flat'],
    queryFn: () => api.get('/groups').then(r => r.data),
  })

  const { register, handleSubmit, reset, formState: { isDirty } } = useForm()
  useEffect(() => { if (member) reset(member) }, [member, reset])

  const save = useMutation({
    mutationFn: (data: any) => isNew
      ? api.post('/members', data).then(r => r.data)
      : api.put(`/members/${id}`, data).then(r => r.data),
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['members'] })
      qc.invalidateQueries({ queryKey: ['member', id] })
      if (isNew) navigate(`/members/${saved.id}`)
    },
  })

  const addNote = useMutation({
    mutationFn: (content: string) => api.post(`/members/${id}/notes`, { content }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['member', id] }); setNoteText('') },
  })

  const deleteNote = useMutation({
    mutationFn: (noteId: number) => api.delete(`/members/${id}/notes/${noteId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['member', id] }),
  })

  const addGroup = useMutation({
    mutationFn: (groupId: number) => api.post(`/members/${id}/groups/${groupId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['member', id] }),
  })

  const removeGroup = useMutation({
    mutationFn: (groupId: number) => api.delete(`/members/${id}/groups/${groupId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['member', id] }),
  })

  const memberGroupIds = new Set((member?.groups ?? []).map((g: any) => g.id))
  const availableGroups = allGroups.filter(g => !memberGroupIds.has(g.id))

  if (isLoading) return <div style={{ padding: 40 }}>Laden…</div>

  const title = isNew ? 'Neues Mitglied' : `${member?.first_name ?? ''} ${member?.last_name ?? ''}`

  return (
    <div style={{ maxWidth: 820 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <button onClick={() => navigate('/members')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 20, lineHeight: 1 }}>←</button>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{title}</h1>
          {member?.member_number && <div style={{ fontSize: 12, color: '#9ca3af' }}>Nr. {member.member_number}</div>}
        </div>
        {!isNew && (
          <span style={{ marginLeft: 'auto', padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
            background: member?.is_active ? '#dcfce7' : '#fee2e2',
            color: member?.is_active ? '#166534' : '#991b1b' }}>
            {member?.is_active ? 'Aktiv' : 'Inaktiv'}
          </span>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '2px solid #e5e7eb', marginBottom: 24 }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 20px', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: activeTab === tab.id ? 600 : 400,
              color: activeTab === tab.id ? '#2a5298' : '#6b7280',
              borderBottom: activeTab === tab.id ? '2px solid #2a5298' : '2px solid transparent',
              marginBottom: -2,
            }}>
            {tab.label}
            {tab.id === 'gruppen' && member?.groups?.length > 0 &&
              <span style={{ marginLeft: 6, background: '#e0e7ff', color: '#3730a3', borderRadius: 10, padding: '1px 6px', fontSize: 11 }}>
                {member.groups.length}
              </span>}
            {tab.id === 'notizen' && member?.notes?.length > 0 &&
              <span style={{ marginLeft: 6, background: '#fef9c3', color: '#713f12', borderRadius: 10, padding: '1px 6px', fontSize: 11 }}>
                {member.notes.length}
              </span>}
          </button>
        ))}
      </div>

      {/* Form for data tabs */}
      {(activeTab === 'stammdaten' || activeTab === 'kontakt' || activeTab === 'mitgliedschaft') && (
        <form onSubmit={handleSubmit(d => save.mutate(d))}>
          <div style={{ background: '#fff', borderRadius: 8, padding: 28, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 16 }}>

            {activeTab === 'stammdaten' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <Field label="Vorname *" error={undefined}><input {...register('first_name', { required: true })} style={inputStyle} /></Field>
                <Field label="Nachname *"><input {...register('last_name', { required: true })} style={inputStyle} /></Field>
                <Field label="Geschlecht">
                  <select {...register('gender')} style={inputStyle}>
                    <option value="">—</option>
                    <option value="M">Männlich</option>
                    <option value="W">Weiblich</option>
                    <option value="D">Divers</option>
                  </select>
                </Field>
                <Field label="Geburtsdatum"><input type="date" {...register('birthdate')} style={inputStyle} /></Field>
                <Field label="Mitgliedsnummer"><input {...register('member_number')} style={inputStyle} /></Field>
                <Field label="Foto-URL"><input {...register('photo_url')} style={inputStyle} placeholder="https://…" /></Field>
              </div>
            )}

            {activeTab === 'kontakt' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <Field label="E-Mail" style={{ gridColumn: '1 / -1' }}><input type="email" {...register('email')} style={inputStyle} /></Field>
                <Field label="Telefon"><input {...register('phone')} style={inputStyle} /></Field>
                <Field label="Mobil"><input {...register('mobile')} style={inputStyle} /></Field>
                <Field label="Straße" style={{ gridColumn: '1 / -1' }}><input {...register('street')} style={inputStyle} /></Field>
                <Field label="PLZ"><input {...register('zip_code')} style={inputStyle} /></Field>
                <Field label="Ort"><input {...register('city')} style={inputStyle} /></Field>
              </div>
            )}

            {activeTab === 'mitgliedschaft' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <Field label="Status">
                  <select {...register('status')} style={inputStyle}>
                    <option value="active">Aktiv</option>
                    <option value="inactive">Inaktiv</option>
                    <option value="honorary">Ehrenmitglied</option>
                  </select>
                </Field>
                <Field label="Beitragsstatus">
                  <select {...register('fee_status')} style={inputStyle}>
                    <option value="paid">Bezahlt</option>
                    <option value="open">Offen</option>
                    <option value="exempt">Befreit</option>
                  </select>
                </Field>
                <Field label="Eintrittsdatum"><input type="date" {...register('entry_date')} style={inputStyle} /></Field>
                <Field label="Austrittsdatum"><input type="date" {...register('exit_date')} style={inputStyle} /></Field>
                <Field label="Aktiv">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <input type="checkbox" {...register('is_active')} style={{ width: 16, height: 16 }} />
                    <span style={{ fontSize: 14 }}>Mitglied ist aktiv</span>
                  </label>
                </Field>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button type="submit" disabled={save.isPending}
              style={{ padding: '9px 24px', background: '#2a5298', color: '#fff', border: 'none', borderRadius: 4, fontWeight: 600, cursor: 'pointer' }}>
              {save.isPending ? 'Speichern…' : 'Speichern'}
            </button>
            <button type="button" onClick={() => { reset(); navigate('/members') }}
              style={{ padding: '9px 20px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>
              Abbrechen
            </button>
            {isDirty && <span style={{ alignSelf: 'center', fontSize: 12, color: '#f59e0b' }}>Ungespeicherte Änderungen</span>}
          </div>
        </form>
      )}

      {/* Groups Tab */}
      {activeTab === 'gruppen' && !isNew && (
        <div style={{ background: '#fff', borderRadius: 8, padding: 28, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Zugewiesene Gruppen</h3>
          {member?.groups?.length === 0
            ? <p style={{ color: '#9ca3af', fontSize: 14 }}>Noch keiner Gruppe zugewiesen.</p>
            : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
                {member.groups.map((g: any) => (
                  <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#eff4ff', borderRadius: 20, padding: '4px 12px', fontSize: 13 }}>
                    <span>📁</span>
                    <span style={{ color: '#1e3a8a', fontWeight: 500 }}>{g.name}</span>
                    <button onClick={() => removeGroup.mutate(g.id)}
                      style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 0 0 4px' }}>×</button>
                  </div>
                ))}
              </div>
          }
          {availableGroups.length > 0 && (
            <>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Gruppe hinzufügen</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {availableGroups.map((g: any) => (
                  <button key={g.id} onClick={() => addGroup.mutate(g.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 20, padding: '4px 14px', fontSize: 13, cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#eff4ff')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#f9fafb')}>
                    <span>📁</span> {g.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Notes Tab */}
      {activeTab === 'notizen' && !isNew && (
        <div style={{ background: '#fff', borderRadius: 8, padding: 28, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ marginBottom: 24 }}>
            <textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder="Neue Notiz…"
              rows={3}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 14, resize: 'vertical', fontFamily: 'inherit' }}
            />
            <button onClick={() => noteText.trim() && addNote.mutate(noteText.trim())}
              disabled={!noteText.trim() || addNote.isPending}
              style={{ marginTop: 8, padding: '7px 20px', background: '#2a5298', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>
              {addNote.isPending ? 'Speichern…' : 'Notiz hinzufügen'}
            </button>
          </div>
          {member?.notes?.length === 0
            ? <p style={{ color: '#9ca3af', fontSize: 14 }}>Noch keine Notizen.</p>
            : [...(member?.notes ?? [])].reverse().map((n: any) => (
                <div key={n.id} style={{ borderTop: '1px solid #f3f4f6', paddingTop: 16, marginTop: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{n.author}</span>
                      <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 8 }}>{n.created_at}</span>
                    </div>
                    <button onClick={() => deleteNote.mutate(n.id)}
                      style={{ background: 'none', border: 'none', color: '#d1d5db', cursor: 'pointer', fontSize: 16 }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#dc2626')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#d1d5db')}>🗑</button>
                  </div>
                  <p style={{ margin: '6px 0 0', fontSize: 14, color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{n.content}</p>
                </div>
              ))
          }
        </div>
      )}
    </div>
  )
}

function Field({ label, children, style }: { label: string; children: React.ReactNode; error?: string; style?: React.CSSProperties }) {
  return (
    <div style={style}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6b7280', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', border: '1px solid #d1d5db',
  borderRadius: 4, fontSize: 14, background: '#fff',
}
