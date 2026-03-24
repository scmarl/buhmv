import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'

interface GroupNode {
  id: number
  name: string
  member_count: number
  children: GroupNode[]
}

const LINE = '#c5ccd6'

export default function OrganigrammPage() {
  const { data: tree = [], isLoading } = useQuery<GroupNode[]>({
    queryKey: ['groups-tree'],
    queryFn: () => api.get('/groups', { params: { tree: true } }).then(r => r.data),
  })

  if (isLoading) return <div>Laden…</div>

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Organigramm</h1>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 28 }}>
        Gruppe anklicken, um die zugehörigen Mitglieder anzuzeigen.
      </p>
      <div style={{ overflowX: 'auto', overflowY: 'auto', paddingBottom: 40 }}>
        <div style={{ display: 'inline-flex', gap: 40, alignItems: 'flex-start', paddingTop: 8 }}>
          {tree.map(node => <TreeNode key={node.id} node={node} />)}
        </div>
      </div>
    </div>
  )
}

function NodeBox({ node, expanded, onToggle }: {
  node: GroupNode
  expanded: boolean
  onToggle: (e: React.MouseEvent) => void
}) {
  const navigate = useNavigate()
  const hasChildren = node.children.length > 0

  return (
    <div
      onClick={() => navigate(`/members?group=${node.id}`)}
      style={{
        background: '#fff',
        border: '1.5px solid #d1d5db',
        borderRadius: 8,
        padding: '10px 14px 8px',
        minWidth: 76,
        maxWidth: 100,
        textAlign: 'center',
        cursor: 'pointer',
        boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
        userSelect: 'none',
        transition: 'box-shadow .15s, border-color .15s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = '0 3px 10px rgba(42,82,152,0.18)'
        e.currentTarget.style.borderColor = '#2a5298'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.07)'
        e.currentTarget.style.borderColor = '#d1d5db'
      }}
    >
      <div style={{ position: 'relative', display: 'inline-block', marginBottom: 6 }}>
        <span style={{ fontSize: 26, display: 'block', lineHeight: 1 }}>📁</span>
        <span style={{
          position: 'absolute', top: -5, right: -8,
          background: '#3d4f6e', color: '#fff',
          fontSize: 9, fontWeight: 700, borderRadius: 9,
          padding: '1px 4px', minWidth: 16, textAlign: 'center', lineHeight: '14px',
        }}>{node.member_count}</span>
      </div>

      <div lang='de' style={{
        fontSize: 11.5, fontWeight: 500, color: '#374151',
        lineHeight: 1.3, hyphens: 'auto', wordBreak: 'break-word',
      }}>
        {node.name}
      </div>

      {hasChildren && (
        <button
          onClick={onToggle}
          style={{
            marginTop: 5, background: '#f3f4f6', border: 'none',
            borderRadius: 4, cursor: 'pointer', fontSize: 9,
            color: '#6b7280', padding: '2px 6px', lineHeight: 1,
          }}
          title={expanded ? 'Zuklappen' : 'Aufklappen'}
        >
          {expanded ? '▲' : '▼'}
        </button>
      )}
    </div>
  )
}

function TreeNode({ node }: { node: GroupNode }) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = node.children.length > 0 && expanded

  function handleToggle(e: React.MouseEvent) {
    e.stopPropagation()
    setExpanded(v => !v)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <NodeBox node={node} expanded={expanded} onToggle={handleToggle} />
      {hasChildren && (
        <>
          <div style={{ width: 1, height: 20, background: LINE }} />
          <ChildrenRow nodes={node.children} />
        </>
      )}
    </div>
  )
}

function ChildrenRow({ nodes }: { nodes: GroupNode[] }) {
  if (nodes.length === 1) {
    return <TreeNode node={nodes[0]} />
  }

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start' }}>
      {nodes.map((node, i) => {
        const isFirst = i === 0
        const isLast = i === nodes.length - 1
        return (
          <div key={node.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ display: 'flex', width: '100%', height: 20, position: 'relative' }}>
              {!isFirst
                ? <div style={{ flex: 1, borderTop: `1px solid ${LINE}`, height: 1, alignSelf: 'flex-start' }} />
                : <div style={{ flex: 1 }} />
              }
              <div style={{ width: 1, background: LINE, height: '100%', flexShrink: 0 }} />
              {!isLast
                ? <div style={{ flex: 1, borderTop: `1px solid ${LINE}`, height: 1, alignSelf: 'flex-start' }} />
                : <div style={{ flex: 1 }} />
              }
            </div>
            <div style={{ padding: '0 12px' }}>
              <TreeNode node={node} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
