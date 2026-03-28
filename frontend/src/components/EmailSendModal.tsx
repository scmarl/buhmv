import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../api/client'

interface EmailSettings { send_mode: string }
interface Template { id: number; name: string; subject: string; body: string }

interface Recipient { id?: number; name: string; email: string }

interface Props {
  recipients: Recipient[]   // pre-selected members
  onClose: () => void
}

type Mode    = 'mailto' | 'smtp'
type Status  = 'idle' | 'sending' | 'ok' | 'error'

export default function EmailSendModal({ recipients, onClose }: Props) {
  const validRecipients = recipients.filter(r => r.email)

  const { data: cfg } = useQuery<EmailSettings>({
    queryKey: ['email-settings'],
    queryFn: () => api.get('/email-settings').then(r => r.data),
  })
  const { data: templates = [] } = useQuery<Template[]>({
    queryKey: ['email-templates'],
    queryFn: () => api.get('/email-templates').then(r => r.data),
  })

  const [mode,     setMode]     = useState<Mode>((cfg?.send_mode as Mode) ?? 'mailto')
  const [subject,  setSubject]  = useState('')
  const [body,     setBody]     = useState('')
  const [tplId,    setTplId]    = useState('')
  const [status,   setStatus]   = useState<Status>('idle')
  const [resultMsg, setResultMsg] = useState('')

  // keep mode in sync with loaded config (once)
  const [modeSynced, setModeSynced] = useState(false)
  if (cfg && !modeSynced) { setMode(cfg.send_mode as Mode); setModeSynced(true) }

  function loadTemplate(id: string) {
    setTplId(id)
    const t = templates.find(x => String(x.id) === id)
    if (t) { setSubject(t.subject || ''); setBody(t.body || '') }
  }

  function openMailto() {
    const emails = validRecipients.map(r => r.email).join(',')
    window.location.href = `mailto:?bcc=${encodeURIComponent(emails)}`
    onClose()
  }

  async function sendSmtp() {
    if (!subject.trim()) { alert('Bitte Betreff eingeben.'); return }
    if (!body.trim())    { alert('Bitte Nachricht eingeben.'); return }
    setStatus('sending')
    try {
      const res = await api.post('/email/send', {
        recipients: validRecipients.map(r => r.email),
        subject,
        body,
        body_type: body.trimStart().startsWith('<') ? 'html' : 'plain',
      })
      setStatus(res.data.success ? 'ok' : 'error')
      setResultMsg(res.data.message)
    } catch (e: any) {
      setStatus('error')
      setResultMsg(e?.response?.data?.detail ?? 'Versand fehlgeschlagen.')
    }
  }

  const noEmail = validRecipients.length === 0

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', zIndex:2000,
      display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:'#fff', borderRadius:10, width:'min(560px,96vw)',
        boxShadow:'0 24px 64px rgba(0,0,0,.25)', display:'flex', flexDirection:'column', maxHeight:'90vh' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'14px 20px', borderBottom:'1px solid #e5e7eb', flexShrink:0 }}>
          <h2 style={{ margin:0, fontSize:17, fontWeight:700 }}>
            E-Mail senden
            <span style={{ marginLeft:8, fontSize:13, fontWeight:400, color:'#6b7280' }}>
              {validRecipients.length} Empfänger
              {recipients.length !== validRecipients.length &&
                <span style={{ color:'#f59e0b' }}> ({recipients.length - validRecipients.length} ohne Adresse)</span>}
            </span>
          </h2>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:22,
            cursor:'pointer', color:'#6b7280', lineHeight:1 }}>×</button>
        </div>

        {noEmail ? (
          <div style={{ padding:'32px 24px', textAlign:'center', color:'#6b7280' }}>
            <div style={{ fontSize:32, marginBottom:10 }}>📭</div>
            <p style={{ margin:0, fontSize:14 }}>
              Keiner der ausgewählten Kontakte hat eine E-Mail-Adresse.
            </p>
          </div>
        ) : (
          <div style={{ overflowY:'auto', flex:1 }}>
            {/* Mode selector */}
            <div style={{ padding:'16px 20px 12px', borderBottom:'1px solid #f3f4f6' }}>
              <div style={{ fontSize:12, fontWeight:600, color:'#6b7280', textTransform:'uppercase',
                letterSpacing:'.05em', marginBottom:10 }}>Versandmodus</div>
              <div style={{ display:'flex', gap:10 }}>
                {([
                  ['mailto', '💻 Lokaler E-Mail-Client', 'Öffnet Ihr E-Mail-Programm'],
                  ['smtp',   '📤 SMTP (direkt aus CRM)', 'Sendet über konfigurierten Mail-Server'],
                ] as const).map(([val, title, hint]) => (
                  <label key={val}
                    style={{ flex:1, display:'flex', gap:10, padding:'10px 12px', cursor:'pointer',
                      border:`2px solid ${mode===val?'#2a5298':'#e5e7eb'}`, borderRadius:7,
                      background: mode===val?'#eff4ff':'#fff' }}>
                    <input type="radio" name="mode" value={val} checked={mode===val}
                      onChange={()=>setMode(val)} style={{ accentColor:'#2a5298', marginTop:2, flexShrink:0 }} />
                    <div>
                      <div style={{ fontSize:13, fontWeight:600, color:'#111827' }}>{title}</div>
                      <div style={{ fontSize:11, color:'#9ca3af' }}>{hint}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Recipients preview */}
            <div style={{ padding:'10px 20px', borderBottom:'1px solid #f3f4f6', background:'#fafafa' }}>
              <div style={{ fontSize:12, color:'#9ca3af', marginBottom:5 }}>Empfänger (BCC):</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                {validRecipients.slice(0,12).map((r,i) => (
                  <span key={i} style={{ background:'#e0e7ff', color:'#3730a3', fontSize:11,
                    padding:'2px 8px', borderRadius:10 }}>
                    {r.name ? `${r.name} <${r.email}>` : r.email}
                  </span>
                ))}
                {validRecipients.length > 12 &&
                  <span style={{ fontSize:11, color:'#9ca3af', padding:'2px 6px' }}>
                    +{validRecipients.length-12} weitere
                  </span>}
              </div>
            </div>

            {/* mailto info */}
            {mode === 'mailto' && (
              <div style={{ padding:'20px 20px', color:'#374151' }}>
                <p style={{ margin:'0 0 10px', fontSize:13, color:'#6b7280' }}>
                  Klicken Sie auf <strong>Client öffnen</strong>, um Ihr lokales E-Mail-Programm zu starten.
                  Die {validRecipients.length} Adresse{validRecipients.length!==1?'n':''} werden ins BCC-Feld eingetragen.
                </p>
                <p style={{ margin:0, fontSize:11, color:'#9ca3af' }}>
                  Tipp: SMTP-Versand direkt aus dem CRM kann unter <em>E-Mail Einstellungen</em> konfiguriert werden.
                </p>
              </div>
            )}

            {/* SMTP compose */}
            {mode === 'smtp' && (
              <div style={{ padding:'16px 20px' }}>
                {/* Template selector */}
                {templates.length > 0 && (
                  <div style={{ marginBottom:14 }}>
                    <label style={{ fontSize:12, fontWeight:600, color:'#6b7280', display:'block', marginBottom:5,
                      textTransform:'uppercase', letterSpacing:'.05em' }}>
                      Vorlage laden (optional)
                    </label>
                    <select value={tplId} onChange={e=>loadTemplate(e.target.value)}
                      style={{ width:'100%', padding:'7px 10px', border:'1px solid #d1d5db',
                        borderRadius:5, fontSize:13, background:'#fff' }}>
                      <option value="">— Keine Vorlage —</option>
                      {templates.map(t => <option key={t.id} value={String(t.id)}>{t.name}</option>)}
                    </select>
                  </div>
                )}

                {/* Subject */}
                <div style={{ marginBottom:12 }}>
                  <label style={{ fontSize:12, fontWeight:600, color:'#6b7280', display:'block', marginBottom:5,
                    textTransform:'uppercase', letterSpacing:'.05em' }}>
                    Betreff *
                  </label>
                  <input value={subject} onChange={e=>setSubject(e.target.value)}
                    placeholder="Betreff eingeben…"
                    style={{ width:'100%', padding:'8px 10px', border:'1px solid #d1d5db',
                      borderRadius:5, fontSize:14, boxSizing:'border-box', outline:'none' }} />
                </div>

                {/* Body */}
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:'#6b7280', display:'block', marginBottom:5,
                    textTransform:'uppercase', letterSpacing:'.05em' }}>
                    Nachricht *
                  </label>
                  <textarea value={body} onChange={e=>setBody(e.target.value)}
                    placeholder="Nachricht eingeben… (HTML wird unterstützt)"
                    rows={8}
                    style={{ width:'100%', padding:'8px 10px', border:'1px solid #d1d5db',
                      borderRadius:5, fontSize:13, boxSizing:'border-box', outline:'none',
                      resize:'vertical', fontFamily:'inherit', lineHeight:1.6 }} />
                </div>

                {/* Result feedback */}
                {status === 'ok' && (
                  <div style={{ marginTop:10, padding:'10px 14px', background:'#f0fdf4',
                    border:'1px solid #bbf7d0', borderRadius:6, color:'#16a34a', fontSize:13, fontWeight:500 }}>
                    ✓ {resultMsg}
                  </div>
                )}
                {status === 'error' && (
                  <div style={{ marginTop:10, padding:'10px 14px', background:'#fef2f2',
                    border:'1px solid #fecaca', borderRadius:6, color:'#dc2626', fontSize:13 }}>
                    ✗ {resultMsg}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        {!noEmail && (
          <div style={{ borderTop:'1px solid #e5e7eb', padding:'12px 20px',
            display:'flex', gap:10, flexShrink:0, alignItems:'center' }}>
            {mode === 'mailto' && (
              <button onClick={openMailto}
                style={{ padding:'9px 22px', background:'#2a5298', color:'#fff',
                  border:'none', borderRadius:5, fontWeight:700, fontSize:14, cursor:'pointer' }}>
                💻 Client öffnen
              </button>
            )}
            {mode === 'smtp' && status !== 'ok' && (
              <button onClick={sendSmtp} disabled={status==='sending'}
                style={{ padding:'9px 22px', background:status==='sending'?'#9ca3af':'#16a34a', color:'#fff',
                  border:'none', borderRadius:5, fontWeight:700, fontSize:14,
                  cursor:status==='sending'?'not-allowed':'pointer' }}>
                {status === 'sending' ? '⏳ Wird gesendet…' : '📤 Senden'}
              </button>
            )}
            {status === 'ok' && (
              <button onClick={onClose}
                style={{ padding:'9px 22px', background:'#16a34a', color:'#fff',
                  border:'none', borderRadius:5, fontWeight:700, fontSize:14, cursor:'pointer' }}>
                ✓ Schliessen
              </button>
            )}
            <button onClick={onClose}
              style={{ padding:'9px 18px', border:'1px solid #d1d5db', borderRadius:5,
                background:'#fff', fontSize:14, cursor:'pointer', color:'#374151' }}>
              Abbrechen
            </button>
          </div>
        )}
        {noEmail && (
          <div style={{ borderTop:'1px solid #e5e7eb', padding:'12px 20px', flexShrink:0 }}>
            <button onClick={onClose}
              style={{ padding:'9px 18px', border:'1px solid #d1d5db', borderRadius:5,
                background:'#fff', fontSize:14, cursor:'pointer', color:'#374151' }}>
              Schliessen
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
