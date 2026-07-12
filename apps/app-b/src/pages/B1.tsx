import { lazy, Suspense, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Panel from '../shared/Panel'

// Client build (splitting on): this becomes b1's own async chunk, fetched
// only when the user clicks the button. Server build (splitting off): the
// import is inlined into the app's single server bundle — and since the
// chart is hidden until clicked, SSR never renders it anyway.
const SalesChart = lazy(() => import('../components/SalesChart'))

export default function B1({ renderedAt }: { renderedAt?: string }) {
  const navigate = useNavigate()
  const [showChart, setShowChart] = useState(false)

  return (
    <Panel title="Hello, I am B1 — page /b1" color="#059669" renderedAt={renderedAt}>
      <button type="button" style={{ marginLeft: '0.5rem' }} onClick={() => setShowChart(true)}>
        Load sales chart (lazy chunk)
      </button>
      <button type="button" style={{ marginLeft: '0.5rem' }} onClick={() => navigate('/b2')}>
        Go to B2 →
      </button>
      <button type="button" style={{ marginLeft: '0.5rem' }} onClick={() => navigate('/')}>
        ← Home
      </button>
      {showChart && (
        <Suspense fallback={<p>Loading chart…</p>}>
          <SalesChart />
        </Suspense>
      )}
    </Panel>
  )
}
