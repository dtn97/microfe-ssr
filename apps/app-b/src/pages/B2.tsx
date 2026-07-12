import { getMicroAppComponent } from '@microfe/sdk'
import { useNavigate } from 'react-router-dom'
import Panel from '../shared/Panel'

// Nested micro app: B2 embeds app-c's widget the same way the host embeds
// pages — it's just a component. Declared in package.json ("microfe") so the
// host preloads app-c's client entry before hydrating this page.
const NestedC = getMicroAppComponent('app-c/main')

export default function B2({ renderedAt }: { renderedAt?: string }) {
  const navigate = useNavigate()
  return (
    <Panel title="Hello, I am B2 — page /b2" color="#7c3aed" renderedAt={renderedAt}>
      <button type="button" style={{ marginLeft: '0.5rem' }} onClick={() => navigate('/b1')}>
        ← Go to B1
      </button>
      <button type="button" style={{ marginLeft: '0.5rem' }} onClick={() => navigate('/')}>
        ← Home
      </button>
      <NestedC />
    </Panel>
  )
}
