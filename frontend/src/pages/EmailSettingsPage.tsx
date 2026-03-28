import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../api/client'

interface Settings {
  send_mode: string
  smtp_host: string
  smtp_port: number
  smtp_security: string
  smtp_username: string
  smtp_password: string
  smtp_from: string
  password_set: boolean
  updated_by: string
  updated_at: string
}

const EMPTY: Settings = {
  send_mode: 'mailto', smtp_host: '', smtp_port: 587, smtp_security: 'starttls',
  smtp_username: '', smtp_password: '', smtp_from: '', password_set: false,
  updated_by: '', updated_at: '',
}

type TestState = { status: 'idle' | 'testing' | 'ok' | 'error'; message: string }

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>{label}</label>
      {children}
      {hint && <p style={{ margin: '3px 0 0', fontSize: 11, color: '#9ca3af' }}>{hint}</p>}
    </div>
  )
}

function Input({ value, onChange, type='text', placeholder='', disabled=false }: {
  value: string|number; onChange:(v:string)=>void; type?:string; placeholder?:string; disabled?:boolean
}) {
  return (
    <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} disabled={disabled}
      style={{ width:'100%', padding:'7px 10px', border:'1px solid #d1d5db', borderRadius:5, fontSize:13,
        boxSizing:'border-box', outline:'none', background: disabled?'#f9fafb':'#fff', color:'#111827' }} />
  )
}

export default function EmailSettingsPage() {
  const qc = useQueryClient()
  const [form, setForm]     = useState<Settings>(EMPTY)
  const [dirty, setDirty]   = useState(false)
  const [saved, setSaved]   = useState(false)
  const [test, setTest]     = useState<TestState>({ status: 'idle', message: '' })

  const { data, isLoading } = useQuery<Settings>({
    queryKey: ['email-settings'],
    queryFn: () => api.get('/email-settings').then(r => r.data),
  })

  useEffect(() => {
    if (data) { setForm({ ...data, smtp_password: '' }); setDirty(false) }
  }, [data])

  function set(k: keyof Settings, v: any) {
    setForm(f => ({ ...f, [k]: v }))
    setDirty(true)
    setSaved(false)
  }

  const saveMut = useMutation({
    mutationFn: (d: Partial<Settings>) => api.put('/email-settings', d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-settings'] })
      setSaved(true)
      setDirty(false)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  async function handleTest() {
    setTest({ status: 'testing', message: '' })
    try {
      const res = await api.post('/email-settings/test', {
        smtp_host: form.smtp_host,
        smtp_port: form.smtp_port,
        smtp_security: form.smtp_security,
        smtp_username: form.smtp_username,
        smtp_password: form.smtp_password,  // '' → server uses stored pw
        smtp_from: form.smtp_from,
      })
      setTest({ status: res.data.success ? 'ok' : 'error', message: res.data.message })
    } catch {
      setTest({ status: 'error', message: 'Fehler beim Verbindungstest.' })
    }
  }

  const isSmtp = form.send_mode === 'smtp'

  if (isLoading) return <div style={{ padding: 40, color: '#9ca3af', textAlign:'center' }}>Lädt…</div>

  return (
    <div style={{ maxWidth: 620 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 6px' }}>E-Mail Einstellungen</h1>
      <p style={{ color: '#6b7280', fontSize: 13, margin: '0 0 28px' }}>
        Legen Sie fest, wie E-Mails aus dem CRM versendet werden.
      </p>

      {/* ── Versandmodus ── */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '20px 24px', marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 16px', color: '#111827' }}>Versandmodus</h2>

        {[
          { val: 'mailto', title: 'Browser (mailto) – Standard',
            desc: '„E-Mail senden" öffnet das lokale E-Mail-Programm. Keine Konfiguration erforderlich.' },
          { val: 'smtp',   title: 'SMTP-Client',
            desc: 'E-Mails werden direkt aus dem CRM über Ihren Mail-Server gesendet.' },
        ].map(opt => (
          <label key={opt.val}
            style={{ display:'flex', gap:12, padding:'12px 14px', border:`2px solid ${form.send_mode===opt.val?'#2a5298':'#e5e7eb'}`,
              borderRadius:7, marginBottom:10, cursor:'pointer', background: form.send_mode===opt.val?'#eff4ff':'#fff',
              transition:'border-color .15s,background .15s' }}>
            <input type="radio" name="send_mode" value={opt.val} checked={form.send_mode===opt.val}
              onChange={()=>set('send_mode',opt.val)}
              style={{ marginTop:2, accentColor:'#2a5298', flexShrink:0 }} />
            <div>
              <div style={{ fontSize:14, fontWeight:600, color:'#111827', marginBottom:2 }}>{opt.title}</div>
              <div style={{ fontSize:12, color:'#6b7280' }}>{opt.desc}</div>
            </div>
          </label>
        ))}
      </div>

      {/* ── SMTP-Konfiguration ── */}
      {isSmtp && (
        <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:8, padding:'20px 24px', marginBottom:20 }}>
          <h2 style={{ fontSize:15, fontWeight:700, margin:'0 0 18px', color:'#111827' }}>SMTP-Konfiguration</h2>

          <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:'0 12px', alignItems:'end' }}>
            <Field label="SMTP-Server">
              <Input value={form.smtp_host} onChange={v=>set('smtp_host',v)} placeholder="mail.example.com" />
            </Field>
            <Field label="Port">
              <input type="number" value={form.smtp_port}
                onChange={e=>set('smtp_port', parseInt(e.target.value)||587)}
                style={{ width:80, padding:'7px 10px', border:'1px solid #d1d5db', borderRadius:5, fontSize:13, outline:'none' }} />
            </Field>
          </div>

          <Field label="Verschlüsselung">
            <div style={{ display:'flex', gap:8 }}>
              {[['starttls','STARTTLS (Port 587)'],['ssl','SSL/TLS (Port 465)'],['none','Keine']].map(([v,l])=>(
                <label key={v} style={{ display:'flex', alignItems:'center', gap:5, fontSize:13, cursor:'pointer',
                  padding:'6px 12px', border:`1px solid ${form.smtp_security===v?'#2a5298':'#e5e7eb'}`,
                  borderRadius:5, background: form.smtp_security===v?'#eff4ff':'#fff' }}>
                  <input type="radio" name="smtp_security" value={v} checked={form.smtp_security===v}
                    onChange={()=>{ set('smtp_security',v); set('smtp_port', v==='ssl'?465:587) }}
                    style={{ accentColor:'#2a5298' }} />
                  {l}
                </label>
              ))}
            </div>
          </Field>

          <Field label="Benutzername (E-Mail-Adresse)">
            <Input value={form.smtp_username} onChange={v=>set('smtp_username',v)} placeholder="user@example.com" type="email" />
          </Field>

          <Field label="Passwort"
            hint={data?.password_set ? 'Passwort gespeichert. Nur eingeben, wenn Sie es ändern möchten.' : ''}>
            <Input value={form.smtp_password} onChange={v=>set('smtp_password',v)}
              type="password"
              placeholder={data?.password_set ? '● ● ● ● ● ● ● ●  (unverändert)' : 'Passwort eingeben'} />
          </Field>

          <Field label="Absenderadresse (From)"
            hint="Wird im Empfänger als Absender angezeigt. Oft identisch mit dem Benutzernamen.">
            <Input value={form.smtp_from} onChange={v=>set('smtp_from',v)} placeholder="Vereins-CRM <noreply@example.com>" type="email" />
          </Field>

          {/* ── Verbindungstest ── */}
          <div style={{ borderTop:'1px solid #f3f4f6', paddingTop:16, marginTop:4 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
              <button onClick={handleTest} disabled={test.status==='testing' || !form.smtp_host}
                style={{ padding:'8px 18px', background: test.status==='testing'?'#9ca3af':'#2a5298', color:'#fff',
                  border:'none', borderRadius:5, fontWeight:600, fontSize:13, cursor: test.status==='testing'||!form.smtp_host?'not-allowed':'pointer' }}>
                {test.status==='testing' ? '⏳ Verbinde…' : '⚡ Verbindung testen'}
              </button>
              {test.status==='ok' && (
                <div style={{ display:'flex', alignItems:'center', gap:6, color:'#16a34a', fontSize:13, fontWeight:500 }}>
                  <span style={{ fontSize:16 }}>✓</span> {test.message}
                </div>
              )}
              {test.status==='error' && (
                <div style={{ display:'flex', alignItems:'center', gap:6, color:'#dc2626', fontSize:13, fontWeight:500 }}>
                  <span style={{ fontSize:16 }}>✗</span> {test.message}
                </div>
              )}
            </div>
            <p style={{ margin:'8px 0 0', fontSize:11, color:'#9ca3af' }}>
              Es wird eine Testverbindung zum Server hergestellt. Es wird keine E-Mail gesendet.
            </p>
          </div>
        </div>
      )}

      {/* ── Footer / Save ── */}
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <button onClick={()=>saveMut.mutate(form)} disabled={!dirty || saveMut.isPending}
          style={{ padding:'9px 26px', background: dirty?'#16a34a':'#9ca3af', color:'#fff',
            border:'none', borderRadius:5, fontWeight:700, fontSize:14,
            cursor: dirty&&!saveMut.isPending?'pointer':'not-allowed' }}>
          {saveMut.isPending ? 'Speichert…' : 'Einstellungen speichern'}
        </button>
        {saved && <span style={{ color:'#16a34a', fontSize:13, fontWeight:500 }}>✓ Gespeichert</span>}
        {data?.updated_at && !dirty && (
          <span style={{ color:'#9ca3af', fontSize:12 }}>
            Zuletzt gespeichert: {data.updated_at} von {data.updated_by}
          </span>
        )}
      </div>
    </div>
  )
}
