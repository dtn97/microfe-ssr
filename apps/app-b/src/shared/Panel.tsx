import { type ReactNode, useEffect, useState } from 'react'

/**
 * Shared UI used by both B1 and B2. Because the app's entry modules are built
 * together with esbuild `splitting`, this component (and everything else they
 * share) is emitted once into a common chunk instead of being duplicated.
 */
interface PanelProps {
  title: string
  color: string
  renderedAt?: string
  children?: ReactNode
}

export default function Panel({ title, color, renderedAt, children }: PanelProps) {
  const [count, setCount] = useState(0)
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])

  return (
    <div
      style={{
        border: `2px solid ${color}`,
        borderRadius: 8,
        padding: '0.75rem 1rem',
        margin: '1rem 0',
      }}
    >
      <h2 style={{ margin: '0 0 0.5rem', color }}>{title}</h2>
      <p style={{ margin: '0 0 0.5rem' }}>
        Server-rendered at: {renderedAt} · status: {hydrated ? '✅ hydrated' : '⏳ static HTML'}
      </p>
      <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', color: '#6b7280' }}>
        rendered with the shared &lt;Panel&gt; from app-b's common chunk
      </p>
      <button type="button" onClick={() => setCount((c) => c + 1)}>
        clicked {count} times
      </button>
      {children}
    </div>
  )
}
