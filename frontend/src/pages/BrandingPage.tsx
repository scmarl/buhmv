import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../api/client'

interface Branding {
  club_name: string
  logo_url: string
  primary_color: string
  header_text_color: string
  sidebar_bg: string
  sidebar_text_color: string
  workspace_bg: string
  updated_by: string
  updated_at: string
}

const DEFAULTS: Branding = {
  club_name: 'Mein Verein',
  logo_url: '',
  primary_color: '#2a5298',
  header_text_color: '#ffffff',
  sidebar_bg: '#ffffff',
  sidebar_text_color: '#374151',
  workspace_bg: '#f3f4f6',
  updated_by: '',
  updated_at: '',
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
      <input type="color" value={value} onChange={e => onChange(e.target.value)}
        style={{ width: 40, height: 36, border: '1px solid #d1d5db', borderRadius: 6, padding: 2, cursor: 'pointer', background: 'none' }} />
      <input type="text" value={value} onChange={e => onChange(e.target.value)}
        style={{ width: 100, padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 5, fontSize: 13, fontFamily: 'monospace' }} />
      <span style={{ fontSize: 13, color: '#374151' }}>{label}</span>
    </div>
  )
}

export default function BrandingPage() {
  const qc = useQueryClient()
  const logoInputRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState<Branding>(DEFAULTS)
  const [saved, setSaved] = useState(false)

  const { data, isLoading } = useQuery<Branding>({
    queryKey: ['branding'],
    queryFn: () => api.get('/branding').then(r => r.data),
  })

  useEffect(() => {
    if (data) setForm(data)
  }, [data])

  const saveMut = useMutation({
    mutationFn: () => api.put('/branding', form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branding'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    },
  })

  function set(k: keyof Branding, v: string) {
    setForm(f => ({ ...f, [k]: v }))
  }

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => set('logo_url', ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  if (isLoading) return <p style={{ padding: 32, color: '#6b7280' }}>Lädt…</p>

  // Live preview styles
  const previewHeader: React.CSSProperties = {
    background: form.primary_color, color: form.header_text_color,
    height: 44, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 10,
    borderRadius: '6px 6px 0 0',
  }
  const previewSidebar: React.CSSProperties = {
    background: form.sidebar_bg, width: 120, padding: '8px 0',
    borderRight: '1px solid #e5e7eb',
  }
  const previewWorkspace: React.CSSProperties = {
    background: form.workspace_bg, flex: 1, padding: 12,
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 780 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Erscheinungsbild</h1>
      <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 28 }}>
        Farben, Logo und Name des Vereins. Der Vereinsname ist als Platzhalter <code style={{ background:'#f3f4f6', padding:'1px 5px', borderRadius:3 }}>{'{{club_name}}'}</code> in E-Mails verfügbar.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
        {/* Left column: settings */}
        <div>
          {/* Club Name */}
          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: '#111827' }}>Vereinsname</h2>
            <input value={form.club_name} onChange={e => set('club_name', e.target.value)}
              placeholder="Name des Vereins"
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }} />
          </section>

          {/* Logo */}
          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: '#111827' }}>Logo</h2>
            {form.logo_url ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <img src={form.logo_url} alt="Logo" style={{ maxHeight: 48, maxWidth: 120, objectFit: 'contain', border: '1px solid #e5e7eb', borderRadius: 4, padding: 4 }} />
                <button onClick={() => set('logo_url', '')}
                  style={{ fontSize: 12, color: '#dc2626', background: 'none', border: '1px solid #fca5a5', borderRadius: 4, padding: '4px 10px', cursor: 'pointer' }}>
                  Entfernen
                </button>
              </div>
            ) : (
              <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 8 }}>Kein Logo hochgeladen</p>
            )}
            <input type="file" accept="image/*" ref={logoInputRef} onChange={handleLogoUpload} style={{ display: 'none' }} />
            <button onClick={() => logoInputRef.current?.click()}
              style={{ padding: '7px 16px', border: '1px solid #d1d5db', borderRadius: 5, background: '#fff', fontSize: 13, cursor: 'pointer' }}>
              {form.logo_url ? 'Logo ersetzen' : 'Logo hochladen'}
            </button>
          </section>

          {/* Colors: Header */}
          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: '#111827' }}>Kopfleiste</h2>
            <ColorField label="Hintergrund" value={form.primary_color} onChange={v => set('primary_color', v)} />
            <ColorField label="Schrift" value={form.header_text_color} onChange={v => set('header_text_color', v)} />
          </section>

          {/* Colors: Sidebar */}
          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: '#111827' }}>Seitenleiste</h2>
            <ColorField label="Hintergrund" value={form.sidebar_bg} onChange={v => set('sidebar_bg', v)} />
            <ColorField label="Schrift" value={form.sidebar_text_color} onChange={v => set('sidebar_text_color', v)} />
          </section>

          {/* Colors: Workspace */}
          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: '#111827' }}>Arbeitsbereich</h2>
            <ColorField label="Hintergrund" value={form.workspace_bg} onChange={v => set('workspace_bg', v)} />
          </section>
        </div>

        {/* Right column: live preview */}
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: '#111827' }}>Vorschau</h2>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}>
            {/* Header */}
            <div style={previewHeader}>
              {form.logo_url
                ? <img src={form.logo_url} alt="" style={{ height: 28, maxWidth: 60, objectFit: 'contain' }} />
                : <div style={{ width: 26, height: 26, background: 'rgba(255,255,255,0.25)', borderRadius: 3, display:'flex', alignItems:'center', justifyContent:'center', fontSize: 10, fontWeight: 700 }}>
                    {form.club_name.substring(0,2).toUpperCase()}
                  </div>
              }
              <span style={{ fontWeight: 700, fontSize: 13 }}>{form.club_name}</span>
              <div style={{ flex:1 }}/>
              <div style={{ fontSize: 11, opacity: 0.7 }}>Mitglieder</div>
            </div>
            {/* Body */}
            <div style={{ display: 'flex', height: 140 }}>
              <div style={previewSidebar}>
                {['Mitglieder','Gruppen','Suchen'].map(label => (
                  <div key={label} style={{ padding: '5px 10px', fontSize: 11, color: form.sidebar_text_color }}>{label}</div>
                ))}
                <div style={{ padding: '5px 10px', fontSize: 11, color: form.primary_color, fontWeight: 600, borderLeft: `2px solid ${form.primary_color}`, background: form.primary_color + '15' }}>Aktiv</div>
              </div>
              <div style={previewWorkspace}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#111827', marginBottom: 6 }}>Seiteninhalt</div>
                {[80, 60, 90].map((w, i) => (
                  <div key={i} style={{ height: 8, background: '#d1d5db', borderRadius: 4, width: `${w}%`, marginBottom: 5 }} />
                ))}
              </div>
            </div>
          </div>
          {form.updated_at && (
            <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 10 }}>
              Zuletzt gespeichert: {form.updated_at} von {form.updated_by}
            </p>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8 }}>
        <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}
          style={{ padding: '9px 28px', background: '#2a5298', color: '#fff', border: 'none', borderRadius: 5, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
          {saveMut.isPending ? 'Speichern…' : 'Speichern'}
        </button>
        <button onClick={() => setForm(data || DEFAULTS)}
          style={{ padding: '9px 16px', border: '1px solid #d1d5db', borderRadius: 5, background: '#fff', fontSize: 13, cursor: 'pointer', color: '#374151' }}>
          Zurücksetzen
        </button>
        {saved && <span style={{ fontSize: 13, color: '#16a34a', fontWeight: 500 }}>✓ Gespeichert</span>}
      </div>
    </div>
  )
}
