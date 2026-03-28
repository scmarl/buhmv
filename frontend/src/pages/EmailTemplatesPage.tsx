import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../api/client'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Attachment { id: number; original_name: string; stored_name: string; file_size: number; mime_type: string; uploaded_at: string }
interface Template {
  id: number; name: string; subject: string; title: string; body: string
  footer_text: string; design: string; show_header: boolean; show_footer: boolean
  show_button: boolean; button_text: string; button_url: string
  show_button_text_after: boolean; button_text_after: string
  primary_color: string; visibility: string; created_by: string; created_at: string
  color_scheme: string; header_line1: string; header_line2: string
  header_subtitle: string; logo_url: string
  attachments: Attachment[]
}
type FormData = Omit<Template,'id'|'created_by'|'created_at'|'attachments'>
interface FieldDef { name: string; label: string; field_type: string }

interface ColorScheme {
  primaryBg: string; headerText: string; bodyText: string; bodyBg: string
  footerText: string; footerBg: string; buttonBg: string; buttonText: string
  generalBg: string; linkColor: string
}
const DEFAULT_COLORS: ColorScheme = {
  primaryBg:'#2a5298', headerText:'#ffffff', bodyText:'#111827', bodyBg:'#ffffff',
  footerText:'#9ca3af', footerBg:'#f9fafb', buttonBg:'#2a5298', buttonText:'#ffffff',
  generalBg:'#e9edf2', linkColor:'#2563eb',
}
function parseColors(json: string, fallbackPrimary?: string): ColorScheme {
  try {
    const parsed = JSON.parse(json || '{}')
    return { ...DEFAULT_COLORS, ...(fallbackPrimary ? { primaryBg: fallbackPrimary } : {}), ...parsed }
  } catch { return { ...DEFAULT_COLORS, ...(fallbackPrimary ? { primaryBg: fallbackPrimary } : {}) } }
}

const EMPTY: FormData = {
  name:'', subject:'', title:'E-Mail Titel',
  body:'<p>Guten Tag,</p><p><br></p><p>Dies ist ein Beispieltext.</p><p><br></p><p>Freundliche Grüße</p>',
  footer_text:'Diese Nachricht wurde von Vereins-CRM versandt.',
  design:'standard', show_header:true, show_footer:true,
  show_button:false, button_text:'Mehr erfahren', button_url:'',
  show_button_text_after:false, button_text_after:'',
  primary_color:'#2a5298', visibility:'private',
  color_scheme:'{}', header_line1:'Ihr Verein', header_line2:'', header_subtitle:'', logo_url:'',
}
const DESIGNS = ['Standard','News','Modern','Einfach']
const FONTS   = ['Arial','Georgia','Times New Roman','Verdana','Courier New','Trebuchet MS']
const SIZES   = ['10px','12px','14px','16px','18px','20px','24px','28px']

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024*1024) return `${(bytes/1024).toFixed(1)} KB`
  return `${(bytes/(1024*1024)).toFixed(1)} MB`
}

// ── Editable inline block ──────────────────────────────────────────────────────
function EB({ init, onChange, style, multiline=false }: {
  init:string; onChange:(v:string)=>void; style?:React.CSSProperties; multiline?:boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { if (ref.current) ref.current.innerText = init }, [])
  return (
    <div ref={ref} contentEditable suppressContentEditableWarning
      onInput={e=>onChange((e.target as HTMLDivElement).innerText)}
      style={{ outline:'none', cursor:'text', whiteSpace:multiline?'pre-wrap':'nowrap', ...style }}/>
  )
}

// ── Rich text editor ───────────────────────────────────────────────────────────
function RichTextEditor({ initialValue, onChange, fields, bodyBg }: {
  initialValue:string; onChange:(v:string)=>void; fields:FieldDef[]; bodyBg:string
}) {
  const editorRef = useRef<HTMLDivElement>(null)
  const savedSel  = useRef<Range|null>(null)
  const [showPH, setShowPH]     = useState(false)
  const [phSearch, setPhSearch] = useState('')

  useEffect(() => { if (editorRef.current) editorRef.current.innerHTML = initialValue }, [])

  function save() { const s=window.getSelection(); if(s&&s.rangeCount>0) savedSel.current=s.getRangeAt(0).cloneRange() }
  function restore() { const s=window.getSelection(); if(s&&savedSel.current){s.removeAllRanges();s.addRange(savedSel.current)} }
  function exec(cmd:string, val?:string) { editorRef.current?.focus(); document.execCommand(cmd,false,val??''); onChange(editorRef.current?.innerHTML??'') }
  function insertPlaceholder(name:string) {
    editorRef.current?.focus(); restore()
    document.execCommand('insertText', false, `{{${name}}}`)
    onChange(editorRef.current?.innerHTML??''); setShowPH(false)
  }

  function Btn({ title,onClick,children }:{ title:string;onClick:()=>void;children:React.ReactNode }) {
    return <button title={title} onMouseDown={e=>{e.preventDefault();onClick()}}
      style={{ padding:'3px 6px',border:'1px solid #d1d5db',borderRadius:3,background:'#fff',
        cursor:'pointer',fontSize:12,color:'#374151',lineHeight:1.4,minWidth:24 }}>{children}</button>
  }

  const vis = fields.filter(f=>!['photo_url','notes_field','file','image'].includes(f.name)&&f.label.toLowerCase().includes(phSearch.toLowerCase()))

  return (
    <div style={{ border:'1px solid #d1d5db',borderRadius:5,overflow:'hidden',background:bodyBg }}>
      {/* Toolbar row 1 */}
      <div style={{ display:'flex',flexWrap:'wrap',gap:3,padding:'5px 8px',background:'#f8f9ff',borderBottom:'1px solid #e5e7eb',alignItems:'center' }}>
        <select onMouseDown={()=>save()} onChange={e=>exec('fontName',e.target.value)} defaultValue=""
          style={{ padding:'2px 4px',border:'1px solid #d1d5db',borderRadius:3,fontSize:12,height:24 }}>
          <option value="" disabled>Schriftart</option>{FONTS.map(f=><option key={f} value={f}>{f}</option>)}
        </select>
        <select onMouseDown={()=>save()} onChange={e=>{ exec('fontSize','7'); if(editorRef.current){ editorRef.current.querySelectorAll('font[size="7"]').forEach((el:any)=>{ el.removeAttribute('size'); el.style.fontSize=e.target.value }) } onChange(editorRef.current?.innerHTML??'') }} defaultValue=""
          style={{ padding:'2px 4px',border:'1px solid #d1d5db',borderRadius:3,fontSize:12,height:24,width:66 }}>
          <option value="" disabled>Größe</option>{SIZES.map(s=><option key={s} value={s}>{s}</option>)}
        </select>
        <div style={{ width:1,height:20,background:'#d1d5db',margin:'0 2px' }}/>
        <Btn title="Nummerierte Liste" onClick={()=>exec('insertOrderedList')}>1≡</Btn>
        <Btn title="Aufzählungsliste" onClick={()=>exec('insertUnorderedList')}>•≡</Btn>
        <div style={{ width:1,height:20,background:'#d1d5db',margin:'0 2px' }}/>
        <Btn title="Linksbündig" onClick={()=>exec('justifyLeft')}>⬛︎</Btn>
        <Btn title="Zentriert" onClick={()=>exec('justifyCenter')}>▣</Btn>
        <Btn title="Rechtsbündig" onClick={()=>exec('justifyRight')}>⬜</Btn>
        <Btn title="Blocksatz" onClick={()=>exec('justifyFull')}>▤</Btn>
      </div>
      {/* Toolbar row 2 */}
      <div style={{ display:'flex',flexWrap:'wrap',gap:3,padding:'4px 8px',background:'#f8f9ff',borderBottom:'1px solid #e5e7eb',alignItems:'center',position:'relative' }}>
        <div style={{ position:'relative' }}>
          <button onMouseDown={e=>{ e.preventDefault(); save(); setShowPH(o=>!o) }}
            style={{ padding:'3px 8px',border:'1px solid #2a5298',borderRadius:3,background:showPH?'#eff4ff':'#fff',cursor:'pointer',fontSize:12,color:'#2a5298',fontWeight:600,height:24 }}>
            Platzhalter ▾
          </button>
          {showPH&&(
            <div style={{ position:'absolute',top:'calc(100% + 4px)',left:0,zIndex:500,background:'#fff',border:'1px solid #e5e7eb',borderRadius:6,boxShadow:'0 6px 20px rgba(0,0,0,.15)',width:220,maxHeight:240,display:'flex',flexDirection:'column' }}>
              <div style={{ padding:'6px 8px',borderBottom:'1px solid #f3f4f6' }}>
                <input autoFocus value={phSearch} onChange={e=>setPhSearch(e.target.value)} placeholder="Feld suchen…"
                  style={{ width:'100%',padding:'4px 8px',border:'1px solid #e5e7eb',borderRadius:4,fontSize:12,boxSizing:'border-box' }}/>
              </div>
              <div style={{ overflowY:'auto',flex:1 }}>
                {vis.length===0&&<div style={{ padding:'10px 12px',fontSize:12,color:'#9ca3af' }}>Kein Feld gefunden</div>}
                {vis.map(f=>(
                  <button key={f.name} onMouseDown={e=>{ e.preventDefault(); insertPlaceholder(f.name) }}
                    style={{ display:'block',width:'100%',textAlign:'left',padding:'7px 12px',background:'none',border:'none',cursor:'pointer',fontSize:13,color:'#374151' }}
                    onMouseEnter={e=>(e.currentTarget.style.background='#f9fafb')}
                    onMouseLeave={e=>(e.currentTarget.style.background='none')}>
                    <span style={{ background:'#dbeafe',color:'#1d4ed8',borderRadius:3,padding:'0 5px',fontSize:11,marginRight:6 }}>{'{{'+f.name+'}}'}</span>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div style={{ width:1,height:20,background:'#d1d5db',margin:'0 2px' }}/>
        <Btn title="Fett" onClick={()=>exec('bold')}><b>B</b></Btn>
        <Btn title="Kursiv" onClick={()=>exec('italic')}><i>I</i></Btn>
        <Btn title="Unterstrichen" onClick={()=>exec('underline')}><u>U</u></Btn>
        <Btn title="Durchgestrichen" onClick={()=>exec('strikeThrough')}><s>S</s></Btn>
        <div style={{ width:1,height:20,background:'#d1d5db',margin:'0 2px' }}/>
        <label title="Schriftfarbe" style={{ display:'flex',alignItems:'center',cursor:'pointer' }}>
          <span style={{ fontSize:13,fontWeight:700,borderBottom:'3px solid #e63b3b',lineHeight:1,paddingBottom:1 }}>A</span>
          <input type="color" defaultValue="#000000" onChange={e=>exec('foreColor',e.target.value)} style={{ width:0,height:0,opacity:0,position:'absolute' }}/>
        </label>
        <label title="Hintergrundfarbe" style={{ display:'flex',alignItems:'center',cursor:'pointer',marginLeft:2 }}>
          <span style={{ fontSize:13,fontWeight:700,background:'#fde047',lineHeight:1,padding:'1px 2px' }}>A</span>
          <input type="color" defaultValue="#ffff00" onChange={e=>exec('hiliteColor',e.target.value)} style={{ width:0,height:0,opacity:0,position:'absolute' }}/>
        </label>
        <div style={{ width:1,height:20,background:'#d1d5db',margin:'0 2px' }}/>
        <Btn title="Formatierung entfernen" onClick={()=>exec('removeFormat')}>I<sub>x</sub></Btn>
      </div>
      {/* Editable body */}
      <div ref={editorRef} contentEditable suppressContentEditableWarning
        onInput={e=>onChange((e.target as HTMLDivElement).innerHTML)}
        onMouseUp={save} onKeyUp={save} onClick={()=>setShowPH(false)}
        style={{ padding:'16px 20px',minHeight:180,outline:'none',fontSize:14,lineHeight:1.8,color:'#111827' }}/>
    </div>
  )
}

// ── Email canvas ───────────────────────────────────────────────────────────────
function EmailCanvas({ form, set, fields }: {
  form:FormData; set:(k:keyof FormData,v:any)=>void; fields:FieldDef[]
}) {
  const colors = parseColors(form.color_scheme, form.primary_color)
  const c = colors
  const isEinfach = form.design === 'einfach'

  return (
    <div style={{ background:c.generalBg,padding:20,flex:1,overflowY:'auto' }}>
      <div style={{ background:c.bodyBg,borderRadius:6,overflow:'hidden',boxShadow:'0 1px 8px rgba(0,0,0,.1)',maxWidth:580,margin:'0 auto' }}>

        {/* Header */}
        {!isEinfach && form.show_header && (
          <div style={{ background:c.primaryBg,padding:'16px 24px',display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:16 }}>
            <div style={{ flex:1 }}>
              <EB init={form.header_line1} onChange={v=>set('header_line1',v)}
                style={{ color:c.headerText,fontSize:18,fontWeight:700,marginBottom:2,
                  minWidth:60,borderBottom:form.header_line1?'none':'1px dashed rgba(255,255,255,.4)' }}/>
              <EB init={form.header_line2} onChange={v=>set('header_line2',v)}
                style={{ color:c.headerText,fontSize:16,fontWeight:600,marginBottom:4,
                  opacity:form.header_line2?1:0.45,minWidth:40,
                  borderBottom:form.header_line2?'none':'1px dashed rgba(255,255,255,.4)' }}/>
              <EB init={form.header_subtitle} onChange={v=>set('header_subtitle',v)}
                style={{ color:'rgba(255,255,255,.85)',fontSize:13,fontStyle:'italic',
                  opacity:form.header_subtitle?1:0.4,minWidth:40,
                  borderBottom:form.header_subtitle?'none':'1px dashed rgba(255,255,255,.35)' }}/>
            </div>
            {/* Logo upload */}
            <label title="Logo hochladen (klicken)" style={{ flexShrink:0,cursor:'pointer',display:'block' }}>
              {form.logo_url
                ? <img src={form.logo_url} style={{ maxWidth:80,maxHeight:64,objectFit:'contain',borderRadius:4,display:'block' }}/>
                : <div style={{ width:64,height:52,borderRadius:4,background:'rgba(255,255,255,.15)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,color:'rgba(255,255,255,.6)',textAlign:'center',lineHeight:1.4,border:'1px dashed rgba(255,255,255,.35)' }}>
                    Logo<br/>klicken
                  </div>
              }
              <input type="file" accept="image/*" style={{ display:'none' }}
                onChange={e=>{ const f=e.target.files?.[0]; if(!f) return; const r=new FileReader(); r.onload=ev=>set('logo_url',ev.target?.result as string); r.readAsDataURL(f) }}/>
            </label>
          </div>
        )}

        {/* Subject as title (Einfach) */}
        {isEinfach && (
          <div style={{ padding:'20px 24px 0',color:c.bodyText,fontSize:20,fontWeight:700 }}>{form.subject||'Betreff'}</div>
        )}

        {/* Body */}
        <div style={{ padding:'16px 24px' }}>
          <RichTextEditor key={`body-${form.design}`} initialValue={form.body} onChange={v=>set('body',v)} fields={fields} bodyBg={c.bodyBg}/>
        </div>

        {/* Button */}
        {form.show_button && (
          <div style={{ padding:'0 24px 16px',display:'flex',alignItems:'center',gap:10,flexWrap:'wrap' }}>
            <div style={{ background:c.buttonBg,borderRadius:4,padding:'10px 20px',cursor:'text',display:'inline-block' }}>
              <EB init={form.button_text} onChange={v=>set('button_text',v)} style={{ color:c.buttonText,fontSize:14,fontWeight:600 }}/>
            </div>
            <input value={form.button_url} onChange={e=>set('button_url',e.target.value)} placeholder="https://… (Link)"
              style={{ flex:1,minWidth:140,padding:'8px 10px',border:'1px dashed #d1d5db',borderRadius:4,fontSize:12,color:'#6b7280',outline:'none' }}/>
          </div>
        )}

        {/* Footer */}
        {!isEinfach && form.show_footer && (
          <div style={{ borderTop:'1px solid #e5e7eb',padding:'12px 24px',background:c.footerBg }}>
            <EB init={form.footer_text} onChange={v=>set('footer_text',v)} multiline
              style={{ fontSize:11,color:c.footerText,lineHeight:1.6 }}/>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Design sidebar ─────────────────────────────────────────────────────────────
function DesignSidebar({ form, set }: { form:FormData; set:(k:keyof FormData,v:any)=>void }) {
  const [openSec, setOpenSec] = useState<Record<string,boolean>>({ kopf:true,fuss:false,button:false,farben:false })
  const toggle = (s:string) => setOpenSec(o=>({...o,[s]:!o[s]}))
  const colors = parseColors(form.color_scheme, form.primary_color)
  const isEinfach = form.design === 'einfach'

  function setColor(k: keyof ColorScheme, v: string) {
    const updated = { ...colors, [k]: v }
    set('color_scheme', JSON.stringify(updated))
    if (k === 'primaryBg') set('primary_color', v)
  }

  function Section({ id,label,children }:{ id:string;label:string;children:React.ReactNode }) {
    const open = openSec[id]
    return (
      <div style={{ borderBottom:'1px solid #e5e7eb' }}>
        <button onClick={()=>toggle(id)} style={{ width:'100%',display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',background:'none',border:'none',cursor:'pointer',fontSize:13,fontWeight:600,color:'#374151' }}>
          {label}<span style={{ fontSize:10,color:'#9ca3af' }}>{open?'▲':'▼'}</span>
        </button>
        {open&&<div style={{ paddingBottom:10 }}>{children}</div>}
      </div>
    )
  }
  function Chk({ label,checked,onChange }:{ label:string;checked:boolean;onChange:(v:boolean)=>void }) {
    return <label style={{ display:'flex',alignItems:'center',gap:6,fontSize:12,cursor:'pointer',marginBottom:6 }}><input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)}/>{label}</label>
  }
  function Txt({ label,value,onChange,placeholder='' }:{ label:string;value:string;onChange:(v:string)=>void;placeholder?:string }) {
    return (
      <div style={{ marginBottom:7 }}>
        <div style={{ fontSize:11,color:'#9ca3af',marginBottom:3 }}>{label}</div>
        <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
          style={{ width:'100%',padding:'5px 8px',border:'1px solid #e5e7eb',borderRadius:4,fontSize:12,boxSizing:'border-box',outline:'none' }}/>
      </div>
    )
  }
  function CP({ label,k }:{ label:string;k:keyof ColorScheme }) {
    return (
      <label style={{ display:'flex',alignItems:'center',gap:8,fontSize:12,cursor:'pointer',marginBottom:5 }}>
        <input type="color" value={colors[k]} onChange={e=>setColor(k,e.target.value)}
          style={{ width:20,height:20,border:'1px solid #d1d5db',borderRadius:3,cursor:'pointer',padding:1 }}/>
        {label}
      </label>
    )
  }

  return (
    <div style={{ width:200,borderLeft:'1px solid #e5e7eb',padding:'12px 14px',overflowY:'auto',flexShrink:0,background:'#fafafa' }}>
      <div style={{ fontWeight:700,fontSize:15,marginBottom:10 }}>Design</div>
      <select value={form.design} onChange={e=>set('design',e.target.value.toLowerCase())}
        style={{ width:'100%',padding:'6px 8px',border:'1px solid #d1d5db',borderRadius:4,fontSize:13,marginBottom:12,background:'#fff' }}>
        {DESIGNS.map(d=><option key={d} value={d.toLowerCase()}>{d}</option>)}
      </select>

      {/* Kopfbereich */}
      {!isEinfach&&(
        <Section id="kopf" label="Kopfbereich">
          <Chk label="Anzeigen" checked={form.show_header} onChange={v=>set('show_header',v)}/>
          {form.show_header&&<>
            <Txt label="Zeile 1" value={form.header_line1} onChange={v=>set('header_line1',v)} placeholder="Vereinsname"/>
            <Txt label="Zeile 2" value={form.header_line2} onChange={v=>set('header_line2',v)} placeholder="Abteilung / Zusatz"/>
            <Txt label="Untertitel" value={form.header_subtitle} onChange={v=>set('header_subtitle',v)} placeholder="z.B. IT & Kommunikation"/>
            <div style={{ fontSize:11,color:'#9ca3af',marginBottom:4 }}>Logo</div>
            {form.logo_url
              ? <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:6 }}>
                  <img src={form.logo_url} style={{ maxWidth:50,maxHeight:36,objectFit:'contain',borderRadius:3,border:'1px solid #e5e7eb' }}/>
                  <button onClick={()=>set('logo_url','')} style={{ fontSize:11,color:'#dc2626',background:'none',border:'none',cursor:'pointer',padding:0 }}>Entfernen</button>
                </div>
              : <label style={{ display:'inline-block',padding:'5px 10px',border:'1px dashed #d1d5db',borderRadius:4,fontSize:11,cursor:'pointer',color:'#6b7280',marginBottom:6 }}>
                  Logo hochladen
                  <input type="file" accept="image/*" style={{ display:'none' }}
                    onChange={e=>{ const f=e.target.files?.[0]; if(!f) return; const r=new FileReader(); r.onload=ev=>set('logo_url',ev.target?.result as string); r.readAsDataURL(f) }}/>
                </label>
            }
          </>}
        </Section>
      )}

      {/* Fußbereich */}
      {!isEinfach&&(
        <Section id="fuss" label="Fußbereich">
          <Chk label="Anzeigen" checked={form.show_footer} onChange={v=>set('show_footer',v)}/>
          {form.show_footer&&(
            <div style={{ marginTop:4 }}>
              <div style={{ fontSize:11,color:'#9ca3af',marginBottom:3 }}>Fußtext</div>
              <textarea value={form.footer_text} onChange={e=>set('footer_text',e.target.value)} rows={3}
                style={{ width:'100%',padding:'5px 8px',border:'1px solid #e5e7eb',borderRadius:4,fontSize:11,boxSizing:'border-box',outline:'none',resize:'vertical' }}/>
            </div>
          )}
        </Section>
      )}

      {/* Button */}
      <Section id="button" label="Button">
        <Chk label="Button anzeigen" checked={form.show_button} onChange={v=>set('show_button',v)}/>
        {form.show_button&&<>
          <Txt label="Beschriftung" value={form.button_text} onChange={v=>set('button_text',v)} placeholder="Mehr erfahren"/>
          <Txt label="URL" value={form.button_url} onChange={v=>set('button_url',v)} placeholder="https://…"/>
          <Chk label="Text nach Button" checked={form.show_button_text_after} onChange={v=>set('show_button_text_after',v)}/>
        </>}
      </Section>

      {/* Farben */}
      <Section id="farben" label="Farben">
        <CP label="Hauptfarbe" k="primaryBg"/>
        <CP label="Kopf-Text" k="headerText"/>
        <CP label="Hintergrund" k="generalBg"/>
        <CP label="E-Mail BG" k="bodyBg"/>
        <CP label="Text" k="bodyText"/>
        <CP label="Fußzeile BG" k="footerBg"/>
        <CP label="Fußzeile Text" k="footerText"/>
        <CP label="Button BG" k="buttonBg"/>
        <CP label="Button Text" k="buttonText"/>
      </Section>
    </div>
  )
}

// ── Attachment panel ───────────────────────────────────────────────────────────
function AttachmentPanel({ templateId, attachments, onUploaded, onDeleted }: {
  templateId:number|null; attachments:Attachment[]; onUploaded:(att:Attachment)=>void; onDeleted:(id:number)=>void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function handleFiles(files: FileList|null) {
    if (!files||files.length===0) return
    if (!templateId) { setError('Bitte zuerst Vorlage speichern, dann Anhänge hinzufügen.'); return }
    setError(''); setUploading(true)
    for (let i=0;i<files.length;i++) {
      const file=files[i]
      if (file.size>20*1024*1024) { setError(`${file.name}: Datei zu groß (max 20 MB)`); continue }
      try {
        const fd=new FormData(); fd.append('file',file)
        const res=await api.post(`/email-templates/${templateId}/attachments`,fd,{ headers:{'Content-Type':'multipart/form-data'} })
        onUploaded(res.data)
      } catch { setError(`Fehler beim Hochladen: ${file.name}`) }
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value=''
  }

  async function handleDelete(id:number,name:string) {
    if (!window.confirm(`"${name}" entfernen?`)) return
    await api.delete(`/email-templates/attachments/${id}`)
    onDeleted(id)
  }

  return (
    <div style={{ padding:'10px 20px',borderTop:'1px solid #e5e7eb',background:'#fafafa' }}>
      <div style={{ display:'flex',alignItems:'center',gap:10,flexWrap:'wrap' }}>
        <button type="button" onClick={()=>fileRef.current?.click()} disabled={uploading||!templateId}
          title={!templateId?'Zuerst Vorlage speichern':''}
          style={{ background:'none',border:'1px solid #d1d5db',borderRadius:4,cursor:templateId?'pointer':'not-allowed',
            fontSize:13,color:templateId?'#2a5298':'#9ca3af',display:'flex',alignItems:'center',gap:5,padding:'5px 10px' }}>
          {uploading?'⏳ Lädt…':'📎 Datei anhängen'}
        </button>
        {!templateId&&<span style={{ fontSize:11,color:'#9ca3af' }}>Vorlage erst speichern</span>}
        {error&&<span style={{ fontSize:11,color:'#ef4444' }}>{error}</span>}
        <input ref={fileRef} type="file" multiple style={{ display:'none' }} onChange={e=>handleFiles(e.target.files)}/>
      </div>
      {attachments.length>0&&(
        <div style={{ marginTop:8,display:'flex',flexWrap:'wrap',gap:6 }}>
          {attachments.map(att=>(
            <div key={att.id} style={{ display:'flex',alignItems:'center',gap:6,background:'#fff',border:'1px solid #e5e7eb',borderRadius:4,padding:'4px 8px',fontSize:12 }}>
              <span style={{ color:'#374151' }}>📄 {att.original_name}</span>
              <span style={{ color:'#9ca3af',fontSize:11 }}>({fmtSize(att.file_size)})</span>
              <button onClick={()=>handleDelete(att.id,att.original_name)}
                style={{ background:'none',border:'none',cursor:'pointer',color:'#9ca3af',fontSize:14,lineHeight:1,padding:'0 2px' }} title="Entfernen">×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Template card ──────────────────────────────────────────────────────────────
function TemplateCard({ t, onEdit, onDelete }: { t:Template; onEdit:()=>void; onDelete:()=>void }) {
  const colors = parseColors(t.color_scheme||'{}', t.primary_color)
  return (
    <div style={{ background:'#fff',border:'1px solid #e5e7eb',borderRadius:8,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,.06)',display:'flex',flexDirection:'column' }}>
      <div style={{ height:130,overflow:'hidden',background:colors.generalBg,cursor:'pointer',position:'relative' }} onClick={onEdit}>
        {t.design!=='einfach'&&t.show_header&&(
          <div style={{ background:colors.primaryBg,padding:'8px 12px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:8 }}>
            <div>
              <div style={{ color:colors.headerText,fontSize:10,fontWeight:700 }}>{t.header_line1||'Ihr Verein'}</div>
              {t.header_line2&&<div style={{ color:colors.headerText,fontSize:9,opacity:.8 }}>{t.header_line2}</div>}
            </div>
            {t.logo_url&&<img src={t.logo_url} style={{ maxWidth:28,maxHeight:22,objectFit:'contain' }} alt=""/>}
          </div>
        )}
        {t.design!=='einfach'&&<div style={{ padding:'6px 12px',fontSize:12,fontWeight:700,color:colors.bodyText,background:colors.bodyBg }}>{t.title}</div>}
        <div style={{ padding:'4px 12px',fontSize:10,color:colors.bodyText,lineHeight:1.5,background:colors.bodyBg }} dangerouslySetInnerHTML={{ __html:t.body.slice(0,300) }}/>
        <div style={{ position:'absolute',inset:0,background:'linear-gradient(to bottom,transparent 50%,rgba(249,250,251,.95))' }}/>
      </div>
      <div style={{ padding:'10px 12px',borderTop:'1px solid #f3f4f6' }}>
        <div style={{ fontWeight:600,fontSize:13,marginBottom:2,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>{t.name}</div>
        <div style={{ fontSize:11,color:'#9ca3af',marginBottom:4 }}>{t.design} · {t.visibility==='public'?'Alle':'Nur ich'}</div>
        {t.attachments?.length>0&&<div style={{ fontSize:11,color:'#6b7280',marginBottom:6 }}>📎 {t.attachments.length} Anhang{t.attachments.length>1?'änge':''}</div>}
        <div style={{ display:'flex',gap:6 }}>
          <button onClick={onEdit} style={{ flex:1,padding:'5px',background:'#2a5298',color:'#fff',border:'none',borderRadius:4,cursor:'pointer',fontSize:12,fontWeight:600 }}>Bearbeiten</button>
          <button onClick={onDelete} style={{ padding:'5px 8px',background:'none',border:'1px solid #fca5a5',borderRadius:4,cursor:'pointer',fontSize:12,color:'#dc2626' }}>✕</button>
        </div>
      </div>
    </div>
  )
}

// ── Template modal ─────────────────────────────────────────────────────────────
function TemplateModal({ initial, onClose, onSave, fields }: {
  initial:Partial<Template>|null; onClose:()=>void
  onSave:(data:FormData,id?:number)=>Promise<Template>; fields:FieldDef[]
}) {
  const [form, setForm]     = useState<FormData>({ ...EMPTY, ...(initial ?? {}) })
  const [savedId, setSavedId] = useState<number|null>((initial as Template)?.id ?? null)
  const [attachments, setAttachments] = useState<Attachment[]>((initial as Template)?.attachments ?? [])
  const [sideOpen, setSideOpen] = useState(true)
  const [errors, setErrors] = useState<Record<string,string>>({})
  const isEdit = !!(initial as Template)?.id

  function set(k: keyof FormData, v: any) { setForm(f=>({...f,[k]:v})) }

  async function handleSave() {
    const errs: Record<string,string> = {}
    if (!form.name.trim()) errs.name='Name ist erforderlich'
    if (!form.subject.trim()) errs.subject='Betreff darf nicht leer sein'
    if (Object.keys(errs).length) { setErrors(errs); return }
    const saved = await onSave(form, (initial as Template)?.id)
    if (saved?.id) setSavedId(saved.id)
  }

  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16 }}>
      <div style={{ background:'#fff',borderRadius:10,width:'min(1000px,96vw)',maxHeight:'93vh',display:'flex',flexDirection:'column',boxShadow:'0 24px 64px rgba(0,0,0,.3)' }}>

        {/* Title bar */}
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 20px',borderBottom:'1px solid #e5e7eb',flexShrink:0 }}>
          <h2 style={{ margin:0,fontSize:18,fontWeight:700 }}>{isEdit?'E-Mail-Vorlage bearbeiten':'E-Mail-Vorlage erstellen'}</h2>
          <button onClick={onClose} style={{ background:'none',border:'none',fontSize:22,cursor:'pointer',color:'#6b7280',lineHeight:1 }}>×</button>
        </div>

        {/* Name + Visibility */}
        <div style={{ display:'flex',alignItems:'center',gap:20,padding:'10px 20px',borderBottom:'1px solid #e5e7eb',flexShrink:0,flexWrap:'wrap',background:'#fafafa' }}>
          <div style={{ display:'flex',alignItems:'center',gap:8,flex:1,minWidth:200 }}>
            <label style={{ fontSize:13,color:'#374151',whiteSpace:'nowrap' }}>Name der E-Mail-Vorlage:</label>
            <div style={{ flex:1 }}>
              <input value={form.name} onChange={e=>set('name',e.target.value)} placeholder="Name der Vorlage"
                style={{ width:'100%',padding:'6px 10px',border:`1px solid ${errors.name?'#ef4444':'#d1d5db'}`,borderRadius:4,fontSize:13,boxSizing:'border-box' }}/>
              {errors.name&&<div style={{ fontSize:11,color:'#ef4444',marginTop:2 }}>{errors.name}</div>}
            </div>
          </div>
          <div style={{ display:'flex',alignItems:'center',gap:12 }}>
            <span style={{ fontSize:13,color:'#374151' }}>Sichtbarkeit:</span>
            {[['private','Nur ich'],['public','Alle Benutzer']].map(([v,l])=>(
              <label key={v} style={{ display:'flex',alignItems:'center',gap:4,fontSize:13,cursor:'pointer' }}>
                <input type="radio" name="vis" value={v} checked={form.visibility===v} onChange={()=>set('visibility',v as any)}/>{l}
              </label>
            ))}
          </div>
        </div>

        {/* Subject */}
        <div style={{ padding:'0 20px',borderBottom:'1px solid #e5e7eb',flexShrink:0 }}>
          <input value={form.subject} onChange={e=>set('subject',e.target.value)} placeholder="Betreff eingeben"
            style={{ width:'100%',padding:'12px 0',border:'none',fontSize:16,outline:'none',boxSizing:'border-box',
              borderBottom:errors.subject?'2px solid #ef4444':'none' }}/>
          {errors.subject&&<div style={{ fontSize:11,color:'#ef4444',paddingBottom:4 }}>{errors.subject}</div>}
        </div>

        {/* Editor area */}
        <div style={{ display:'flex',flex:1,overflow:'hidden',minHeight:0 }}>
          <EmailCanvas form={form} set={set} fields={fields}/>
          <div style={{ display:'flex',flexDirection:'column',borderLeft:'1px solid #e5e7eb',flexShrink:0 }}>
            <button onClick={()=>setSideOpen(o=>!o)}
              style={{ padding:'12px 7px',background:'none',border:'none',cursor:'pointer',color:'#9ca3af',fontSize:14 }}>
              {sideOpen?'›':'‹'}
            </button>
          </div>
          {sideOpen&&<DesignSidebar form={form} set={set}/>}
        </div>

        {/* Attachment panel */}
        <AttachmentPanel
          templateId={savedId} attachments={attachments}
          onUploaded={att=>setAttachments(a=>[...a,att])}
          onDeleted={id=>setAttachments(a=>a.filter(x=>x.id!==id))}/>

        {/* Footer */}
        <div style={{ borderTop:'1px solid #e5e7eb',padding:'12px 20px',display:'flex',gap:10,flexShrink:0,alignItems:'center' }}>
          <button onClick={handleSave}
            style={{ padding:'9px 24px',background:'#16a34a',color:'#fff',border:'none',borderRadius:5,fontWeight:700,fontSize:14,cursor:'pointer' }}>
            {isEdit?'Speichern':'Erstellen'}
          </button>
          <button onClick={onClose}
            style={{ padding:'9px 20px',border:'1px solid #d1d5db',borderRadius:5,background:'#fff',fontSize:14,cursor:'pointer',color:'#374151' }}>
            Schliessen
          </button>
          {!savedId&&<span style={{ fontSize:12,color:'#9ca3af',marginLeft:4 }}>💡 Nach dem Erstellen können Anhänge hinzugefügt werden</span>}
        </div>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function EmailTemplatesPage() {
  const qc = useQueryClient()
  const [modal, setModal] = useState<Partial<Template>|null|false>(false)

  const { data: templates=[] } = useQuery<Template[]>({
    queryKey:['email-templates'],
    queryFn:()=>api.get('/email-templates').then(r=>r.data),
  })
  const { data: rawFields=[] } = useQuery<FieldDef[]>({
    queryKey:['fields'],
    queryFn:()=>api.get('/fields').then(r=>r.data),
  })

  const saveMut = useMutation({
    mutationFn:({data,id}:{data:FormData;id?:number})=>
      id ? api.put(`/email-templates/${id}`,data) : api.post('/email-templates',data),
    onSuccess:()=>qc.invalidateQueries({queryKey:['email-templates']}),
  })
  const delMut = useMutation({
    mutationFn:(id:number)=>api.delete(`/email-templates/${id}`),
    onSuccess:()=>qc.invalidateQueries({queryKey:['email-templates']}),
  })

  const allFields: FieldDef[] = [...rawFields,
    { name:'age', label:'Alter', field_type:'number' },
    { name:'anrede', label:'Anrede', field_type:'text' },
    { name:'anrede_name', label:'Anrede + Name', field_type:'text' },
  ]

  async function handleSave(data: FormData, id?: number): Promise<Template> {
    const res = await saveMut.mutateAsync({data, id})
    return res.data
  }

  return (
    <div>
      <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24 }}>
        <h1 style={{ fontSize:22,fontWeight:700,margin:0 }}>E-Mail Vorlagen</h1>
        <button onClick={()=>setModal(null)}
          style={{ padding:'8px 18px',background:'#16a34a',color:'#fff',border:'none',borderRadius:5,fontWeight:600,fontSize:14,cursor:'pointer' }}>
          + Neue Vorlage
        </button>
      </div>

      {templates.length===0&&(
        <div style={{ background:'#fff',border:'1px solid #e5e7eb',borderRadius:8,padding:'48px 24px',textAlign:'center',color:'#6b7280' }}>
          <div style={{ fontSize:36,marginBottom:12 }}>📄</div>
          <div style={{ fontSize:16,fontWeight:600,color:'#374151',marginBottom:6 }}>Noch keine Vorlagen</div>
          <button onClick={()=>setModal(null)}
            style={{ marginTop:12,padding:'8px 20px',background:'#16a34a',color:'#fff',border:'none',borderRadius:5,fontWeight:600,fontSize:13,cursor:'pointer' }}>
            + Neue Vorlage erstellen
          </button>
        </div>
      )}

      <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:16 }}>
        {templates.map(t=>(
          <TemplateCard key={t.id} t={t}
            onEdit={()=>setModal(t)}
            onDelete={()=>{ if(window.confirm(`"${t.name}" löschen?`)) delMut.mutate(t.id) }}/>
        ))}
      </div>

      {modal!==false&&(
        <TemplateModal initial={modal} onClose={()=>setModal(false)} onSave={handleSave} fields={allFields}/>
      )}
    </div>
  )
}
