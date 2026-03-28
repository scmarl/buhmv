import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

interface FieldDef { name: string; label: string; field_type: string }

interface LabelState {
  members: any[]
  allFields: FieldDef[]
  title: string
}

const FORMATS = [
  { id: '3x8',  label: 'Standard Etiketten 3×8',  cols: 3, rows: 8,  labelW: 70,   labelH: 37,   marginTop: 13,  marginSide: 5  },
  { id: '3x10', label: 'Standard Etiketten 3×10', cols: 3, rows: 10, labelW: 70,   labelH: 29.7, marginTop: 10,  marginSide: 5  },
  { id: '2x7',  label: 'Grosse Etiketten 2×7',    cols: 2, rows: 7,  labelW: 99.1, labelH: 42.3, marginTop: 10,  marginSide: 5  },
  { id: '4x12', label: 'Kleine Etiketten 4×12',   cols: 4, rows: 12, labelW: 48.5, labelH: 25.4, marginTop: 10,  marginSide: 5  },
]

function formatVal(member: any, fieldName: string, fieldType: string): string {
  const val = member[fieldName]
  if (val == null || val === '') return ''
  if (fieldName === 'age') return val + ' J.'
  if (fieldName === 'groups') return Array.isArray(val) ? val.map((g: any) => g.name).join(', ') : ''
  if (fieldName === 'is_active') return val ? 'Ja' : 'Nein'
  if (fieldType === 'date') {
    const d = new Date(val); return isNaN(d.getTime()) ? String(val) : d.toLocaleDateString('de-DE')
  }
  if (fieldType === 'checkbox') return val ? 'Ja' : 'Nein'
  return String(val)
}

function getLabelLines(member: any, senderRow: string[], fieldRows: string[][], allFields: FieldDef[]) {
  const lines: { text: string; sender: boolean }[] = []
  const senderText = senderRow.filter(s => s.trim()).join(' ')
  if (senderText) lines.push({ text: senderText, sender: true })
  for (const row of fieldRows) {
    const parts = row.filter(f => f).map(f => {
      const fd = allFields.find(x => x.name === f)
      return formatVal(member, f, fd?.field_type ?? 'text')
    }).filter(v => v)
    if (parts.length) lines.push({ text: parts.join(' '), sender: false })
  }
  return lines
}

const COLS = 4

export default function LabelPage() {
  const { state } = useLocation() as { state: LabelState | null }
  const navigate = useNavigate()

  const [formatId, setFormatId] = useState('3x8')
  const [senderRow, setSenderRow] = useState<string[]>(['', '', '', ''])
  const [fieldRows, setFieldRows] = useState<string[][]>([['', '', '', ''], ['', '', '', '']])
  const [skip, setSkip] = useState(0)
  const [previewIdx, setPreviewIdx] = useState(0)

  if (!state?.members?.length) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p>Keine Mitglieder zum Drucken übergeben.</p>
        <button onClick={() => navigate(-1)} style={{ marginTop: 16, padding: '8px 20px', background: '#2a5298', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Zurück</button>
      </div>
    )
  }

  const { members, allFields } = state
  const fmt = FORMATS.find(f => f.id === formatId)!
  const totalPerPage = fmt.cols * fmt.rows

  // Field options for dropdowns
  const NON_DISPLAY = new Set(['photo_url', 'notes_field'])
  const fieldOptions = [{ name: '', label: '-- Feld wählen --' }, ...allFields.filter(f => !NON_DISPLAY.has(f.name) && f.field_type !== 'file' && f.field_type !== 'image')]

  function updateSender(i: number, val: string) {
    setSenderRow(r => { const n = [...r]; n[i] = val; return n })
  }
  function updateField(rowIdx: number, colIdx: number, val: string) {
    setFieldRows(rows => rows.map((r, ri) => ri !== rowIdx ? r : r.map((c, ci) => ci !== colIdx ? c : val)))
  }
  function addRow() { setFieldRows(r => [...r, ['', '', '', '']]) }
  function removeRow() { if (fieldRows.length > 1) setFieldRows(r => r.slice(0, -1)) }

  const previewMember = members[previewIdx] ?? members[0]
  const previewLines = getLabelLines(previewMember, senderRow, fieldRows, allFields)

  function doPrint() {
    const f = FORMATS.find(x => x.id === formatId)!
    const labelsHtml: string[] = []

    // Skip labels
    for (let i = 0; i < skip; i++) labelsHtml.push(`<div class="label"></div>`)

    // Member labels
    for (const m of members) {
      const lines = getLabelLines(m, senderRow, fieldRows, allFields)
      const linesHtml = lines.map(l =>
        l.sender
          ? `<div style="font-size:7.5pt;font-style:italic;margin-bottom:3px;border-bottom:0.3pt solid #999;padding-bottom:1px">${l.text}</div>`
          : `<div>${l.text}</div>`
      ).join('')
      labelsHtml.push(`<div class="label">${linesHtml}</div>`)
    }

    const totalNeeded = labelsHtml.length
    const pages = Math.ceil(totalNeeded / (f.cols * f.rows))
    let html = ''
    for (let p = 0; p < pages; p++) {
      const slice = labelsHtml.slice(p * f.cols * f.rows, (p + 1) * f.cols * f.rows)
      while (slice.length < f.cols * f.rows) slice.push(`<div class="label"></div>`)
      html += `<div class="page">${slice.join('')}</div>`
    }

    const w = window.open('', '_blank')!
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Etiketten</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Arial, sans-serif; background: #fff; }
.page {
  width: 210mm; height: 297mm;
  padding-top: ${f.marginTop}mm;
  padding-left: ${f.marginSide}mm;
  padding-right: ${f.marginSide}mm;
  display: grid;
  grid-template-columns: repeat(${f.cols}, ${f.labelW}mm);
  grid-template-rows: repeat(${f.rows}, ${f.labelH}mm);
  page-break-after: always;
}
.label {
  width: ${f.labelW}mm; height: ${f.labelH}mm;
  padding: 3mm 4mm;
  font-size: 9pt;
  line-height: 1.35;
  overflow: hidden;
  page-break-inside: avoid;
}
@media print { @page { margin: 0; size: A4; } body { margin: 0; } }
</style></head><body>${html}</body></html>`)
    w.document.close()
    w.focus()
    w.print()
  }

  const inputStyle: React.CSSProperties = { padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13, background: '#fff', width: '100%', boxSizing: 'border-box' }
  const selectStyle: React.CSSProperties = { padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13, background: '#fff', width: '100%', boxSizing: 'border-box' }

  return (
    <div style={{ maxWidth: 860, padding: '0 0 40px 24px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 6px' }}>Etiketten für {members.length} Mitglieder drucken</h1>
      <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 28px', lineHeight: 1.5 }}>
        Format der Etiketten wählen, Felder zuweisen und Vorschau prüfen.<br />
        Die erste Zeile wird als Absender gedruckt (kleiner, kursiv).
      </p>

      {/* Format */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>Format der Etiketten</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <select value={formatId} onChange={e => setFormatId(e.target.value)}
            style={{ ...selectStyle, width: 220, border: '2px solid #2a5298' }}>
            {FORMATS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
          {/* Mini sheet preview */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${fmt.cols}, 18px)`, gridTemplateRows: `repeat(${fmt.rows}, 12px)`, gap: 2, padding: 8, border: '2px solid #374151', background: '#374151', borderRadius: 4 }}>
            {Array.from({ length: fmt.cols * fmt.rows }).map((_, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: 1 }} />
            ))}
          </div>
        </div>
      </div>

      {/* Field selection */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Datenfelder wählen</div>

        {/* Sender row (free text) */}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${COLS}, 1fr)`, gap: 6, marginBottom: 6 }}>
          {senderRow.map((val, i) => (
            <div key={i} style={{ position: 'relative' }}>
              <input value={val} onChange={e => updateSender(i, e.target.value)}
                placeholder="Absender-Text..."
                style={{ ...inputStyle, paddingRight: val ? 24 : 8, borderColor: '#2a5298', background: '#eff4ff' }} />
              {val && (
                <button onClick={() => updateSender(i, '')}
                  style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#6b7280', padding: 0, lineHeight: 1 }}>×</button>
              )}
            </div>
          ))}
        </div>

        {/* Field rows (dropdowns) */}
        {fieldRows.map((row, ri) => (
          <div key={ri} style={{ display: 'grid', gridTemplateColumns: `repeat(${COLS}, 1fr)`, gap: 6, marginBottom: 6 }}>
            {row.map((val, ci) => (
              <select key={ci} value={val} onChange={e => updateField(ri, ci, e.target.value)} style={selectStyle}>
                {fieldOptions.map(f => <option key={f.name} value={f.name}>{f.label}</option>)}
              </select>
            ))}
          </div>
        ))}

        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button onClick={removeRow} disabled={fieldRows.length <= 1}
            style={{ padding: '6px 14px', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: fieldRows.length <= 1 ? 'not-allowed' : 'pointer', fontSize: 13, color: '#374151', opacity: fieldRows.length <= 1 ? 0.4 : 1 }}>
            weniger Felder
          </button>
          <button onClick={addRow}
            style={{ padding: '6px 14px', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer', fontSize: 13, color: '#374151' }}>
            mehr Felder
          </button>
        </div>
      </div>

      {/* Skip */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Etiketten überspringen</div>
        <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 10 }}>
          Überspringe Etiketten um ein teilweise verbrauchtes Blatt zu bedrucken.
        </p>
        <select value={skip} onChange={e => setSkip(Number(e.target.value))} style={{ ...selectStyle, width: 80 }}>
          {Array.from({ length: totalPerPage }).map((_, i) => <option key={i} value={i}>{i}</option>)}
        </select>
      </div>

      {/* Preview */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>Vorschau</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <button onClick={() => setPreviewIdx(i => Math.max(0, i - 1))} disabled={previewIdx === 0}
            style={{ width: 28, height: 28, border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: previewIdx === 0 ? 'not-allowed' : 'pointer', opacity: previewIdx === 0 ? 0.4 : 1 }}>‹</button>
          <button onClick={() => setPreviewIdx(i => Math.min(members.length - 1, i + 1))} disabled={previewIdx >= members.length - 1}
            style={{ width: 28, height: 28, border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: previewIdx >= members.length - 1 ? 'not-allowed' : 'pointer', opacity: previewIdx >= members.length - 1 ? 0.4 : 1 }}>›</button>
        </div>

        <div style={{ width: `${fmt.labelW * 3.7795}px`, minHeight: `${fmt.labelH * 3.7795}px`, maxWidth: 320, border: '1px solid #d1d5db', borderRadius: 4, padding: '10px 14px', background: '#fff', fontSize: 13, lineHeight: 1.5 }}>
          {previewLines.length === 0
            ? <span style={{ color: '#9ca3af' }}>Keine Felder ausgewählt</span>
            : previewLines.map((l, i) => (
              <div key={i} style={{ fontSize: l.sender ? 11 : 13, fontStyle: l.sender ? 'italic' : 'normal', borderBottom: l.sender ? '1px solid #999' : 'none', paddingBottom: l.sender ? 2 : 0, marginBottom: l.sender ? 4 : 0 }}>{l.text}</div>
            ))
          }
        </div>
        <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 6 }}>Datensatz {previewIdx + 1} von {members.length}</p>
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button onClick={doPrint}
          style={{ padding: '10px 24px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 5, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
          Etiketten drucken
        </button>
        <button onClick={() => navigate(-1)}
          style={{ padding: '10px 20px', border: '1px solid #d1d5db', borderRadius: 5, background: '#fff', fontSize: 14, cursor: 'pointer', color: '#374151' }}>
          Schliessen
        </button>
      </div>
    </div>
  )
}
