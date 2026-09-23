import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../supabaseClient'
import { formatCurrency, addMonths, toMonthKey } from '../lib/budget'
import { computeCategorySummaries } from '../lib/budget'
import { parseDateStr } from '../lib/reports'
import { moveBudgetedAmount } from '../lib/overspend'
import { fetchOverspendMoves, summarizeOverspendMoves } from '../lib/overspendHistory'
import CurrencyInput, { amountToCents, centsToAmount } from './CurrencyInput'

const HISTORY_WINDOW_MONTHS = 3

export default function OverspendWarning({ overspendInfo, categories, onResolve }) {
  const { category, monthKey, overspentAmount } = overspendInfo
  const [budgetEntries, setBudgetEntries] = useState([])
  const [transactions, setTransactions] = useState([])
  const [overspendStats, setOverspendStats] = useState({})
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [amountCents, setAmountCents] = useState(amountToCents(overspentAmount))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const historyStartKey = toMonthKey(addMonths(parseDateStr(monthKey), -(HISTORY_WINDOW_MONTHS - 1)))
      const [b, t, history] = await Promise.all([
        supabase.from('budget_entries').select('*'),
        supabase.from('transactions').select('*'),
        fetchOverspendMoves(historyStartKey, monthKey),
      ])
      setBudgetEntries(b.data ?? [])
      setTransactions(t.data ?? [])
      setOverspendStats(summarizeOverspendMoves(history.moves))
      setLoading(false)
    }
    load()
  }, [monthKey])

  if (loading) return <div className="empty-state">Carregando categorias...</div>

  const summaries = computeCategorySummaries(categories, budgetEntries, transactions, monthKey)
  const options = summaries
    .filter((c) => c.id !== category.id && !c.is_income && c.available > 0)
    .sort((a, b) => b.available - a.available)

  // Quantas vezes ANTES desta a categoria já precisou de cobertura, nos
  // últimos meses (o movimento atual ainda não foi gravado nesse ponto).
  const priorOverspentCount = overspendStats[category.id]?.overspentMonths.size ?? 0

  function handleSelect(cat) {
    setSelectedId(cat.id)
    setAmountCents(amountToCents(Math.min(overspentAmount, cat.available)))
  }

  async function handleConfirm() {
    setError('')
    if (!selectedId) {
      setError('Escolha uma categoria pra cobrir a diferença.')
      return
    }
    const amount = centsToAmount(amountCents)
    if (!amount || amount <= 0) {
      setError('Informe um valor maior que zero.')
      return
    }
    setSaving(true)
    const { error: moveError } = await moveBudgetedAmount(selectedId, category.id, monthKey, amount)
    setSaving(false)
    if (moveError) {
      setError('Não foi possível mover o valor. Tente novamente.')
      return
    }
    onResolve()
  }

  return (
    <div className="overspend-screen">
      <div className="overspend-alert">
        <p className="overspend-title">⚠️ {category.name} ficou negativa</p>
        <p className="overspend-sub">
          Você estourou {formatCurrency(overspentAmount)} do orçado nessa categoria. De qual
          categoria quer cobrir a diferença?
        </p>
        {priorOverspentCount >= 1 && (
          <p className="overspend-pattern-note">
            📊 Essa já é a {priorOverspentCount + 1}ª vez nos últimos {HISTORY_WINDOW_MONTHS} meses que
            {' '}{category.name} precisa de cobertura — talvez valha aumentar o orçado dela de vez,
            na tela de Orçamento.
          </p>
        )}
      </div>

      {options.length === 0 ? (
        <p className="empty-state">
          Nenhuma outra categoria tem saldo disponível pra cobrir agora. Você pode ajustar o
          orçado manualmente na tela de Orçamento.
        </p>
      ) : (
        <div className="overspend-options">
          {options.map((opt) => {
            const lentCount = overspendStats[opt.id]?.lentMonths.size ?? 0
            return (
              <button
                key={opt.id}
                type="button"
                className={`overspend-option ${selectedId === opt.id ? 'selected' : ''}`}
                onClick={() => handleSelect(opt)}
              >
                <span>
                  {opt.name}
                  {lentCount >= 2 && (
                    <span className="overspend-option-note">
                      💸 já emprestou {lentCount}x nos últimos {HISTORY_WINDOW_MONTHS} meses
                    </span>
                  )}
                </span>
                <span className="overspend-option-available">{formatCurrency(opt.available)}</span>
              </button>
            )
          })}
        </div>
      )}

      <AnimatePresence>
        {selectedId && (
          <motion.div
            className="form-field"
            style={{ padding: '0 18px', overflow: 'hidden' }}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
          >
            <label htmlFor="move-amount">Valor a mover</label>
            <CurrencyInput id="move-amount" cents={amountCents} onChange={setAmountCents} />
          </motion.div>
        )}
      </AnimatePresence>

      {error && <p className="error-text" style={{ padding: '0 18px' }}>{error}</p>}

      <div className="overspend-actions">
        {selectedId && (
          <motion.button
            className="primary-btn"
            onClick={handleConfirm}
            disabled={saving}
            whileTap={{ scale: 0.97 }}
            transition={{ duration: 0.1 }}
          >
            {saving ? 'Movendo...' : 'Mover e continuar'}
          </motion.button>
        )}
        <button className="secondary-btn" onClick={onResolve} disabled={saving} style={{ width: '100%' }}>
          Ignorar por enquanto
        </button>
      </div>
    </div>
  )
}
