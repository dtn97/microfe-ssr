/**
 * A module-private "heavy" component. B1 references it via React.lazy, so on
 * the client it becomes its own async chunk, fetched only when the user asks
 * for it — a third level of splitting below app and module.
 */
export default function SalesChart() {
  const bars = [40, 70, 30, 85, 55, 95]
  return (
    <div style={{ marginTop: '0.75rem' }}>
      <p style={{ margin: '0 0 0.25rem', fontSize: '0.8rem', color: '#6b7280' }}>
        SalesChart — lazy-loaded on demand from its own chunk
      </p>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80 }}>
        {bars.map((h, i) => (
          <div
            key={i}
            style={{ width: 28, height: `${h}%`, background: '#059669', borderRadius: 3 }}
          />
        ))}
      </div>
    </div>
  )
}
