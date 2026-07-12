import { useNavigate } from 'react-router-dom'
import Panel from '../shared/Panel.jsx'

export default function B2({ renderedAt }) {
  const navigate = useNavigate()
  return (
    <Panel title="Hello, I am B2 — page /b2" color="#7c3aed" renderedAt={renderedAt}>
      <button style={{ marginLeft: '0.5rem' }} onClick={() => navigate('/b1')}>
        ← Go to B1
      </button>
      <button style={{ marginLeft: '0.5rem' }} onClick={() => navigate('/')}>
        ← Home
      </button>
    </Panel>
  )
}
