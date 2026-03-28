import { useState, useRef, useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../api/client'
import { useMe } from '../hooks/useAuth'

// ── Types ──────────────────────────────────────────────────────────────────────
interface Recipient { id?: number; name: string; email: string }
interface Template  {
  id: number; name: string; subject: string; title: string; body: string
  footer_text: string; design: string; show_header: boolean; show_footer: boolean
  show_button: boolean; button_text: string; button_url: string
  show_button_text_after: boolean; button_text_after: string
  primary_color: string; visibility: string; color_scheme: string
}
interface HistoryItem {
  id: number; sent_at: string; subject: string; recipient_count: number
  template_name: string; body_preview: string
  color_scheme: string; design: string; primary_color: string
}
interface FieldDef  { name: string; label: string; field_type: string }
interface EmailSettings { send_mode: string }

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
function parseColors(json: string): ColorScheme {
  try { return { ...DEFAULT_COLORS, ...JSON.parse(json) } } catch { return DEFAULT_COLORS }
}

interface ComposeForm {
  subject: string; headerLine1: string; headerLine2: string; headerSubtitle: string
  body: string; footerText: string; design: string
  show_header: boolean; show_footer: boolean; show_button: boolean
  button_text: string; button_url: string; colors: ColorScheme
  templateName: string; templateId?: number
  cc: Recipient[]; bcc: Recipient[]
  from_name: string; from_email: string; logo_url: string
  serial: boolean
}
const EMPTY_FORM: ComposeForm = {
  subject:'', headerLine1:'Ihr Verein', headerLine2:'', headerSubtitle:'',
  body:'<p>Guten Tag,</p><p><br></p><p></p><p>Freundliche Grüße</p>',
  footerText:'Diese Nachricht wurde von Vereins-CRM versandt.',
  design:'standard', show_header:true, show_footer:true, show_button:false,
  button_text:'Mehr erfahren', button_url:'', colors:DEFAULT_COLORS, templateName:'',
  cc:[], bcc:[],
  from_name:'', from_email:'', logo_url:'',
  serial: false,
}
const DESIGNS = ['Standard','News','Modern','Einfach']
const FONTS   = ['Arial','Georgia','Times New Roman','Verdana','Courier New','Trebuchet MS']
const SIZES   = ['10px','12px','14px','16px','18px','20px','24px','28px']

// ── EditableBlock ──────────────────────────────────────────────────────────────
function EB({ init, onChange, style, multiline=false }: {
  init:string; onChange:(v:string)=>void; style?:React.CSSProperties; multiline?:boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { if (ref.current) ref.current.innerText = init }, [])
  return (
    <div ref={ref} contentEditable suppressContentEditableWarning
      onInput={e=>onChange((e.target as HTMLDivElement).innerText)}
      style={{ outline:'none', cursor:'text', whiteSpace: multiline?'pre-wrap':'nowrap', ...style }} />
  )
}

// ── RichTextEditor ─────────────────────────────────────────────────────────────
function RichTextEditor({ initialValue, onChange, fields, colors }: {
  initialValue:string; onChange:(v:string)=>void; fields:FieldDef[]; colors:ColorScheme
}) {
  const editorRef  = useRef<HTMLDivElement>(null)
  const savedSel   = useRef<Range|null>(null)
  const [showPH, setShowPH]     = useState(false)
  const [phSearch, setPhSearch] = useState('')
  useEffect(() => { if (editorRef.current) editorRef.current.innerHTML = initialValue }, [])
  function save() { const s=window.getSelection(); if(s&&s.rangeCount>0) savedSel.current=s.getRangeAt(0).cloneRange() }
  function restore() { const s=window.getSelection(); if(s&&savedSel.current){s.removeAllRanges();s.addRange(savedSel.current)} }
  function exec(cmd:string,val?:string){ editorRef.current?.focus(); document.execCommand(cmd,false,val??''); onChange(editorRef.current?.innerHTML??'') }
  function insertPH(name:string){
    editorRef.current?.focus(); restore()
    document.execCommand('insertText',false,`{{${name}}}`)
    onChange(editorRef.current?.innerHTML??''); setShowPH(false)
  }
  function Btn({ title,onClick,children }:{ title:string;onClick:()=>void;children:React.ReactNode }) {
    return <button title={title} onMouseDown={e=>{e.preventDefault();onClick()}} style={{ padding:'3px 6px',border:'1px solid #d1d5db',borderRadius:3,background:'#fff',cursor:'pointer',fontSize:12,color:'#374151',lineHeight:1.4,minWidth:24 }}>{children}</button>
  }
  const vis = fields.filter(f=>!['photo_url','notes_field','file','image'].includes(f.name)&&f.label.toLowerCase().includes(phSearch.toLowerCase()))
  return (
    <div style={{ border:'1px solid #d1d5db',borderRadius:5,overflow:'hidden',background:colors.bodyBg }}>
      <div style={{ display:'flex',flexWrap:'wrap',gap:3,padding:'5px 8px',background:'#f8f9ff',borderBottom:'1px solid #e5e7eb',alignItems:'center' }}>
        <select onMouseDown={()=>save()} onChange={e=>exec('fontName',e.target.value)} defaultValue="" style={{ padding:'2px 4px',border:'1px solid #d1d5db',borderRadius:3,fontSize:12,height:24 }}>
          <option value="" disabled>Schriftart</option>{FONTS.map(f=><option key={f} value={f}>{f}</option>)}
        </select>
        <select onMouseDown={()=>save()} onChange={e=>{exec('fontSize','7');if(editorRef.current){editorRef.current.querySelectorAll('font[size="7"]').forEach((el:any)=>{el.removeAttribute('size');el.style.fontSize=e.target.value})}onChange(editorRef.current?.innerHTML??'')}} defaultValue="" style={{ padding:'2px 4px',border:'1px solid #d1d5db',borderRadius:3,fontSize:12,height:24,width:66 }}>
          <option value="" disabled>Größe</option>{SIZES.map(s=><option key={s} value={s}>{s}</option>)}
        </select>
        <div style={{ width:1,height:20,background:'#d1d5db',margin:'0 2px' }}/>
        <Btn title="Fett" onClick={()=>exec('bold')}><b>B</b></Btn>
        <Btn title="Kursiv" onClick={()=>exec('italic')}><i>I</i></Btn>
        <Btn title="Unterstrichen" onClick={()=>exec('underline')}><u>U</u></Btn>
        <Btn title="Durchgestrichen" onClick={()=>exec('strikeThrough')}><s>S</s></Btn>
        <div style={{ width:1,height:20,background:'#d1d5db',margin:'0 2px' }}/>
        <Btn title="Nummerierte Liste" onClick={()=>exec('insertOrderedList')}>1≡</Btn>
        <Btn title="Aufzählungsliste" onClick={()=>exec('insertUnorderedList')}>•≡</Btn>
        <Btn title="Linksbündig" onClick={()=>exec('justifyLeft')}>⬛︎</Btn>
        <Btn title="Zentriert" onClick={()=>exec('justifyCenter')}>▣</Btn>
        <Btn title="Rechtsbündig" onClick={()=>exec('justifyRight')}>⬜</Btn>
        <div style={{ width:1,height:20,background:'#d1d5db',margin:'0 2px' }}/>
        <label title="Schriftfarbe" style={{ display:'flex',alignItems:'center',cursor:'pointer' }}>
          <span style={{ fontSize:13,fontWeight:700,borderBottom:'3px solid #e63b3b',lineHeight:1,paddingBottom:1 }}>A</span>
          <input type="color" defaultValue="#000000" onChange={e=>exec('foreColor',e.target.value)} style={{ width:0,height:0,opacity:0,position:'absolute' }}/>
        </label>
        <div style={{ width:1,height:20,background:'#d1d5db',margin:'0 2px' }}/>
        <div style={{ position:'relative' }}>
          <button onMouseDown={e=>{e.preventDefault();save();setShowPH(o=>!o)}} style={{ padding:'3px 8px',border:'1px solid #2a5298',borderRadius:3,background:showPH?'#eff4ff':'#fff',cursor:'pointer',fontSize:12,color:'#2a5298',fontWeight:600,height:24 }}>Platzhalter ▾</button>
          {showPH&&(
            <div style={{ position:'absolute',top:'calc(100% + 4px)',left:0,zIndex:500,background:'#fff',border:'1px solid #e5e7eb',borderRadius:6,boxShadow:'0 6px 20px rgba(0,0,0,.15)',width:220,maxHeight:240,display:'flex',flexDirection:'column' }}>
              <div style={{ padding:'6px 8px',borderBottom:'1px solid #f3f4f6' }}>
                <input autoFocus value={phSearch} onChange={e=>setPhSearch(e.target.value)} placeholder="Feld suchen…" style={{ width:'100%',padding:'4px 8px',border:'1px solid #e5e7eb',borderRadius:4,fontSize:12,boxSizing:'border-box' }}/>
              </div>
              <div style={{ overflowY:'auto',flex:1 }}>
                {vis.map(f=>(
                  <button key={f.name} onMouseDown={e=>{e.preventDefault();insertPH(f.name)}} style={{ display:'block',width:'100%',textAlign:'left',padding:'7px 12px',background:'none',border:'none',cursor:'pointer',fontSize:13,color:'#374151' }} onMouseEnter={e=>(e.currentTarget.style.background='#f9fafb')} onMouseLeave={e=>(e.currentTarget.style.background='none')}>
                    <span style={{ background:'#dbeafe',color:'#1d4ed8',borderRadius:3,padding:'0 5px',fontSize:11,marginRight:6 }}>{'{{'+ f.name +'}}'}</span>{f.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <Btn title="Formatierung entfernen" onClick={()=>exec('removeFormat')}>I<sub>x</sub></Btn>
      </div>
      <div ref={editorRef} contentEditable suppressContentEditableWarning
        onInput={e=>onChange((e.target as HTMLDivElement).innerHTML)}
        onMouseUp={save} onKeyUp={save} onClick={()=>setShowPH(false)}
        style={{ padding:'16px 20px',minHeight:160,outline:'none',fontSize:14,lineHeight:1.8,color:colors.bodyText,background:colors.bodyBg }}/>
    </div>
  )
}

// ── RecipientInput with member autocomplete ────────────────────────────────────
function RecipientInput({ label, value, onChange }: {
  label: string; value: Recipient[]; onChange:(v:Recipient[])=>void
}) {
  const [input,    setInput]    = useState('')
  const [results,  setResults]  = useState<Recipient[]>([])
  const [showDrop, setShowDrop] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>|null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function doSearch(q: string) {
    setInput(q)
    if (timerRef.current) clearTimeout(timerRef.current)
    if (q.trim().length < 2) { setResults([]); setShowDrop(false); return }
    timerRef.current = setTimeout(async () => {
      try {
        const res = await api.get('/members', { params:{ search:q, page:1, size:8, active_only:false } })
        const members = (res.data.items ?? [])
          .filter((m:any)=>m.email)
          .map((m:any)=>({ name:`${m.last_name} ${m.first_name}`.trim(), email:m.email }))
        setResults(members); setShowDrop(members.length > 0)
      } catch { setResults([]); setShowDrop(false) }
    }, 280)
  }

  function add(r: Recipient) {
    if (!r.email) return
    if (!value.find(x=>x.email===r.email)) onChange([...value, r])
    setInput(''); setResults([]); setShowDrop(false)
    setTimeout(()=>inputRef.current?.focus(), 0)
  }

  function addRaw() {
    const email = input.trim()
    if (!email || !email.includes('@')) return
    add({ name:email, email })
  }

  return (
    <div style={{ display:'flex', alignItems:'flex-start', gap:0, padding:'0 20px', borderBottom:'1px solid #f0f2f5' }}>
      <span style={{ fontSize:13, color:'#9ca3af', width:38, flexShrink:0, paddingTop:9, userSelect:'none' }}>{label}:</span>
      <div style={{ flex:1, position:'relative', display:'flex', flexWrap:'wrap', gap:4, alignItems:'center', padding:'5px 0', minHeight:36 }}>
        {value.map(r=>(
          <span key={r.email} style={{ display:'inline-flex', alignItems:'center', gap:3, background:'#eff4ff', color:'#2a5298', border:'1px solid #c7d2fe', borderRadius:12, padding:'2px 8px 2px 10px', fontSize:12, fontWeight:500 }}>
            {r.name && r.name!==r.email ? `${r.name}` : r.email}
            <button onMouseDown={e=>{e.preventDefault();onChange(value.filter(x=>x.email!==r.email))}}
              style={{ background:'none', border:'none', cursor:'pointer', color:'#818cf8', fontSize:14, padding:'0 1px', lineHeight:1, marginLeft:2 }}>×</button>
          </span>
        ))}
        <input ref={inputRef} value={input} onChange={e=>doSearch(e.target.value)}
          onKeyDown={e=>{
            if ((e.key==='Enter'||e.key===','||e.key==='Tab') && input.trim()) { e.preventDefault(); addRaw() }
            if (e.key==='Backspace' && !input && value.length>0) onChange(value.slice(0,-1))
            if (e.key==='Escape') { setShowDrop(false); setInput('') }
          }}
          onBlur={()=>setTimeout(()=>setShowDrop(false), 200)}
          placeholder={value.length===0 ? 'Name oder E-Mail-Adresse eingeben…' : ''}
          style={{ border:'none', outline:'none', fontSize:13, flex:1, minWidth:180, padding:'2px 0', background:'transparent', color:'#111827' }}/>
        {showDrop && results.length>0 && (
          <div style={{ position:'absolute', top:'100%', left:0, zIndex:400, background:'#fff', border:'1px solid #e5e7eb', borderRadius:7, boxShadow:'0 8px 24px rgba(0,0,0,.12)', width:'min(380px,100%)', maxHeight:220, overflowY:'auto' }}>
            {results.map(r=>(
              <button key={r.email} onMouseDown={e=>{e.preventDefault();add(r)}}
                style={{ display:'flex', alignItems:'center', gap:10, width:'100%', padding:'9px 14px', background:'none', border:'none', cursor:'pointer', textAlign:'left' }}
                onMouseEnter={e=>e.currentTarget.style.background='#f9fafb'}
                onMouseLeave={e=>e.currentTarget.style.background='none'}>
                <div style={{ width:32, height:32, borderRadius:'50%', background:'#eff4ff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:'#2a5298', flexShrink:0 }}>
                  {r.name?r.name[0].toUpperCase():r.email[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:'#111827' }}>{r.name}</div>
                  <div style={{ fontSize:11, color:'#9ca3af' }}>{r.email}</div>
                </div>
              </button>
            ))}
            {input.includes('@') && !results.find(r=>r.email===input.trim()) && (
              <button onMouseDown={e=>{e.preventDefault();addRaw()}}
                style={{ display:'flex', alignItems:'center', gap:10, width:'100%', padding:'8px 14px', background:'none', borderTop:'1px solid #f3f4f6', border:'none', cursor:'pointer', textAlign:'left' }}
                onMouseEnter={e=>e.currentTarget.style.background='#f0fdf4'}
                onMouseLeave={e=>e.currentTarget.style.background='none'}>
                <div style={{ width:32, height:32, borderRadius:'50%', background:'#dcfce7', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, color:'#16a34a', flexShrink:0 }}>+</div>
                <div style={{ fontSize:13, color:'#374151' }}>„<b>{input.trim()}</b>" direkt hinzufügen</div>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── WYSIWYG Canvas ─────────────────────────────────────────────────────────────
function WysiwygCanvas({ form, setForm, fields }: {
  form:ComposeForm; setForm:React.Dispatch<React.SetStateAction<ComposeForm>>; fields:FieldDef[]
}) {
  const c = form.colors
  function set(k: keyof ComposeForm, v: any) { setForm(f=>({...f,[k]:v})) }
  const isEinfach = form.design==='einfach'
  return (
    <div style={{ background:c.generalBg,padding:20,flex:1,overflowY:'auto' }}>
      <div style={{ background:c.bodyBg,borderRadius:6,overflow:'hidden',boxShadow:'0 1px 8px rgba(0,0,0,.1)',maxWidth:580,margin:'0 auto' }}>

        {/* Header */}
        {!isEinfach && form.show_header && (
          <div style={{ background:c.primaryBg,padding:'16px 24px',display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:16 }}>
            <div style={{ flex:1 }}>
              <EB init={form.headerLine1} onChange={v=>set('headerLine1',v)}
                style={{ color:c.headerText,fontSize:18,fontWeight:700,marginBottom:2,
                  minWidth:60,borderBottom:form.headerLine1?'none':'1px dashed rgba(255,255,255,.4)' }}/>
              <EB init={form.headerLine2} onChange={v=>set('headerLine2',v)}
                style={{ color:c.headerText,fontSize:16,fontWeight:600,marginBottom:4,
                  opacity:form.headerLine2?1:0.45,minWidth:40,
                  borderBottom:form.headerLine2?'none':'1px dashed rgba(255,255,255,.4)' }}/>
              <EB init={form.headerSubtitle} onChange={v=>set('headerSubtitle',v)}
                style={{ color:'rgba(255,255,255,.85)',fontSize:13,fontStyle:'italic',
                  opacity:form.headerSubtitle?1:0.4,minWidth:40,
                  borderBottom:form.headerSubtitle?'none':'1px dashed rgba(255,255,255,.35)' }}/>
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
                onChange={e=>{
                  const file=e.target.files?.[0]; if(!file) return
                  const r=new FileReader()
                  r.onload=ev=>set('logo_url', ev.target?.result as string)
                  r.readAsDataURL(file)
                }}/>
            </label>
          </div>
        )}

        {/* Subject as title (Einfach design shows it here) */}
        {isEinfach && (
          <div style={{ padding:'20px 24px 0',color:c.bodyText,fontSize:20,fontWeight:700 }}>{form.subject||'Betreff'}</div>
        )}

        {/* Body */}
        <div style={{ padding:'16px 24px' }}>
          <RichTextEditor key={`body-${form.design}`} initialValue={form.body} onChange={v=>set('body',v)} fields={fields} colors={c}/>
        </div>

        {/* Button */}
        {form.show_button&&(
          <div style={{ padding:'0 24px 16px',display:'flex',alignItems:'center',gap:10,flexWrap:'wrap' }}>
            <div style={{ background:c.buttonBg,borderRadius:4,padding:'10px 20px',cursor:'text',display:'inline-block' }}>
              <EB init={form.button_text} onChange={v=>set('button_text',v)} style={{ color:c.buttonText,fontSize:14,fontWeight:600 }}/>
            </div>
            <input value={form.button_url} onChange={e=>set('button_url',e.target.value)} placeholder="https://… (Link)"
              style={{ flex:1,minWidth:140,padding:'8px 10px',border:'1px dashed #d1d5db',borderRadius:4,fontSize:12,color:'#6b7280',outline:'none' }}/>
          </div>
        )}

        {/* Footer */}
        {!isEinfach&&form.show_footer&&(
          <div style={{ borderTop:'1px solid #e5e7eb',padding:'12px 24px',background:c.footerBg }}>
            <EB init={form.footerText} onChange={v=>set('footerText',v)} multiline
              style={{ fontSize:11,color:c.footerText,lineHeight:1.6 }}/>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Design Sidebar ─────────────────────────────────────────────────────────────
function DesignSidebar({ form, setForm }: { form:ComposeForm; setForm:React.Dispatch<React.SetStateAction<ComposeForm>> }) {
  const [openSec, setOpenSec] = useState<Record<string,boolean>>({ kopf:true, fuss:false, button:false, farben:false })
  function toggleSec(s:string){ setOpenSec(o=>({...o,[s]:!o[s]})) }

  function set(k: keyof ComposeForm, v: any) { setForm(f=>({...f,[k]:v})) }
  function setColor(k: keyof ColorScheme, v: string) { setForm(f=>({...f,colors:{...f.colors,[k]:v}})) }
  const c = form.colors
  const isEinfach = form.design==='einfach'

  function CP({ label, k }: { label:string; k: keyof ColorScheme }) {
    return (
      <label style={{ display:'flex',alignItems:'center',gap:8,fontSize:12,cursor:'pointer',marginBottom:5 }}>
        <input type="color" value={c[k]} onChange={e=>setColor(k,e.target.value)}
          style={{ width:20,height:20,border:'1px solid #d1d5db',borderRadius:3,cursor:'pointer',padding:1 }}/>
        {label}
      </label>
    )
  }
  function Section({ id, label, children }: { id:string; label:string; children:React.ReactNode }) {
    const open = openSec[id]
    return (
      <div style={{ borderBottom:'1px solid #e5e7eb',marginBottom:0 }}>
        <button onClick={()=>toggleSec(id)}
          style={{ width:'100%',display:'flex',justifyContent:'space-between',alignItems:'center',
            padding:'8px 0',background:'none',border:'none',cursor:'pointer',fontSize:13,fontWeight:600,color:'#374151' }}>
          {label}
          <span style={{ fontSize:10,color:'#9ca3af' }}>{open?'▲':'▼'}</span>
        </button>
        {open&&<div style={{ paddingBottom:10 }}>{children}</div>}
      </div>
    )
  }
  function Chk({ label, checked, onChange }: { label:string; checked:boolean; onChange:(v:boolean)=>void }) {
    return (
      <label style={{ display:'flex',alignItems:'center',gap:6,fontSize:12,cursor:'pointer',marginBottom:6 }}>
        <input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)}/>{label}
      </label>
    )
  }
  function TxtInput({ label, value, onChange, placeholder='' }: { label:string; value:string; onChange:(v:string)=>void; placeholder?:string }) {
    return (
      <div style={{ marginBottom:7 }}>
        <div style={{ fontSize:11,color:'#9ca3af',marginBottom:3 }}>{label}</div>
        <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
          style={{ width:'100%',padding:'5px 8px',border:'1px solid #e5e7eb',borderRadius:4,fontSize:12,boxSizing:'border-box',outline:'none' }}/>
      </div>
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
            <TxtInput label="Zeile 1" value={form.headerLine1} onChange={v=>set('headerLine1',v)} placeholder="Vereinsname"/>
            <TxtInput label="Zeile 2" value={form.headerLine2} onChange={v=>set('headerLine2',v)} placeholder="Abteilung / Zusatz"/>
            <TxtInput label="Untertitel" value={form.headerSubtitle} onChange={v=>set('headerSubtitle',v)} placeholder="z.B. IT & Kommunikation"/>
            <div style={{ fontSize:11,color:'#9ca3af',marginBottom:4 }}>Logo</div>
            {form.logo_url
              ? <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:6 }}>
                  <img src={form.logo_url} style={{ maxWidth:50,maxHeight:36,objectFit:'contain',borderRadius:3,border:'1px solid #e5e7eb' }}/>
                  <button onClick={()=>set('logo_url','')}
                    style={{ fontSize:11,color:'#dc2626',background:'none',border:'none',cursor:'pointer',padding:0 }}>
                    Entfernen
                  </button>
                </div>
              : <label style={{ display:'inline-block',padding:'5px 10px',border:'1px dashed #d1d5db',borderRadius:4,fontSize:11,cursor:'pointer',color:'#6b7280',marginBottom:6 }}>
                  Logo hochladen
                  <input type="file" accept="image/*" style={{ display:'none' }}
                    onChange={e=>{
                      const file=e.target.files?.[0]; if(!file) return
                      const r=new FileReader()
                      r.onload=ev=>set('logo_url',ev.target?.result as string)
                      r.readAsDataURL(file)
                    }}/>
                </label>
            }
            <CP label="Hintergrund"  k="primaryBg"/>
            <CP label="Schriftfarbe" k="headerText"/>
          </>}
        </Section>
      )}

      {/* Fussbereich */}
      {!isEinfach&&(
        <Section id="fuss" label="Fussbereich">
          <Chk label="Anzeigen" checked={form.show_footer} onChange={v=>set('show_footer',v)}/>
          {form.show_footer&&<>
            <div style={{ fontSize:11,color:'#9ca3af',marginBottom:3 }}>Text (im Bereich direkt editierbar)</div>
            <CP label="Schriftfarbe"  k="footerText"/>
            <CP label="Hintergrund"   k="footerBg"/>
          </>}
        </Section>
      )}

      {/* Button */}
      <Section id="button" label="Button">
        <Chk label="Anzeigen" checked={form.show_button} onChange={v=>set('show_button',v)}/>
        {form.show_button&&<>
          <TxtInput label="Beschriftung" value={form.button_text} onChange={v=>set('button_text',v)} placeholder="Mehr erfahren"/>
          <TxtInput label="Link (URL)" value={form.button_url} onChange={v=>set('button_url',v)} placeholder="https://…"/>
          <CP label="Hintergrund"  k="buttonBg"/>
          <CP label="Schriftfarbe" k="buttonText"/>
        </>}
      </Section>

      {/* Farbschema allgemein */}
      <Section id="farben" label="Weitere Farben">
        <CP label="Schrift Inhalt"        k="bodyText"/>
        <CP label="Hintergrund Inhalt"    k="bodyBg"/>
        <CP label="Linkfarbe"             k="linkColor"/>
        <CP label="Hintergrund Allgemein" k="generalBg"/>
      </Section>
    </div>
  )
}

// ── Template card for picker ───────────────────────────────────────────────────
function TplCard({ name, subtitle, preview, onUse, onMenu }:{
  name:string; subtitle:string; preview:React.ReactNode; onUse:()=>void; onMenu:()=>void
}) {
  return (
    <div style={{ display:'flex',gap:16,padding:'14px 16px',borderBottom:'1px solid #f3f4f6',alignItems:'center' }}
      onMouseEnter={e=>(e.currentTarget.style.background='#f9fafb')}
      onMouseLeave={e=>(e.currentTarget.style.background='')}>
      <div style={{ width:72,height:80,flexShrink:0,background:'#f3f4f6',borderRadius:4,overflow:'hidden',border:'1px solid #e5e7eb',display:'flex',alignItems:'center',justifyContent:'center' }}>
        <div style={{ transform:'scale(0.15)',transformOrigin:'top left',width:'467px',pointerEvents:'none' }}>{preview}</div>
      </div>
      <div style={{ flex:1,minWidth:0 }}>
        <div style={{ fontSize:15,fontWeight:700,color:'#111827',marginBottom:3,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{name}</div>
        <div style={{ fontSize:12,color:'#9ca3af',marginBottom:8 }}>{subtitle}</div>
        <div style={{ display:'flex',gap:8 }}>
          <button onClick={onUse}
            style={{ padding:'6px 16px',background:'#fff',border:'1px solid #d1d5db',borderRadius:5,cursor:'pointer',fontSize:13,fontWeight:500,color:'#374151' }}
            onMouseEnter={e=>{e.currentTarget.style.background='#f3f4f6'}}
            onMouseLeave={e=>{e.currentTarget.style.background='#fff'}}>
            Vorlage verwenden
          </button>
          <button onClick={onMenu} style={{ padding:'6px 10px',background:'#fff',border:'1px solid #d1d5db',borderRadius:5,cursor:'pointer',fontSize:13,color:'#374151' }}>•••</button>
        </div>
      </div>
    </div>
  )
}

function tplPreview(t: Template) {
  const c = parseColors(t.color_scheme||'{}')
  return (
    <div style={{ width:580,fontFamily:'Arial,sans-serif' }}>
      {t.show_header&&<div style={{ background:t.primary_color||c.primaryBg,padding:'12px 20px',color:'#fff',fontSize:14,fontWeight:700 }}>{t.title}</div>}
      <div style={{ padding:'12px 20px',fontSize:12,color:'#374151',lineHeight:1.5 }} dangerouslySetInnerHTML={{ __html:t.body.slice(0,400) }}/>
      {t.show_footer&&<div style={{ borderTop:'1px solid #e5e7eb',padding:'8px 20px',fontSize:10,color:'#9ca3af' }}>{t.footer_text}</div>}
    </div>
  )
}
function historyPreview(h: HistoryItem) {
  const c = parseColors(h.color_scheme||'{}')
  return (
    <div style={{ width:580,fontFamily:'Arial,sans-serif' }}>
      <div style={{ background:h.primary_color||c.primaryBg,padding:'12px 20px',color:'#fff',fontSize:14,fontWeight:700 }}>{h.subject}</div>
      <div style={{ padding:'12px 20px',fontSize:12,color:'#374151',lineHeight:1.5 }} dangerouslySetInnerHTML={{ __html:h.body_preview.slice(0,400) }}/>
    </div>
  )
}

// ── AbsenderEmpfaengerPanel ─────────────────────────────────────────────────────
function AbsenderEmpfaengerPanel({ form, setForm, onClose }: {
  form: ComposeForm;
  setForm: React.Dispatch<React.SetStateAction<ComposeForm>>; onClose: () => void
}) {
  const [fromName,  setFromName]  = useState(form.from_name)
  const [fromEmail, setFromEmail] = useState(form.from_email)
  const [cc,  setCc]  = useState<Recipient[]>(form.cc)
  const [bcc, setBcc] = useState<Recipient[]>(form.bcc)

  function apply() {
    setForm(f=>({...f, from_name:fromName, from_email:fromEmail, cc, bcc }))
    onClose()
  }

  const SectionTitle = ({ label }: { label:string }) => (
    <div style={{ fontSize:11,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'.05em',
      padding:'10px 18px 5px',background:'#f9fafb',borderBottom:'1px solid #f0f2f5' }}>{label}</div>
  )

  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.4)',zIndex:3000,display:'flex',alignItems:'center',justifyContent:'center',padding:16 }}>
      <div style={{ background:'#fff',borderRadius:8,width:'min(500px,95vw)',maxHeight:'85vh',display:'flex',flexDirection:'column',boxShadow:'0 12px 40px rgba(0,0,0,.2)' }}>

        {/* Header */}
        <div style={{ padding:'14px 18px',borderBottom:'1px solid #e5e7eb',display:'flex',justifyContent:'space-between',alignItems:'center' }}>
          <h3 style={{ margin:0,fontSize:16,fontWeight:700 }}>Absender &amp; Empfänger</h3>
          <button onClick={onClose} style={{ background:'none',border:'none',fontSize:20,cursor:'pointer',color:'#9ca3af' }}>×</button>
        </div>

        <div style={{ overflowY:'auto',flex:1 }}>
          {/* Absender */}
          <SectionTitle label="Von (Absender)"/>
          <div style={{ padding:'12px 18px',borderBottom:'1px solid #f0f2f5',display:'flex',gap:10 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:11,color:'#9ca3af',marginBottom:3 }}>Name</div>
              <input value={fromName} onChange={e=>setFromName(e.target.value)}
                placeholder="z.B. Thomas Kießner"
                style={{ width:'100%',padding:'7px 10px',border:'1px solid #d1d5db',borderRadius:5,fontSize:13,boxSizing:'border-box',outline:'none' }}/>
            </div>
            <div style={{ flex:1.2 }}>
              <div style={{ fontSize:11,color:'#9ca3af',marginBottom:3 }}>E-Mail-Adresse</div>
              <input value={fromEmail} onChange={e=>setFromEmail(e.target.value)}
                placeholder="absender@verein.de" type="email"
                style={{ width:'100%',padding:'7px 10px',border:'1px solid #d1d5db',borderRadius:5,fontSize:13,boxSizing:'border-box',outline:'none' }}/>
            </div>
          </div>

          {/* CC */}
          <SectionTitle label="CC"/>
          <div style={{ borderBottom:'1px solid #f0f2f5' }}>
            <RecipientInput label="CC" value={cc} onChange={setCc}/>
          </div>

          {/* BCC – enthält alle vorausgewählten Empfänger, editierbar */}
          <SectionTitle label={`BCC – Empfänger (${bcc.length})`}/>
          <div style={{ borderBottom:'1px solid #f0f2f5' }}>
            <RecipientInput label="BCC" value={bcc} onChange={setBcc}/>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding:'12px 18px',borderTop:'1px solid #e5e7eb',display:'flex',gap:10,justifyContent:'flex-end' }}>
          <button onClick={onClose}
            style={{ padding:'8px 18px',border:'1px solid #d1d5db',borderRadius:5,background:'#fff',fontSize:13,cursor:'pointer',color:'#374151' }}>
            Abbrechen
          </button>
          <button onClick={apply}
            style={{ padding:'8px 20px',border:'none',borderRadius:5,background:'#2a5298',color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer' }}>
            Übernehmen
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Build full email HTML (table-based for email client compatibility) ──────────
function buildEmailHtml(form: ComposeForm): string {
  const c = form.colors
  const isEinfach = form.design === 'einfach'

  // Outer wrapper
  let h = `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${c.generalBg};font-family:Arial,Helvetica,sans-serif;">`
  h += `<tr><td align="center" style="padding:20px;">`
  h += `<table width="580" cellpadding="0" cellspacing="0" border="0" style="width:580px;max-width:580px;background:${c.bodyBg};">`

  // ── Header ──
  if (!isEinfach && form.show_header) {
    h += `<tr><td style="background:${c.primaryBg};padding:16px 24px;">`
    h += `<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>`
    // text column
    h += `<td style="vertical-align:middle;">`
    if (form.headerLine1) h += `<div style="color:${c.headerText};font-size:18px;font-weight:bold;margin:0 0 2px 0;">${form.headerLine1}</div>`
    if (form.headerLine2) h += `<div style="color:${c.headerText};font-size:15px;font-weight:bold;margin:0 0 4px 0;">${form.headerLine2}</div>`
    if (form.headerSubtitle) h += `<div style="color:${c.headerText};font-size:12px;font-style:italic;opacity:0.85;">${form.headerSubtitle}</div>`
    h += `</td>`
    // logo column (only if logo exists)
    if (form.logo_url) {
      h += `<td width="90" style="vertical-align:middle;text-align:right;padding-left:12px;">`
      h += `<img src="${form.logo_url}" width="80" height="auto" style="display:block;max-width:80px;max-height:64px;border:0;" alt="Logo"/>`
      h += `</td>`
    }
    h += `</tr></table>`
    h += `</td></tr>`
  }

  // ── Subject line (Einfach design) ──
  if (isEinfach && form.subject) {
    h += `<tr><td style="padding:20px 24px 0;color:${c.bodyText};font-size:20px;font-weight:bold;">${form.subject}</td></tr>`
  }

  // ── Body ──
  h += `<tr><td style="padding:16px 24px;color:${c.bodyText};font-size:14px;line-height:1.6;">${form.body}</td></tr>`

  // ── Button ──
  if (form.show_button && form.button_text) {
    h += `<tr><td style="padding:0 24px 16px;">`
    h += `<a href="${form.button_url || '#'}" style="background:${c.buttonBg};color:${c.buttonText};padding:10px 20px;display:inline-block;text-decoration:none;font-size:14px;font-weight:bold;">${form.button_text}</a>`
    h += `</td></tr>`
  }

  // ── Footer ──
  if (!isEinfach && form.show_footer && form.footerText) {
    const ft = form.footerText.replace(/\n/g, '<br/>')
    h += `<tr><td style="border-top:1px solid #e5e7eb;padding:12px 24px;background:${c.footerBg};font-size:11px;color:${c.footerText};line-height:1.6;">${ft}</td></tr>`
  }

  h += `</table>`
  h += `</td></tr></table>`
  return h
}

// ── Main component ─────────────────────────────────────────────────────────────
interface Props { recipients: Recipient[]; onClose:()=>void }
type Step = 'pick' | 'compose'
type Tab  = 'vorlagen' | 'verlauf'
type SendStatus = 'idle'|'sending'|'ok'|'error'

export default function EmailComposeModal({ recipients, onClose }: Props) {
  const { data: me } = useMe()
  const queryClient = useQueryClient()
  // recipients are available immediately (prop) — use lazy initializer so BCC is set on first render
  const [form, setForm] = useState<ComposeForm>(() => ({
    ...EMPTY_FORM,
    bcc: recipients.filter(r => r.email),
  }))
  const [step,      setStep]      = useState<Step>('pick')
  const [tab,       setTab]       = useState<Tab>('vorlagen')
  const [search,    setSearch]    = useState('')
  const [sideOpen,  setSideOpen]  = useState(true)
  const [showR,     setShowR]     = useState(false)
  const [sendSt,    setSendSt]    = useState<SendStatus>('idle')
  const [sendMsg,   setSendMsg]   = useState('')
  const [showSave,  setShowSave]  = useState(false)
  const [saveName,  setSaveName]  = useState('')
  const [saveVis,   setSaveVis]   = useState<'private'|'public'>('private')
  const [saveState, setSaveState] = useState<'idle'|'saving'|'ok'|'error'>('idle')
  const [saveMsg,   setSaveMsg]   = useState('')
  const [showPreview,  setShowPreview]  = useState(false)
  const [previewData,  setPreviewData]  = useState<{subject:string;body:string;memberName:string}|null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [attachments, setAttachments] = useState<{filename:string;content_b64:string;mime_type:string}[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Pre-fill sender once user data has loaded
  useEffect(() => {
    if (me) {
      setForm(f => ({
        ...f,
        from_name:  f.from_name  || me.username,
        from_email: f.from_email || me.email,
      }))
    }
  }, [me])

  const validR = useMemo(() => recipients.filter(r=>r.email), [recipients])

  const { data: templates = [] } = useQuery<Template[]>({
    queryKey:['email-templates'], queryFn:()=>api.get('/email-templates').then(r=>r.data)
  })
  const { data: history = [] }   = useQuery<HistoryItem[]>({
    queryKey:['email-history'], queryFn:()=>api.get('/email/history').then(r=>r.data)
  })
  const { data: rawFields = [] } = useQuery<FieldDef[]>({
    queryKey:['fields'], queryFn:()=>api.get('/fields').then(r=>r.data)
  })
  const { data: emailCfg } = useQuery<EmailSettings>({
    queryKey:['email-settings'], queryFn:()=>api.get('/email-settings').then(r=>r.data)
  })

  const fields = rawFields.filter(f=>!['photo_url','notes_field','file','image'].includes(f.name))

  function loadTemplate(t: Template) {
    const colors = parseColors(t.color_scheme||'{}')
    setForm(f=>({
      subject: t.subject||'',
      headerLine1: (t as any).header_line1||t.title||'Ihr Verein',
      headerLine2: (t as any).header_line2||'',
      headerSubtitle: (t as any).header_subtitle||'',
      body: t.body||'', footerText: t.footer_text||'',
      logo_url: (t as any).logo_url||'',
      design: t.design, show_header: t.show_header, show_footer: t.show_footer,
      show_button: t.show_button, button_text: t.button_text, button_url: t.button_url,
      colors: { ...DEFAULT_COLORS, ...colors, primaryBg: t.primary_color||colors.primaryBg||'#2a5298' },
      templateName: t.name, templateId: t.id,
      cc: f.cc, bcc: f.bcc,                               // preserve recipients
      from_name: f.from_name, from_email: f.from_email, serial: f.serial,
    }))
    setStep('compose')
  }

  function loadHistory(h: HistoryItem) {
    const colors = parseColors(h.color_scheme||'{}')
    setForm(f=>({
      ...EMPTY_FORM, subject: h.subject||'',
      body: h.body_preview||'', design: h.design||'standard',
      colors: { ...DEFAULT_COLORS, ...colors, primaryBg: h.primary_color||colors.primaryBg||'#2a5298' },
      templateName: h.template_name||'Verlauf',
      cc: f.cc, bcc: f.bcc,                               // preserve recipients
      from_name: f.from_name, from_email: f.from_email, serial: f.serial, logo_url: f.logo_url,
    }))
    setStep('compose')
  }

  function newBlankEmail() {
    setForm(f=>({
      ...EMPTY_FORM,
      cc: f.cc, bcc: f.bcc,                               // preserve recipients
      from_name: f.from_name, from_email: f.from_email, serial: f.serial,
    }))
    setStep('compose')
  }

  async function handleSaveTemplate() {
    if (!saveName.trim()) { setSaveMsg('Bitte einen Namen eingeben.'); return }
    setSaveState('saving')
    try {
      const payload = {
        name: saveName.trim(),
        subject: form.subject,
        title: form.headerLine1 || 'E-Mail Titel',
        body: form.body,
        footer_text: form.footerText,
        design: form.design,
        show_header: form.show_header,
        show_footer: form.show_footer,
        show_button: form.show_button,
        button_text: form.button_text,
        button_url: form.button_url,
        primary_color: form.colors.primaryBg,
        color_scheme: JSON.stringify(form.colors),
        header_line1: form.headerLine1,
        header_line2: form.headerLine2,
        header_subtitle: form.headerSubtitle,
        logo_url: form.logo_url,
        visibility: saveVis,
      }
      if (form.templateId) {
        await api.put(`/email-templates/${form.templateId}`, payload)
      } else {
        const res = await api.post('/email-templates', payload)
        setForm(f => ({ ...f, templateId: res.data.id, templateName: saveName.trim() }))
      }
      queryClient.invalidateQueries({ queryKey: ['email-templates'] })
      setSaveState('ok')
      setSaveMsg('Vorlage gespeichert.')
      setTimeout(() => { setShowSave(false); setSaveState('idle'); setSaveMsg('') }, 1200)
    } catch (e: any) {
      setSaveState('error')
      setSaveMsg(e?.response?.data?.detail ?? 'Fehler beim Speichern.')
    }
  }

  async function previewForFirst() {
    const first = form.bcc.find(r => r.id)
    if (!first) { alert('Kein Mitglied mit ID im BCC gefunden.'); return }
    setPreviewLoading(true)
    try {
      const res = await api.post('/email/preview', {
        member_id: first.id,
        subject: form.subject,
        body: buildEmailHtml(form),
      })
      setPreviewData({ subject: res.data.subject, body: res.data.body, memberName: res.data.member_name })
      setShowPreview(true)
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? 'Vorschau fehlgeschlagen.')
    } finally {
      setPreviewLoading(false)
    }
  }

  async function addFiles(files: FileList) {
    const newAtts = await Promise.all(Array.from(files).map(f => new Promise<{filename:string;content_b64:string;mime_type:string}>(resolve => {
      const reader = new FileReader()
      reader.onload = () => {
        const b64 = (reader.result as string).split(',')[1] ?? ''
        resolve({ filename: f.name, content_b64: b64, mime_type: f.type || 'application/octet-stream' })
      }
      reader.readAsDataURL(f)
    })))
    setAttachments(arr => [...arr, ...newAtts])
  }

  async function handleSend() {
    if (!form.subject.trim()) { alert('Bitte Betreff eingeben.'); return }
    const recipientEntries = form.bcc.filter(r=>r.email)
    const allCc = form.cc.map(r=>r.email).filter(Boolean)
    const mode = emailCfg?.send_mode ?? 'mailto'
    if (mode === 'mailto') {
      const bcc = recipientEntries.map(r=>r.email).join(',')
      const cc  = allCc.join(',')
      let mailto = `mailto:?subject=${encodeURIComponent(form.subject)}`
      if (cc)  mailto += `&cc=${encodeURIComponent(cc)}`
      if (bcc) mailto += `&bcc=${encodeURIComponent(bcc)}`
      window.location.href = mailto
      onClose(); return
    }
    setSendSt('sending')
    try {
      const res = await api.post('/email/send', {
        recipients: recipientEntries.map(r => ({ member_id: r.id ?? null, email: r.email })),
        cc: allCc,
        bcc_extra: [],
        subject: form.subject,
        body: buildEmailHtml(form),
        body_type: 'html',
        serial: form.serial,
        template_name: form.templateName,
        color_scheme: JSON.stringify(form.colors),
        design: form.design,
        primary_color: form.colors.primaryBg,
        from_name: form.from_name||undefined,
        from_email: form.from_email||undefined,
        attachments,
      })
      setSendSt(res.data.success ? 'ok' : 'error')
      setSendMsg(res.data.message)
    } catch (e: any) {
      setSendSt('error'); setSendMsg(e?.response?.data?.detail ?? 'Versand fehlgeschlagen.')
    }
  }

  const filtTemplates = templates.filter(t=>t.name.toLowerCase().includes(search.toLowerCase()))
  const filtHistory   = history.filter(h=>h.subject.toLowerCase().includes(search.toLowerCase()))

  const tabBtn = (t:Tab,label:string) => (
    <button onClick={()=>setTab(t)}
      style={{ padding:'10px 22px',border:'none',background:'none',cursor:'pointer',fontSize:14,fontWeight:500,
        color: tab===t?'#111827':'#9ca3af', borderBottom: tab===t?'2px solid #2a5298':'2px solid transparent',
        marginBottom:-1 }}>
      {label}
    </button>
  )

  // ── STEP 1: Template Picker ──────────────────────────────────────────────────
  if (step === 'pick') return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:2000,display:'flex',alignItems:'center',justifyContent:'center',padding:16 }}>
      <div style={{ background:'#fff',borderRadius:10,width:'min(680px,96vw)',maxHeight:'90vh',display:'flex',flexDirection:'column',boxShadow:'0 24px 64px rgba(0,0,0,.3)' }}>

        {/* Tabs header */}
        <div style={{ display:'flex',alignItems:'center',borderBottom:'1px solid #e5e7eb',padding:'0 20px',background:'#2a5298',borderRadius:'10px 10px 0 0',flexShrink:0 }}>
          <button onClick={()=>{newBlankEmail()}}
              style={{ padding:'12px 18px',border:'none',background:'none',cursor:'pointer',fontSize:13,fontWeight:600,color:'rgba(255,255,255,.8)',borderBottom:'3px solid transparent',marginBottom:-1 }}>
              ✉️ E-Mail schreiben
            </button>
            {(['vorlagen','verlauf'] as Tab[]).map(t=>(
              <button key={t} onClick={()=>setTab(t)}
                style={{ padding:'12px 18px',border:'none',background:'none',cursor:'pointer',fontSize:13,fontWeight:600,
                  color:tab===t?'#fff':'rgba(255,255,255,.7)',
                  borderBottom:tab===t?'3px solid #fff':'3px solid transparent',marginBottom:-1 }}>
                {t==='vorlagen'?'E-Mail Vorlagen':'Verlauf'}
              </button>
            ))}
          <button onClick={onClose} style={{ marginLeft:'auto',background:'none',border:'none',color:'rgba(255,255,255,.8)',fontSize:20,cursor:'pointer',lineHeight:1 }}>×</button>
        </div>

        <div style={{ padding:'16px 20px',borderBottom:'1px solid #e5e7eb',display:'flex',gap:10,alignItems:'center',flexShrink:0 }}>
          <button onClick={()=>{newBlankEmail()}}
            style={{ padding:'8px 16px',background:'#16a34a',color:'#fff',border:'none',borderRadius:5,fontWeight:600,fontSize:13,cursor:'pointer',flexShrink:0 }}>
            + Neue E-Mail Vorlage
          </button>
          <div style={{ flex:1,display:'flex',gap:10 }}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Vorlage suchen…"
              style={{ flex:1,padding:'7px 12px',border:'1px solid #d1d5db',borderRadius:5,fontSize:13,outline:'none' }}/>
          </div>
        </div>

        <div style={{ overflowY:'auto',flex:1 }}>
          {tab==='vorlagen' && (
            filtTemplates.length===0
              ? <div style={{ padding:'40px',textAlign:'center',color:'#9ca3af' }}>Noch keine Vorlagen.</div>
              : filtTemplates.map(t=>(
                  <TplCard key={t.id}
                    name={t.name}
                    subtitle={t.visibility==='public'?'Für alle sichtbar':'Nur für mich sichtbar'}
                    preview={tplPreview(t)}
                    onUse={()=>loadTemplate(t)}
                    onMenu={()=>{}}
                  />
                ))
          )}
          {tab==='verlauf' && (
            filtHistory.length===0
              ? <div style={{ padding:'40px',textAlign:'center',color:'#9ca3af' }}>Noch keine gesendeten E-Mails.</div>
              : filtHistory.map(h=>(
                  <TplCard key={h.id}
                    name={h.subject}
                    subtitle={`${h.sent_at} · ${h.recipient_count} Empfänger${h.template_name?' · '+h.template_name:''}`}
                    preview={historyPreview(h)}
                    onUse={()=>loadHistory(h)}
                    onMenu={()=>{}}
                  />
                ))
          )}
        </div>
      </div>
    </div>
  )

  // ── STEP 2: Compose ──────────────────────────────────────────────────────────
  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:2000,display:'flex',alignItems:'center',justifyContent:'center',padding:12 }}>
      <div style={{ background:'#fff',borderRadius:10,width:'min(1000px,98vw)',height:'min(94vh,860px)',display:'flex',flexDirection:'column',boxShadow:'0 24px 64px rgba(0,0,0,.3)' }}>

        {/* Title bar */}
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 20px',borderBottom:'1px solid #e5e7eb',flexShrink:0 }}>
          <div style={{ display:'flex',alignItems:'center',gap:12 }}>
            <h2 style={{ margin:0,fontSize:17,fontWeight:700 }}>
              E-Mail an {form.bcc.length} Empfänger versenden
            </h2>
            <button onClick={()=>setShowR(true)}
              style={{ padding:'6px 14px',background:'#16a34a',color:'#fff',border:'none',borderRadius:5,fontSize:12,fontWeight:600,cursor:'pointer' }}>
              Absender &amp; Empfänger bearbeiten
            </button>
            {form.from_email&&(
              <span style={{ fontSize:12,color:'#6b7280' }}>
                Von: {form.from_name?`${form.from_name} <${form.from_email}>`:form.from_email}
              </span>
            )}
            {/* Serien-E-Mail toggle */}
            <label style={{ display:'flex',alignItems:'center',gap:5,fontSize:12,cursor:'pointer',
              marginLeft:8,padding:'4px 10px',borderRadius:5,
              background:form.serial?'#fef9c3':'#f3f4f6',border:`1px solid ${form.serial?'#fde047':'#e5e7eb'}`,
              color:form.serial?'#854d0e':'#374151', userSelect:'none' }}>
              <input type="checkbox" checked={form.serial}
                onChange={e=>setForm(f=>({...f,serial:e.target.checked}))}
                style={{ accentColor:'#ca8a04' }}/>
              ✉️ Serien-E-Mail
            </label>
            {form.serial&&(
              <button onClick={previewForFirst} disabled={previewLoading}
                style={{ padding:'4px 10px',border:'1px solid #d1d5db',borderRadius:5,background:'#fff',
                  fontSize:12,cursor:'pointer',color:'#374151' }}>
                {previewLoading?'…':'🔍 Vorschau'}
              </button>
            )}
          </div>
          <div style={{ display:'flex',alignItems:'center',gap:14 }}>
            <button onClick={()=>{ setSaveName(form.templateName||''); setSaveState('idle'); setSaveMsg(''); setShowSave(true) }}
              style={{ background:'none',border:'none',fontSize:13,cursor:'pointer',color:'#6b7280',display:'flex',alignItems:'center',gap:4 }}>
              💾 Als Vorlage speichern
            </button>
            <button onClick={()=>setStep('pick')} style={{ background:'none',border:'none',fontSize:13,cursor:'pointer',color:'#2a5298' }}>← Vorlagen</button>
            <button onClick={onClose} style={{ background:'none',border:'none',fontSize:22,cursor:'pointer',color:'#9ca3af',lineHeight:1 }}>×</button>
          </div>
        </div>

        {/* Subject */}
        <div style={{ padding:'0 20px',borderBottom:'1px solid #e5e7eb',flexShrink:0 }}>
          <input value={form.subject} onChange={e=>setForm(f=>({...f,subject:e.target.value}))}
            placeholder="Betreff eingeben…"
            style={{ width:'100%',padding:'12px 0',border:'none',fontSize:17,outline:'none',boxSizing:'border-box',fontWeight:500 }}/>
        </div>

        {/* CC / BCC */}
        <div style={{ flexShrink:0, borderBottom:'1px solid #e5e7eb' }}>
          <RecipientInput label="CC"  value={form.cc}  onChange={v=>setForm(f=>({...f,cc:v}))}/>
          <RecipientInput label="BCC" value={form.bcc} onChange={v=>setForm(f=>({...f,bcc:v}))}/>
        </div>

        {/* Serien-E-Mail hint bar */}
        {form.serial&&(
          <div style={{ padding:'7px 20px',background:'#fefce8',borderBottom:'1px solid #fde047',flexShrink:0,
            display:'flex',alignItems:'center',gap:10,fontSize:12,color:'#854d0e' }}>
            <span style={{ fontWeight:600 }}>✉️ Serien-E-Mail aktiv:</span>
            Platzhalter wie <code style={{ background:'#fef08a',padding:'1px 5px',borderRadius:3 }}>{'{{first_name}}'}</code> werden pro Empfänger durch seine Mitgliedsdaten ersetzt.
            {form.bcc.some(r=>!r.id)&&(
              <span style={{ color:'#b45309',marginLeft:4 }}>
                ⚠ {form.bcc.filter(r=>!r.id).length} Empfänger ohne Mitgliedsdaten – Platzhalter bleiben unverändert.
              </span>
            )}
          </div>
        )}

        {/* Canvas + Sidebar */}
        <div style={{ display:'flex',flex:1,overflow:'hidden',minHeight:0 }}>
          <WysiwygCanvas form={form} setForm={setForm} fields={fields}/>

          {/* Sidebar toggle */}
          <div style={{ borderLeft:'1px solid #e5e7eb',display:'flex',flexDirection:'column',flexShrink:0 }}>
            <button onClick={()=>setSideOpen(o=>!o)} style={{ padding:'12px 7px',background:'none',border:'none',cursor:'pointer',color:'#9ca3af',fontSize:14 }}>
              {sideOpen?'›':'‹'}
            </button>
          </div>

          {sideOpen&&<DesignSidebar form={form} setForm={setForm}/>}
        </div>

        {/* Attachment strip */}
        <div style={{ borderTop:'1px solid #e5e7eb',padding:'8px 20px',flexShrink:0,background:'#fafafa',display:'flex',flexWrap:'wrap',alignItems:'center',gap:8 }}>
          <input ref={fileInputRef} type="file" multiple style={{ display:'none' }}
            onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = '' }}/>
          <button onClick={() => fileInputRef.current?.click()}
            style={{ background:'none',border:'none',cursor:'pointer',fontSize:13,color:'#2a5298',display:'flex',alignItems:'center',gap:5,padding:0,flexShrink:0 }}>
            📎 Dateianhang anfügen
          </button>
          {attachments.map((a,i) => (
            <span key={i} style={{ display:'inline-flex',alignItems:'center',gap:4,padding:'2px 8px',
              background:'#eff4ff',border:'1px solid #c7d7fd',borderRadius:12,fontSize:12,color:'#3730a3' }}>
              📄 {a.filename}
              <button onClick={() => setAttachments(arr => arr.filter((_,j) => j !== i))}
                style={{ background:'none',border:'none',cursor:'pointer',padding:0,lineHeight:1,color:'#6b7280',fontSize:14 }}>×</button>
            </span>
          ))}
        </div>

        {/* Footer */}
        <div style={{ borderTop:'1px solid #e5e7eb',padding:'12px 20px',display:'flex',gap:10,alignItems:'center',flexShrink:0 }}>
          {sendSt==='idle'&&(
            <button onClick={handleSend}
              style={{ padding:'9px 26px',background:'#16a34a',color:'#fff',border:'none',borderRadius:5,fontWeight:700,fontSize:14,cursor:'pointer' }}>
              {emailCfg?.send_mode==='smtp'?'📤 Senden':'💻 Client öffnen'}
            </button>
          )}
          {sendSt==='sending'&&<button disabled style={{ padding:'9px 26px',background:'#9ca3af',color:'#fff',border:'none',borderRadius:5,fontWeight:700,fontSize:14 }}>⏳ Wird gesendet…</button>}
          {sendSt==='ok'&&<span style={{ color:'#16a34a',fontWeight:600,fontSize:14 }}>✓ {sendMsg}</span>}
          {sendSt==='error'&&<span style={{ color:'#dc2626',fontSize:14 }}>✗ {sendMsg}</span>}
          {sendSt!=='ok'&&(
            <button onClick={onClose} style={{ padding:'9px 18px',border:'1px solid #d1d5db',borderRadius:5,background:'#fff',fontSize:14,cursor:'pointer',color:'#374151' }}>Schliessen</button>
          )}
          {sendSt==='ok'&&(
            <button onClick={onClose} style={{ padding:'9px 18px',border:'none',borderRadius:5,background:'#16a34a',color:'#fff',fontSize:14,cursor:'pointer',fontWeight:600 }}>Schliessen</button>
          )}
          <div style={{ marginLeft:'auto',fontSize:12,color:'#9ca3af' }}>
            {form.bcc.length} Empfänger im BCC{form.cc.length>0?`, ${form.cc.length} im CC`:''}
          </div>
        </div>
      </div>

      {showR&&<AbsenderEmpfaengerPanel form={form} setForm={setForm} onClose={()=>setShowR(false)}/>}

      {/* Preview modal */}
      {showPreview&&previewData&&(
        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:3000,display:'flex',alignItems:'center',justifyContent:'center',padding:16 }}>
          <div style={{ background:'#fff',borderRadius:8,width:'min(680px,95vw)',maxHeight:'88vh',display:'flex',flexDirection:'column',boxShadow:'0 16px 48px rgba(0,0,0,.25)' }}>
            <div style={{ padding:'14px 18px',borderBottom:'1px solid #e5e7eb',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0 }}>
              <div>
                <h3 style={{ margin:0,fontSize:16,fontWeight:700 }}>Vorschau – Serien-E-Mail</h3>
                <div style={{ fontSize:12,color:'#6b7280',marginTop:2 }}>
                  Empfänger: <b>{previewData.memberName}</b> · Platzhalter sind durch echte Daten ersetzt
                </div>
              </div>
              <button onClick={()=>setShowPreview(false)} style={{ background:'none',border:'none',fontSize:20,cursor:'pointer',color:'#9ca3af' }}>×</button>
            </div>
            <div style={{ padding:'12px 18px',borderBottom:'1px solid #f3f4f6',flexShrink:0,background:'#f9fafb' }}>
              <span style={{ fontSize:11,color:'#9ca3af',textTransform:'uppercase',letterSpacing:'.05em' }}>Betreff:</span>
              <span style={{ fontSize:14,fontWeight:500,color:'#111827',marginLeft:8 }}>{previewData.subject||'(kein Betreff)'}</span>
            </div>
            <div style={{ overflowY:'auto',flex:1,padding:'20px 24px' }}
              dangerouslySetInnerHTML={{ __html: previewData.body }}/>
            <div style={{ padding:'12px 18px',borderTop:'1px solid #e5e7eb',display:'flex',justifyContent:'flex-end',flexShrink:0 }}>
              <button onClick={()=>setShowPreview(false)}
                style={{ padding:'8px 20px',border:'1px solid #d1d5db',borderRadius:5,background:'#fff',fontSize:13,cursor:'pointer' }}>
                Schliessen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save as template dialog */}
      {showSave&&(
        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.4)',zIndex:3000,display:'flex',alignItems:'center',justifyContent:'center',padding:16 }}>
          <div style={{ background:'#fff',borderRadius:8,width:'min(420px,95vw)',boxShadow:'0 12px 40px rgba(0,0,0,.2)',display:'flex',flexDirection:'column' }}>
            <div style={{ padding:'14px 18px',borderBottom:'1px solid #e5e7eb',display:'flex',justifyContent:'space-between',alignItems:'center' }}>
              <h3 style={{ margin:0,fontSize:16,fontWeight:700 }}>
                {form.templateId ? 'Vorlage aktualisieren' : 'Als Vorlage speichern'}
              </h3>
              <button onClick={()=>setShowSave(false)} style={{ background:'none',border:'none',fontSize:20,cursor:'pointer',color:'#9ca3af' }}>×</button>
            </div>
            <div style={{ padding:'16px 18px' }}>
              <div style={{ marginBottom:12 }}>
                <label style={{ display:'block',fontSize:13,fontWeight:600,color:'#374151',marginBottom:5 }}>Name der Vorlage *</label>
                <input autoFocus value={saveName} onChange={e=>setSaveName(e.target.value)}
                  onKeyDown={e=>e.key==='Enter'&&handleSaveTemplate()}
                  placeholder="z.B. Einladung Jahreshauptversammlung"
                  style={{ width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:5,fontSize:14,boxSizing:'border-box',outline:'none' }}/>
              </div>
              <div style={{ marginBottom:14 }}>
                <label style={{ display:'block',fontSize:13,fontWeight:600,color:'#374151',marginBottom:5 }}>Sichtbarkeit</label>
                <div style={{ display:'flex',gap:10 }}>
                  {(['private','public'] as const).map(v=>(
                    <label key={v} style={{ display:'flex',alignItems:'center',gap:6,fontSize:13,cursor:'pointer',
                      padding:'7px 14px',border:`2px solid ${saveVis===v?'#2a5298':'#e5e7eb'}`,borderRadius:6,
                      background:saveVis===v?'#eff4ff':'#fff' }}>
                      <input type="radio" name="vis" value={v} checked={saveVis===v} onChange={()=>setSaveVis(v)} style={{ accentColor:'#2a5298' }}/>
                      {v==='private'?'🔒 Nur für mich':'🌐 Für alle sichtbar'}
                    </label>
                  ))}
                </div>
              </div>
              {saveMsg&&(
                <div style={{ padding:'8px 12px',borderRadius:5,marginBottom:10,fontSize:13,
                  background:saveState==='ok'?'#f0fdf4':saveState==='error'?'#fef2f2':'#fffbeb',
                  color:saveState==='ok'?'#16a34a':saveState==='error'?'#dc2626':'#92400e',
                  border:`1px solid ${saveState==='ok'?'#bbf7d0':saveState==='error'?'#fecaca':'#fde68a'}` }}>
                  {saveMsg}
                </div>
              )}
            </div>
            <div style={{ padding:'12px 18px',borderTop:'1px solid #e5e7eb',display:'flex',gap:10,justifyContent:'flex-end' }}>
              <button onClick={()=>setShowSave(false)}
                style={{ padding:'8px 18px',border:'1px solid #d1d5db',borderRadius:5,background:'#fff',fontSize:13,cursor:'pointer',color:'#374151' }}>
                Abbrechen
              </button>
              <button onClick={handleSaveTemplate} disabled={saveState==='saving'}
                style={{ padding:'8px 20px',border:'none',borderRadius:5,
                  background:saveState==='saving'?'#9ca3af':'#16a34a',color:'#fff',fontSize:13,fontWeight:600,cursor:saveState==='saving'?'not-allowed':'pointer' }}>
                {saveState==='saving'?'⏳ Speichert…':'💾 Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
