import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
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
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 32 }}>Organigramm</h1>
      <div style={{ overflowX: 'auto', overflowY: 'auto', paddingBottom: 40 }}>
        <div style={{ display: 'inline-flex', gap: 40, alignItems: 'flex-start', paddingTop: 8 }}>
          {tree.map(node => <TreeNode key={node.id} node={node} />)}
        </div>
      </div>
    </div>
  )
}

function NodeBox({ node, expanded, onClick }: { node: GroupNode; expanded: boolean; onClick?: () => void }) {
  const hasChildren = node.children.length > 0
  return (
    <div
      onClick={onClick}
      style={{
        background: '#fff',
        border: '1.5px solid #d1d5db',
        borderRadius: 8,
        padding: '10px 14px 8px',
        minWidth: 76,
        maxWidth: 100,
        textAlign: 'center',
        cursor: hasChildren ? 'pointer' : 'default',
        boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
        userSelect: 'none',
        transition: 'box-shadow .15s',
      }}
      onMouseEnter={e => hasChildren && (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.13)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.07)')}>
      <div style={{ position: 'relative', display: 'inline-block', marginBottom: 6 }}>
        <span style={{ fontSize: 26, display: 'block', lineHeight: 1 }}>📁</span>
        <span style={{
          position: 'absolute', top: -5, right: -8,
          background: '#3d4f6e', color: '#fff',
          fontSize: 9, fontWeight: 700, borderRadius: 9,
          padding: '1px 4px', minWidth: 16, textAlign: 'center', lineHeight: '14px',
        }}>{node.member_count}</span>
      </div>
      <div style={{ fontSize: 11.5, fontWeight: 500, color: '#374151', lineHeight: 1.3, wordBreak: 'break-word' }}>
        {node.name}
      </div>
      {hasChildren && (
        <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 3 }}>{expanded ? '▲' : '▼'}</div>
      )}
    </div>
  )
}

function TreeNode({ node }: { node: GroupNode }) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = node.children.length > 0 && expanded

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <NodeBox node={node} expanded={expanded} onClick={() => node.children.length && setExpanded(e => !e)} />
      {hasChildren && (
        <>
          {/* Vertical stem down from this node */}
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
        const isOnly = nodes.length === 1

        // Each child column: top connector made of border-top + border-left
        // First child: border-top right half + border-left full
        // Last child: border-top left half + no border-left (right side)
        // Middle: border-top full + border-left
        return (
          <div key={node.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* Connector between horizontal bar and node */}
            <div style={{ display: 'flex', width: '100%', height: 20, position: 'relative' }}>
              {/* Left half of horizontal bar */}
              {!isFirst && (
                <div style={{ flex: 1, borderTop: `1px solid ${LINE}`, marginTop: 0, height: 1, alignSelf: 'flex-start' }} />
              )}
              {isFirst && <div style={{ flex: 1 }} />}

              {/* Vertical drop in the center */}
              <div style={{ width: 1, background: LINE, height: '100%', flexShrink: 0 }} />

              {/* Right half of horizontal bar */}
              {!isLast && (
                <div style={{ flex: 1, borderTop: `1px solid ${LINE}`, marginTop: 0, height: 1, alignSelf: 'flex-start' }} />
              )}
              {isLast && <div style={{ flex: 1 }} />}
            </div>

            {/* The child node itself with horizontal padding between siblings */}
            <div style={{ padding: '0 12px' }}>
              <TreeNode node={node} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
