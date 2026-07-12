import { useNavigate } from 'react-router-dom'
import Panel from '../shared/Panel.jsx'

export default function B1({ renderedAt }) {
  const navigate = useNavigate()
  return (
    <Panel title="Hello, I am B1 — page /b1" color="#059669" renderedAt={renderedAt}>
      <button style={{ marginLeft: '0.5rem' }} onClick={() => navigate('/b2')}>
        Go to B2 →
      </button>
      <button style={{ marginLeft: '0.5rem' }} onClick={() => navigate('/')}>
        ← Home
      </button>
    </Panel>
  )
}
