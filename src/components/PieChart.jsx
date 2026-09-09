// Paleta em tons terrosos, consistente com o resto do app.
export const PALETTE = ['#2f6f5e', '#c9a13b', '#cc7a52', '#3d6b8a', '#7a6a8a', '#5a8a6a']

export default function PieChart({ slices, onSliceClick }) {
  const total = slices.reduce((sum, s) => sum + s.amount, 0)

  if (total <= 0) {
    return <div className="pie-empty">Sem gastos no período</div>
  }

  let cursor = 0
  const ranges = slices.map((s) => {
    const pct = (s.amount / total) * 100
    const start = cursor
    cursor += pct
    return { ...s, start, end: cursor }
  })

  const stops = ranges.map((r, i) => `${PALETTE[i % PALETTE.length]} ${r.start}% ${r.end}%`)

  function handleClick(e) {
    if (!onSliceClick) return
    const rect = e.currentTarget.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const dx = e.clientX - cx
    const dy = e.clientY - cy
    // ângulo a partir das 12h, sentido horário — mesma convenção do conic-gradient
    let angleDeg = Math.atan2(dx, -dy) * (180 / Math.PI)
    if (angleDeg < 0) angleDeg += 360
    const pct = (angleDeg / 360) * 100
    const hit = ranges.find((r) => pct >= r.start && pct < r.end)
    if (hit) onSliceClick(hit)
  }

  return (
    <div className="pie-wrap">
      <div
        className={`pie-circle ${onSliceClick ? 'tappable' : ''}`}
        style={{ background: `conic-gradient(${stops.join(', ')})` }}
        onClick={handleClick}
        role={onSliceClick ? 'button' : undefined}
        aria-label={onSliceClick ? 'Toque numa fatia para ver o detalhe' : undefined}
      />
    </div>
  )
}
