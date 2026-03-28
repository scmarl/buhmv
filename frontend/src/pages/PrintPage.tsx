import { useState, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

interface Col { name: string; label: string; field_type: string }

function formatCell(value: unknown, fieldType: string, fieldName: string): string {
  if (value == null || value === '') return ''
  if (fieldName === 'age') return value + ' J.'
  if (fieldName === 'groups') {
    if (Array.isArray(value)) return value.map((g: any) => g.name).join(', ')
    return ''
  }
  if (fieldName === 'is_active') return value ? 'Ja' : 'Nein'
  if (fieldType === 'date') {
    const d = new Date(value as string)
    if (isNaN(d.getTime())) return String(value)
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }
  if (fieldType === 'checkbox') return value ? 'Ja' : 'Nein'
  if (fieldType === 'money') return Number(value).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
  return String(value)
}

export default function PrintPage() {
  const { state } = useLocation() as { state: { members: any[]; columns: Col[]; title: string } | null }
  const navigate = useNavigate()
  const titleRef = useRef<HTMLHeadingElement>(null)

  const [fontSize, setFontSize] = useState(13)
  const [grid, setGrid] = useState(false)
  const [wrap, setWrap] = useState(false)

  if (!state?.members) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p>Keine Druckdaten vorhanden.</p>
        <button onClick={() => navigate(-1)} style={{ marginTop: 16, padding: '8px 20px', background: '#2a5298', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Zurück</button>
      </div>
    )
  }

  const { members, columns, title } = state

  function doPrint() {
    const titleText = titleRef.current?.innerText ?? title
    const w = window.open('', '_blank', 'width=900,height=700')!
    const rowStyle = grid
      ? 'border-top: 1px solid #ccc;'
      : 'border-top: 1px solid #f0f0f0;'
    const thStyle = grid
      ? `padding: 6px 10px; font-size: ${fontSize - 1}px; font-weight: 700; text-align: left; border-bottom: 2px solid #333; border-right: 1px solid #ccc;`
      : `padding: 6px 10px; font-size: ${fontSize - 1}px; font-weight: 700; text-align: left; border-bottom: 2px solid #333;`
    const tdStyle = grid
      ? `padding: 5px 10px; font-size: ${fontSize}px; ${wrap ? '' : 'white-space: nowrap;'} border-right: 1px solid #ddd; vertical-align: top;`
      : `padding: 5px 10px; font-size: ${fontSize}px; ${wrap ? '' : 'white-space: nowrap;'} vertical-align: top;`

    const headers = columns.map(c => `<th style="${thStyle}">${c.label}</th>`).join('')
    const rows = members.map(m =>
      `<tr style="${rowStyle}">${columns.map(c => `<td style="${tdStyle}">${formatCell(m[c.name], c.field_type, c.name)}</td>`).join('')}</tr>`
    ).join('')

    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${titleText}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 20mm 15mm; }
  h1 { font-size: ${fontSize + 8}px; margin: 0 0 14px; font-weight: 700; }
  table { border-collapse: collapse; width: 100%; ${grid ? 'border: 1px solid #ccc;' : ''} }
  @media print { @page { margin: 15mm; } }
</style></head><body>
<h1>${titleText}</h1>
<p style="font-size:${fontSize - 1}px; color:#666; margin:0 0 10px">${members.length} Datensätze · ${new Date().toLocaleDateString('de-DE')}</p>
<table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>
</body></html>`)
    w.document.close()
    w.focus()
    w.print()
  }

  const tbBorder = grid ? '1px solid #d1d5db' : '1px solid #f3f4f6'

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
      {/* Controls bar */}
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '10px 24px', background: '#fff', borderBottom: '1px solid #e5e7eb', flexWrap: 'wrap' }}>
        <button onClick={doPrint} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 20px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 5, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
          🖨 Drucken
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: '#374151' }}>Schriftgröße:</span>
          <button onClick={() => setFontSize(s => Math.max(8, s - 1))} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#374151', padding: '0 4px', lineHeight: 1 }}>🔍<span style={{ fontSize: 10, verticalAlign: 'super' }}>−</span></button>
          <span style={{ fontSize: 13, minWidth: 24, textAlign: 'center', color: '#374151' }}>{fontSize}</span>
          <button onClick={() => setFontSize(s => Math.min(20, s + 1))} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#374151', padding: '0 4px', lineHeight: 1 }}>🔍<span style={{ fontSize: 10, verticalAlign: 'super' }}>+</span></button>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', color: '#374151' }}>
          <input type="checkbox" checked={grid} onChange={e => setGrid(e.target.checked)} />
          Raster anzeigen
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', color: '#374151' }}>
          <input type="checkbox" checked={wrap} onChange={e => setWrap(e.target.checked)} />
          Zeilen umbrechen
        </label>

        <button onClick={() => navigate(-1)} style={{ marginLeft: 'auto', background: 'none', border: '1px solid #d1d5db', borderRadius: 4, padding: '6px 14px', fontSize: 13, cursor: 'pointer', color: '#6b7280' }}>← Zurück</button>
      </div>

      {/* Print preview */}
      <div style={{ padding: '32px 40px', maxWidth: 1200, margin: '0 auto' }}>
        {/* Editable title */}
        <h1
          ref={titleRef}
          contentEditable
          suppressContentEditableWarning
          style={{ fontSize: fontSize + 10, fontWeight: 700, margin: '0 0 6px', outline: 'none', borderBottom: '2px solid transparent', padding: '2px 0' }}
          onFocus={e => (e.currentTarget.style.borderBottomColor = '#2a5298')}
          onBlur={e => (e.currentTarget.style.borderBottomColor = 'transparent')}
        >
          {title}
        </h1>
        <p style={{ fontSize: fontSize - 1, color: '#6b7280', margin: '0 0 16px' }}>{members.length} Datensätze · {new Date().toLocaleDateString('de-DE')}</p>

        {/* Table */}
        <div style={{ overflowX: 'auto', background: '#fff', border: grid ? '1px solid #d1d5db' : 'none', borderRadius: 4 }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #111827' }}>
                {columns.map(c => (
                  <th key={c.name} style={{ padding: '8px 10px', fontSize: fontSize - 1, fontWeight: 700, textAlign: 'left', whiteSpace: 'nowrap', borderRight: grid ? '1px solid #d1d5db' : 'none' }}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map((m, i) => (
                <tr key={m.id ?? i} style={{ borderTop: tbBorder }}>
                  {columns.map(c => (
                    <td key={c.name} style={{ padding: '5px 10px', fontSize, verticalAlign: 'top', whiteSpace: wrap ? 'normal' : 'nowrap', borderRight: grid ? '1px solid #e5e7eb' : 'none' }}>
                      {formatCell(m[c.name], c.field_type, c.name)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
