import { useEffect, useState } from 'react'

export default function Widget() {
  const [count, setCount] = useState(0)
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])

  return (
    <div
      style={{
        border: '2px dashed #ea580c',
        borderRadius: 8,
        padding: '0.5rem 0.75rem',
        marginTop: '0.75rem',
      }}
    >
      <strong style={{ color: '#ea580c' }}>Hello, I am C — a nested micro app</strong>
      <p style={{ margin: '0.25rem 0', fontSize: '0.8rem', color: '#6b7280' }}>
        independently deployed, embedded by B2 · status:{' '}
        {hydrated ? '✅ hydrated' : '⏳ static HTML'}
      </p>
      <button type="button" onClick={() => setCount((c) => c + 1)}>
        C clicked {count} times
      </button>
    </div>
  )
}
