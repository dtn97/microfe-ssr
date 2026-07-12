import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Home({ renderedAt }: { renderedAt?: string }) {
  const navigate = useNavigate()
  const [count, setCount] = useState(0)
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])

  return (
    <div
      style={{
        border: '2px solid #2563eb',
        borderRadius: 8,
        padding: '0.75rem 1rem',
        margin: '1rem 0',
      }}
    >
      <h2 style={{ margin: '0 0 0.5rem', color: '#2563eb' }}>Hello, I am A — the home page</h2>
      <p style={{ margin: '0 0 0.5rem' }}>
        Server-rendered at: {renderedAt} · status: {hydrated ? '✅ hydrated' : '⏳ static HTML'}
      </p>
      <button type="button" onClick={() => setCount((c) => c + 1)}>
        A clicked {count} times
      </button>
      <button type="button" style={{ marginLeft: '0.5rem' }} onClick={() => navigate('/b1')}>
        Go to Page B1 →
      </button>
      <button type="button" style={{ marginLeft: '0.5rem' }} onClick={() => navigate('/b2')}>
        Go to Page B2 →
      </button>
    </div>
  )
}
