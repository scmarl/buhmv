import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useEffect } from 'react'
import api from '../api/client'

export default function MemberDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: member, isLoading } = useQuery({
    queryKey: ['member', id],
    queryFn: () => api.get(`/members/${id}`).then(r => r.data),
    enabled: !!id && id !== 'new',
  })

  const { register, handleSubmit, reset } = useForm()

  useEffect(() => { if (member) reset(member) }, [member, reset])

  const save = useMutation({
    mutationFn: (data: any) => id === 'new'
      ? api.post('/members', data).then(r => r.data)
      : api.put(`/members/${id}`, data).then(r => r.data),
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['members'] })
      navigate(`/members/${saved.id}`)
    },
  })

  if (isLoading) return <div>Laden…</div>

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 24 }}>
        <button onClick={() => navigate('/members')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>← Zurück</button>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>{id === 'new' ? 'Neues Mitglied' : `${member?.first_name} ${member?.last_name}`}</h1>
      </div>
      <form onSubmit={handleSubmit(d => save.mutate(d))} style={{ background: '#fff', padding: 24, borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {[
            { name: 'first_name', label: 'Vorname' },
            { name: 'last_name', label: 'Nachname' },
            { name: 'email', label: 'E-Mail' },
            { name: 'phone', label: 'Telefon' },
            { name: 'mobile', label: 'Mobil' },
            { name: 'member_number', label: 'Mitgliedsnr.' },
            { name: 'street', label: 'Straße' },
            { name: 'zip_code', label: 'PLZ' },
            { name: 'city', label: 'Ort' },
            { name: 'birthdate', label: 'Geburtsdatum', type: 'date' },
            { name: 'entry_date', label: 'Eintrittsdatum', type: 'date' },
          ].map(f => (
            <div key={f.name}>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 4, color: '#6b7280' }}>{f.label}</label>
              <input {...register(f.name)} type={f.type || 'text'}
                style={{ width: '100%', padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 14 }} />
            </div>
          ))}
        </div>
        <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
          <button type="submit" disabled={save.isPending}
            style={{ padding: '8px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>
            {save.isPending ? 'Speichern…' : 'Speichern'}
          </button>
          <button type="button" onClick={() => navigate('/members')}
            style={{ padding: '8px 20px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>
            Abbrechen
          </button>
        </div>
      </form>
    </div>
  )
}
