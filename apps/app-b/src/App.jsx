import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function App({ renderedAt }) {
  const navigate = useNavigate()
  const [count, setCount] = useState(0)
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])

  return (
    <div style={{ border: '2px solid #059669', borderRadius: 8, padding: '0.75rem 1rem', margin: '1rem 0' }}>
      <h2 style={{ margin: '0 0 0.5rem', color: '#059669' }}>Hello, I am B — page /b</h2>
      <p style={{ margin: '0 0 0.5rem' }}>
        Server-rendered at: {renderedAt} · status: {hydrated ? '✅ hydrated' : '⏳ static HTML'}
      </p>
      <button onClick={() => setCount((c) => c + 1)}>B clicked {count} times</button>
      <button style={{ marginLeft: '0.5rem' }} onClick={() => navigate('/')}>
        ← Back to home (A)
      </button>
    </div>
  )
}
