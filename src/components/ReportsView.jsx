import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { formatCurrency, monthKeyFromDateString } from '../lib/budget'
import { presetRange, previousPeriod, aggregateSpending, formatDateStr } from '../lib/reports'
import { summarizeOverspendMoves } from '../lib/overspendHistory'
import PieChart, { PALETTE } from './PieChart'
import { IconChevronLeft } from './icons'

const PRESETS = [
  { id: 'month', label: 'Este mês' },
  { id: 'lastMonth', label: 'Mês passado' },
  { id: 'last3', label: 'Últimos 3 meses' },
  { id: 'year', label: 'Este ano' },
  { id: 'all', label: 'Tudo' },
  { id: 'custom', label: 'Personalizado' },
]

export default function ReportsView() {
  const [preset, setPreset] = useState('month')
  const [customStart, setCustomStart] = useState(() => formatDateStr(new Date()))
  const [customEnd, setCustomEnd] = useState(() => formatDateStr(new Date()))
  const [categories, setCategories] = useState([])
  const [groups, setGroups] = useState([])
  const [transactions, setTransactions] = useState([])
  const [overspendMoves, setOverspendMoves] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [selectedGroupId, setSelectedGroupId] = useState(null)

  async function load() {
    setLoading(true)
    setLoadError(false)
    const [c, g, t, m] = await Promise.all([
      supabase.from('categories').select('*'),
      supabase.from('category_groups').select('*'),
      supabase.from('transactions').select('*'),
      supabase.from('overspend_moves').select('*'),
    ])
    if (c.error || g.error || t.error || m.error) {
      setLoadError(true)
      setLoading(false)
      return
    }
    setCategories(c.data ?? [])
    setGroups(g.data ?? [])
    setTransactions(t.data ?? [])
    setOverspendMoves(m.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // Volta pra visão geral sempre que o filtro de período muda, pra não ficar
  // "preso" num grupo que não existe mais nesse novo período.
  useEffect(() => { setSelectedGroupId(null) }, [preset, customStart, customEnd])

  if (loading) return <div className="empty-state">Carregando relatório...</div>

  if (loadError) {
    return (
      <div className="empty-state">
        <p>Não foi possível carregar o relatório. Verifique sua conexão.</p>
        <button className="secondary-btn" onClick={load} style={{ marginTop: 12 }}>
          Tentar novamente
        </button>
      </div>
    )
  }

  const today = new Date()
  const range = preset === 'custom' ? { start: customStart, end: customEnd } : presetRange(preset, today)

  const { byCategory, byGroup, total } = aggregateSpending(
    transactions, categories, groups, range.start, range.end
  )

  const prevRange = previousPeriod(preset, range.start, range.end)
  const prevTotal = prevRange
    ? aggregateSpending(transactions, categories, groups, prevRange.start, prevRange.end).total
    : null

  let deltaLabel = null
  let deltaUp = false
  if (prevTotal !== null && prevTotal > 0) {
    const deltaPct = ((total - prevTotal) / prevTotal) * 100
    deltaUp = deltaPct > 0
    const arrow = deltaPct > 0 ? '↑' : deltaPct < 0 ? '↓' : '→'
    deltaLabel = `${arrow} ${Math.abs(deltaPct).toFixed(0)}% vs período anterior`
  }

  const selectedGroup = groups.find((g) => g.id === selectedGroupId)
  const pieData = selectedGroup
    ? byCategory.filter((c) => c.groupId === selectedGroupId)
    : byGroup
  const pieTotal = pieData.reduce((sum, s) => sum + s.amount, 0)

  // Movimentos de "cobrir estouro" dentro do período selecionado (por mês,
  // já que o registro é mensal — funciona bem mesmo com range personalizado).
  const rangeStartMonth = monthKeyFromDateString(range.start)
  const rangeEndMonth = monthKeyFromDateString(range.end)
  const movesInRange = overspendMoves.filter(
    (m) => m.month >= rangeStartMonth && m.month <= rangeEndMonth
  )
  const overspendStats = summarizeOverspendMoves(movesInRange)
  const categoriesById = Object.fromEntries(categories.map((c) => [c.id, c]))

  const mostOverspent = Object.entries(overspendStats)
    .map(([id, s]) => ({ id, name: categoriesById[id]?.name ?? 'Categoria removida', count: s.overspentMonths.size, total: s.totalReceived }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count)

  const mostLent = Object.entries(overspendStats)
    .map(([id, s]) => ({ id, name: categoriesById[id]?.name ?? 'Categoria removida', count: s.lentMonths.size, total: s.totalLent }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count)

  return (
    <div>
      <div className="report-filters">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            className={`chip ${preset === p.id ? 'active' : ''}`}
            onClick={() => setPreset(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {preset === 'custom' && (
        <div className="report-custom-range">
          <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
          <span>até</span>
          <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
        </div>
      )}

      <div className="report-total-card">
        <p className="label">Total gasto no período</p>
        <p className="amount">{formatCurrency(total)}</p>
        {deltaLabel && (
          <p className={`report-delta ${deltaUp ? 'up' : 'down'}`}>{deltaLabel}</p>
        )}
      </div>

      {byGroup.length === 0 ? (
        <p className="empty-state">Nenhum gasto registrado nesse período.</p>
      ) : (
        <>
          {selectedGroup && (
            <button className="report-back" onClick={() => setSelectedGroupId(null)}>
              <IconChevronLeft size={18} />
              Todos os grupos
            </button>
          )}

          <p className="group-title"><span>{selectedGroup ? selectedGroup.name : 'Por grupo'}</span></p>

          <PieChart
            slices={pieData}
            onSliceClick={selectedGroup ? undefined : (slice) => setSelectedGroupId(slice.id)}
          />

          <div className="report-legend">
            {pieData.map((s, i) => (
              <button
                key={s.id}
                className="report-legend-row"
                disabled={!!selectedGroup}
                onClick={() => !selectedGroup && setSelectedGroupId(s.id)}
              >
                <span className="report-legend-left">
                  <span className="legend-dot" style={{ background: PALETTE[i % PALETTE.length] }} />
                  {s.name}
                </span>
                <span className="report-legend-right">
                  {formatCurrency(s.amount)}
                  <span className="report-legend-pct"> · {((s.amount / pieTotal) * 100).toFixed(0)}%</span>
                </span>
              </button>
            ))}
          </div>

          {!selectedGroup && (
            <>
              <p className="group-title"><span>Por categoria</span></p>
              <div>
                {byCategory.map((c) => (
                  <div className="report-category-row" key={c.id}>
                    <span className="name">{c.name}</span>
                    <span className="amt">{formatCurrency(c.amount)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      <p className="group-title"><span>Estouros e coberturas</span></p>
      {mostOverspent.length === 0 && mostLent.length === 0 ? (
        <p className="empty-state">Nenhum estouro coberto nesse período.</p>
      ) : (
        <>
          {mostOverspent.length > 0 && (
            <>
              <p className="report-subheading">Precisaram de cobertura</p>
              {mostOverspent.map((c) => (
                <div className="report-category-row" key={c.id}>
                  <span className="name">⚠️ {c.name}</span>
                  <span className="amt">{c.count}x · {formatCurrency(c.total)}</span>
                </div>
              ))}
            </>
          )}
          {mostLent.length > 0 && (
            <>
              <p className="report-subheading">Emprestaram dinheiro</p>
              {mostLent.map((c) => (
                <div className="report-category-row" key={c.id}>
                  <span className="name">💸 {c.name}</span>
                  <span className="amt">{c.count}x · {formatCurrency(c.total)}</span>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </div>
  )
}
